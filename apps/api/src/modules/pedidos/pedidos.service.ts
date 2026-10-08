import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  calcularTotales,
  CODIGOS_ERROR,
  fechaOperativa,
  totalLinea,
  type AgregarPedidoItemInput,
  type EditarPedidoItemOutput,
  type CrearMesaInput,
  type CrearPedidoInput,
  type EditarMesaInput,
  type ListarPedidosQuery,
  type Mesa,
  type MesaConEstado,
  type Pedido,
  type ReordenarMesasInput,
} from '@mb/shared';
import {
  leerHoraCorte,
  leerTasaImpuestoBp,
} from '../../shared-kernel/configuracion/configuracion.lector';
import { DB, esViolacionUnicidad, type Db, type Executor, type Tx } from '../../shared-kernel/db/db';
import { DomainError } from '../../shared-kernel/errors/domain-error';
import { EventBus } from '../../shared-kernel/events/event-bus';
import { nuevoId } from '../../shared-kernel/ids';
import { CatalogoPublicService } from '../catalogo/catalogo.public';
import { ClientesService } from '../clientes/clientes.public';
import { CocinaService } from '../cocina/cocina.public';
import { InventarioService } from '../inventario/inventario.public';
import {
  PedidosRepository,
  type MesaFila,
  type PedidoFila,
  type PedidoItemFila,
} from './pedidos.repository';

export interface PedidoParaCobro {
  id: string;
  numeroDia: number;
  total: number;
  base: number;
  impuesto: number;
}

@Injectable()
export class PedidosService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly repo: PedidosRepository,
    private readonly eventBus: EventBus,
    private readonly catalogo: CatalogoPublicService,
    private readonly inventario: InventarioService,
    private readonly cocina: CocinaService,
    private readonly clientes: ClientesService,
  ) {}

  // --- Pedidos ---

  async crearPedido(input: CrearPedidoInput, usuarioId: string): Promise<Pedido> {
    const id = await this.db
      .transaction(async (tx) => {
        let mesaId: string | null = null;
        if (input.tipo === 'MESA' && input.mesaId) {
          const m = await this.repo.buscarMesaPorId(input.mesaId);
          if (!m) throw DomainError.noEncontrado('Mesa no encontrada.');
          if (!m.activa) {
            throw new DomainError('MESA_INACTIVA', 'La mesa está inactiva.', HttpStatus.CONFLICT);
          }
          const ocupada = (await this.repo.pedidosActivosPorMesa(tx)).find((o) => o.mesaId === m.id);
          if (ocupada) {
            throw new DomainError(
              'MESA_OCUPADA',
              `${m.nombre} ya tiene un pedido activo.`,
              HttpStatus.CONFLICT,
              { pedidoId: ocupada.pedidoId },
            );
          }
          mesaId = m.id;
        }
        if (input.clienteId && !(await this.clientes.buscarPorId(input.clienteId))) {
          throw DomainError.noEncontrado('Cliente no encontrado.');
        }
        const fecha = fechaOperativa(new Date(), await leerHoraCorte(tx));
        const numeroDia = await this.repo.siguienteNumeroDia(fecha, tx);
        const nuevoPedidoId = nuevoId();
        await this.repo.insertarPedido(
          {
            id: nuevoPedidoId,
            fechaOperativa: fecha,
            numeroDia,
            tipo: input.tipo,
            mesaId,
            clienteId: input.clienteId ?? null,
            usuarioId,
            nota: input.nota ?? null,
          },
          tx,
        );
        return nuevoPedidoId;
      })
      .catch((err: unknown) => {
        if (esViolacionUnicidad(err)) {
          throw new DomainError(
            'MESA_OCUPADA',
            'La mesa ya tiene un pedido activo.',
            HttpStatus.CONFLICT,
          );
        }
        throw err;
      });
    return this.obtenerPedido(id);
  }

  async obtenerPedido(id: string): Promise<Pedido> {
    const fila = await this.repo.buscarPedido(id);
    if (!fila) throw DomainError.noEncontrado('Pedido no encontrado.');
    return (await this.armarPedidos([fila]))[0]!;
  }

  async listarPedidos(
    q: ListarPedidosQuery,
  ): Promise<{ items: Pedido[]; nextCursor: string | null }> {
    const limit = q.limit ?? 50;
    const filas = await this.repo.listarPedidos({
      ...(q.estado ? { estado: q.estado } : {}),
      ...(q.fechaOperativa ? { fechaOperativa: q.fechaOperativa } : {}),
      ...(q.tipo ? { tipo: q.tipo } : {}),
      ...(q.cursor ? { cursor: q.cursor } : {}),
      limit: limit + 1,
    });
    const pagina = filas.slice(0, limit);
    return {
      items: await this.armarPedidos(pagina),
      nextCursor: filas.length > limit ? (pagina[pagina.length - 1]?.id ?? null) : null,
    };
  }

  async agregarItem(pedidoId: string, input: AgregarPedidoItemInput): Promise<Pedido> {
    await this.db.transaction(async (tx) => {
      const p = await this.bloquearAbierto(tx, pedidoId);
      const prod = await this.catalogo.obtenerProductoParaVenta(tx, input.productoId);
      if (!prod) throw DomainError.noEncontrado('Producto no encontrado.');
      if (!prod.activo || prod.agotado) {
        throw new DomainError(
          'PRODUCTO_NO_DISPONIBLE',
          `"${prod.nombre}" no está disponible.`,
          HttpStatus.CONFLICT,
        );
      }
      const existentes = await this.repo.itemsDe([pedidoId], tx);
      await this.repo.insertarItem(
        {
          id: nuevoId(),
          pedidoId,
          productoId: prod.id,
          nombreProducto: prod.nombre,
          precioUnitario: prod.precio,
          cantidad: input.cantidad,
          nota: input.nota ? input.nota : null,
          totalLinea: totalLinea({ precioUnitario: prod.precio, cantidad: input.cantidad }),
          orden: existentes.length,
        },
        tx,
      );
      await this.recalcular(tx, p);
    });
    return this.obtenerPedido(pedidoId);
  }

  /** RN-12/RN-14: cambia cantidad o nota de un ítem mientras el pedido está ABIERTO. */
  async editarItem(pedidoId: string, itemId: string, input: EditarPedidoItemOutput): Promise<Pedido> {
    await this.db.transaction(async (tx) => {
      const p = await this.bloquearAbierto(tx, pedidoId);
      const item = await this.repo.buscarItem(pedidoId, itemId, tx);
      if (!item) throw DomainError.noEncontrado('Ítem no encontrado.');
      const cantidad = input.cantidad ?? item.cantidad;
      await this.repo.actualizarItem(
        itemId,
        {
          cantidad,
          nota: input.nota === undefined ? item.nota : input.nota || null,
          totalLinea: totalLinea({ precioUnitario: item.precioUnitario, cantidad }),
        },
        tx,
      );
      await this.recalcular(tx, p);
    });
    return this.obtenerPedido(pedidoId);
  }

  async quitarItem(pedidoId: string, itemId: string): Promise<Pedido> {
    await this.db.transaction(async (tx) => {
      const p = await this.bloquearAbierto(tx, pedidoId);
      const item = await this.repo.buscarItem(pedidoId, itemId, tx);
      if (!item) throw DomainError.noEncontrado('Ítem no encontrado.');
      await this.repo.borrarItem(itemId, tx);
      await this.recalcular(tx, p);
    });
    return this.obtenerPedido(pedidoId);
  }

  /** RN-20/RN-32/RN-33: descuenta stock y crea la comanda en la misma transacción. */
  async confirmar(pedidoId: string, usuarioId: string): Promise<Pedido> {
    await this.db.transaction(async (tx) => {
      const p = await this.bloquearAbierto(tx, pedidoId);
      await this.confirmarBloqueado(tx, p, usuarioId);
    });
    return this.obtenerPedido(pedidoId);
  }

  /**
   * RN-50: Anulación de pedido (solo ADMIN). Todo en una sola transacción:
   * - pedido -> ANULADO (motivo, usuario, anuladoAt, version + 1).
   * - Si tiene comanda: comanda -> ANULADA.
   * - RN-35, stock:
   *   - comanda PENDIENTE -> movimiento REVERSION (devuelve stock).
   *   - comanda EN_PREPARACION o posterior -> movimiento MERMA (reclasifica como merma, no devuelve stock).
   *   - pedido ABIERTO sin comanda -> no toca stock.
   * - Mesa liberada automáticamente al pasar a ANULADO.
   * - Eventos PedidoAnulado y ComandaAnulada vía EventBus.
   */
  async anular(
    pedidoId: string,
    motivo: string,
    version: number,
    usuarioId: string,
  ): Promise<Pedido> {
    await this.db.transaction(async (tx) => {
      const p = await this.repo.bloquearPedido(pedidoId, tx);
      if (!p) throw DomainError.noEncontrado('Pedido no encontrado.');
      if (p.version !== version) {
        throw new DomainError(
          CODIGOS_ERROR.VERSION_CONFLICT,
          'El pedido fue modificado por otro usuario. Recarga e inténtalo de nuevo.',
          HttpStatus.CONFLICT,
        );
      }
      if (p.estado !== 'ABIERTO' && p.estado !== 'CONFIRMADO') {
        throw new DomainError(
          CODIGOS_ERROR.ESTADO_INVALIDO,
          `El pedido está ${p.estado} y no se puede anular (RN-50).`,
          HttpStatus.CONFLICT,
        );
      }

      // Si tiene comanda, anular comanda y procesar inventario según estado de la comanda
      const comandaAnulada = await this.cocina.anularComanda(tx, p.id);
      if (comandaAnulada) {
        const items = await this.repo.itemsDe([p.id], tx);
        const itemsConsumo = items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad }));

        if (comandaAnulada.estadoPrevio === 'PENDIENTE') {
          // RN-35: comanda PENDIENTE -> movimiento REVERSION (devuelve stock)
          await this.inventario.revertir(tx, itemsConsumo, usuarioId, p.id);
        } else {
          // RN-35: comanda EN_PREPARACION o posterior -> movimiento MERMA (reclasifica como merma, no devuelve stock)
          await this.inventario.reclasificarConsumoComoMerma(tx, itemsConsumo, usuarioId, motivo, p.id);
        }

        await this.eventBus.publicarEnTx(tx, {
          tipo: 'ComandaAnulada',
          modulo: 'cocina',
          agregadoId: comandaAnulada.comandaId,
          usuarioId,
          payload: {
            comandaId: comandaAnulada.comandaId,
            pedidoId: p.id,
            numeroDia: p.numeroDia,
            motivo,
          },
        });
      }

      await this.repo.actualizarPedido(
        p.id,
        {
          estado: 'ANULADO',
          anuladoAt: new Date(),
          anuladoPor: usuarioId,
          motivoAnulacion: motivo,
          version: p.version + 1,
        },
        tx,
      );

      await this.eventBus.publicarEnTx(tx, {
        tipo: 'PedidoAnulado',
        modulo: 'pedidos',
        agregadoId: p.id,
        usuarioId,
        payload: {
          pedidoId: p.id,
          numeroDia: p.numeroDia,
          motivo,
          mesaId: p.mesaId,
        },
      });
    });

    return this.obtenerPedido(pedidoId);
  }

  // --- API pública para caja ---

  /** Prepara el cobro dentro de la tx de caja: confirma si estaba ABIERTO (RN-44). */
  async prepararCobro(tx: Tx, pedidoId: string, usuarioId: string): Promise<PedidoParaCobro> {
    let p = await this.repo.bloquearPedido(pedidoId, tx);
    if (!p) throw DomainError.noEncontrado('Pedido no encontrado.');
    if (p.estado === 'ABIERTO') p = await this.confirmarBloqueado(tx, p, usuarioId);
    if (p.estado !== 'CONFIRMADO') {
      throw new DomainError(
        CODIGOS_ERROR.ESTADO_INVALIDO,
        `El pedido está ${p.estado} y no se puede cobrar.`,
        HttpStatus.CONFLICT,
      );
    }
    return { id: p.id, numeroDia: p.numeroDia, total: p.total, base: p.base, impuesto: p.impuesto };
  }

  async cerrar(tx: Tx, pedidoId: string): Promise<void> {
    const p = await this.repo.bloquearPedido(pedidoId, tx);
    if (!p) throw DomainError.noEncontrado('Pedido no encontrado.');
    await this.repo.actualizarPedido(
      pedidoId,
      { estado: 'CERRADO', cerradoAt: new Date(), version: p.version + 1 },
      tx,
    );
  }

  // --- Internos ---

  private async bloquearAbierto(tx: Tx, pedidoId: string): Promise<PedidoFila> {
    const p = await this.repo.bloquearPedido(pedidoId, tx);
    if (!p) throw DomainError.noEncontrado('Pedido no encontrado.');
    if (p.estado !== 'ABIERTO') {
      throw new DomainError(
        CODIGOS_ERROR.ESTADO_INVALIDO,
        `El pedido está ${p.estado}; solo se edita o confirma en ABIERTO (RN-14).`,
        HttpStatus.CONFLICT,
      );
    }
    return p;
  }

  private async confirmarBloqueado(tx: Tx, p: PedidoFila, usuarioId: string): Promise<PedidoFila> {
    const items = await this.repo.itemsDe([p.id], tx);
    if (items.length === 0) {
      throw new DomainError(
        'PEDIDO_VACIO',
        'El pedido necesita al menos un ítem (RN-12).',
        HttpStatus.CONFLICT,
      );
    }
    await this.inventario.consumir(
      tx,
      items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })),
      usuarioId,
      p.id,
    );
    const mesaNombre = p.mesaId
      ? ((await this.repo.mesasPorIds([p.mesaId], tx))[0]?.nombre ?? null)
      : null;
    const comandaId = await this.cocina.crearComanda(tx, {
      pedidoId: p.id,
      numeroDia: p.numeroDia,
      tipoPedido: p.tipo,
      mesaNombre,
      items: items.map((i) => ({ nombre: i.nombreProducto, cantidad: i.cantidad, nota: i.nota })),
    });
    const actualizado = await this.repo.actualizarPedido(
      p.id,
      { estado: 'CONFIRMADO', confirmadoAt: new Date(), version: p.version + 1 },
      tx,
    );
    await this.eventBus.publicarEnTx(tx, {
      tipo: 'PedidoConfirmado',
      modulo: 'pedidos',
      agregadoId: p.id,
      usuarioId,
      payload: { comandaId, pedidoId: p.id, numeroDia: p.numeroDia },
    });
    return actualizado;
  }

  private async recalcular(tx: Executor, p: PedidoFila): Promise<void> {
    const items = await this.repo.itemsDe([p.id], tx);
    const t = calcularTotales(
      items.map((i) => ({ precioUnitario: i.precioUnitario, cantidad: i.cantidad })),
      await leerTasaImpuestoBp(tx),
    );
    await this.repo.actualizarPedido(
      p.id,
      { total: t.total, base: t.base, impuesto: t.impuesto, version: p.version + 1 },
      tx,
    );
  }

  private async armarPedidos(filas: PedidoFila[]): Promise<Pedido[]> {
    const ids = filas.map((f) => f.id);
    const [items, estados, mesas] = await Promise.all([
      this.repo.itemsDe(ids),
      this.cocina.estadosPorPedidos(ids),
      this.repo.mesasPorIds(filas.flatMap((f) => (f.mesaId ? [f.mesaId] : []))),
    ]);
    const nombreMesa = new Map(mesas.map((m) => [m.id, m.nombre]));
    return filas.map((f) => ({
      id: f.id,
      numeroDia: f.numeroDia,
      fechaOperativa: f.fechaOperativa,
      tipo: f.tipo,
      mesa: f.mesaId ? { id: f.mesaId, nombre: nombreMesa.get(f.mesaId) ?? '' } : null,
      clienteId: f.clienteId,
      usuarioId: f.usuarioId,
      estado: f.estado,
      estadoComanda: estados.get(f.id) ?? null,
      items: items.filter((i) => i.pedidoId === f.id).map((i) => this.mapearItem(i)),
      total: f.total,
      base: f.base,
      impuesto: f.impuesto,
      nota: f.nota,
      version: f.version,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
      confirmadoAt: f.confirmadoAt?.toISOString() ?? null,
      cerradoAt: f.cerradoAt?.toISOString() ?? null,
      anuladoAt: f.anuladoAt?.toISOString() ?? null,
    }));
  }

  private mapearItem(i: PedidoItemFila) {
    return {
      id: i.id,
      productoId: i.productoId,
      nombre: i.nombreProducto,
      precioUnitario: i.precioUnitario,
      cantidad: i.cantidad,
      nota: i.nota,
      totalLinea: i.totalLinea,
      orden: i.orden,
    };
  }

  // --- Mesas ---

  async crearMesa(input: CrearMesaInput): Promise<Mesa> {
    const existente = await this.repo.buscarMesaPorNombre(input.nombre.trim());
    if (existente) {
      throw new DomainError(
        'MESA_DUPLICADA',
        `Ya existe una mesa con el nombre "${input.nombre}".`,
        HttpStatus.CONFLICT,
      );
    }

    try {
      const fila = await this.repo.crearMesa({
        id: nuevoId(),
        nombre: input.nombre.trim(),
        capacidad: input.capacidad ?? 4,
        activa: input.activa ?? true,
        orden: input.orden ?? 0,
      });
      return this.mapearMesa(fila);
    } catch (err: unknown) {
      if (esViolacionUnicidad(err)) {
        throw new DomainError(
          'MESA_DUPLICADA',
          `Ya existe una mesa con el nombre "${input.nombre}".`,
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
  }

  async listarMesas(): Promise<MesaConEstado[]> {
    const [filas, activos] = await Promise.all([
      this.repo.listarMesas(),
      this.repo.pedidosActivosPorMesa(),
    ]);
    const porMesa = new Map(activos.map((a) => [a.mesaId, a.pedidoId]));
    return filas.map((fila) => ({
      ...this.mapearMesa(fila),
      ocupada: porMesa.has(fila.id),
      pedidoId: porMesa.get(fila.id) ?? null,
    }));
  }

  async buscarMesaPorId(id: string): Promise<Mesa> {
    const fila = await this.repo.buscarMesaPorId(id);
    if (!fila) {
      throw DomainError.noEncontrado(`No se encontró la mesa con ID "${id}".`);
    }
    return this.mapearMesa(fila);
  }

  async editarMesa(id: string, input: EditarMesaInput): Promise<Mesa> {
    const actual = await this.repo.buscarMesaPorId(id);
    if (!actual) {
      throw DomainError.noEncontrado(`No se encontró la mesa con ID "${id}".`);
    }

    if (input.nombre && input.nombre.trim() !== actual.nombre) {
      const colision = await this.repo.buscarMesaPorNombre(input.nombre.trim());
      if (colision && colision.id !== id) {
        throw new DomainError(
          'MESA_DUPLICADA',
          `Ya existe otra mesa con el nombre "${input.nombre}".`,
          HttpStatus.CONFLICT,
        );
      }
    }

    const fila = await this.repo.actualizarMesa(id, {
      ...(input.nombre !== undefined ? { nombre: input.nombre.trim() } : {}),
      ...(input.capacidad !== undefined ? { capacidad: input.capacidad } : {}),
      ...(input.activa !== undefined ? { activa: input.activa } : {}),
      ...(input.orden !== undefined ? { orden: input.orden } : {}),
    });

    return this.mapearMesa(fila!);
  }

  async reordenarMesas(input: ReordenarMesasInput): Promise<MesaConEstado[]> {
    await this.repo.reordenarMesas(input.mesas);
    return this.listarMesas();
  }

  private mapearMesa(fila: MesaFila): Mesa {
    return {
      id: fila.id,
      nombre: fila.nombre,
      capacidad: fila.capacidad,
      activa: fila.activa,
      orden: fila.orden,
    };
  }
}
