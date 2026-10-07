import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { TipoMovimientoInventario, Unidad } from '@mb/shared';
import { configuracion } from '../../shared-kernel/configuracion/configuracion.schema';
import { DB, type Db, type Executor, type Tx } from '../../shared-kernel/db/db';
import { DomainError } from '../../shared-kernel/errors/domain-error';
import { EventBus } from '../../shared-kernel/events/event-bus';
import { nuevoId } from '../../shared-kernel/ids';
import { CatalogoPublicService } from '../catalogo/catalogo.public';
import { InventarioRepository } from './inventario.repository';

export interface ItemConsumoOReversion {
  productoId?: string;
  ingredienteId?: string;
  cantidad: number;
}

export interface DetalleFaltante {
  ingredienteId: string;
  nombre: string;
  requerido: number;
  disponible: number;
  unidad: string;
}

@Injectable()
export class InventarioService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly repo: InventarioRepository,
    private readonly catalogoPublic: CatalogoPublicService,
    private readonly eventBus: EventBus,
  ) {}

  // --- CRUD Ingredientes ---

  async listar(filtros: { stockBajo?: boolean; limit?: number; cursor?: string } = {}) {
    return this.repo.listarIngredientes(filtros);
  }

  async obtenerPorId(id: string) {
    const ing = await this.repo.obtenerIngredientePorId(id);
    if (!ing) throw DomainError.noEncontrado('Ingrediente no encontrado.');
    return ing;
  }

  async obtenerIngredientesPorIds(ids: string[]) {
    return this.repo.obtenerIngredientesPorIds(ids);
  }

  async crear(datos: {
    nombre: string;
    unidad: Unidad;
    stockMinimo?: number;
    costoUnitario?: number;
    activo?: boolean;
  }) {
    const id = nuevoId();
    try {
      return await this.repo.crearIngrediente({
        id,
        nombre: datos.nombre,
        unidad: datos.unidad,
        stockMinimo: datos.stockMinimo,
        costoUnitario: datos.costoUnitario,
        activo: datos.activo,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('unique')) {
        throw new DomainError(
          'NOMBRE_DUPLICADO',
          'Ya existe un ingrediente con ese nombre.',
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
  }

  async editar(
    id: string,
    datos: {
      nombre?: string;
      stockMinimo?: number;
      costoUnitario?: number;
      activo?: boolean;
    },
  ) {
    const existente = await this.repo.obtenerIngredientePorId(id);
    if (!existente) throw DomainError.noEncontrado('Ingrediente no encontrado.');

    try {
      const actualizado = await this.repo.editarIngrediente(id, datos);
      if (!actualizado) throw DomainError.noEncontrado('Ingrediente no encontrado.');
      return actualizado;
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('unique')) {
        throw new DomainError(
          'NOMBRE_DUPLICADO',
          'Ya existe un ingrediente con ese nombre.',
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
  }

  async listarKardex(ingredienteId: string, paginacion: { limit?: number; cursor?: string } = {}) {
    const ing = await this.repo.obtenerIngredientePorId(ingredienteId);
    if (!ing) throw DomainError.noEncontrado('Ingrediente no encontrado.');
    return this.repo.listarMovimientosKardex(ingredienteId, paginacion);
  }

  // --- Operaciones de Inventario ---

  /**
   * Registra una ENTRADA de inventario (compra/proveedor).
   * Incrementa el stock y emite IngredienteRepuesto si correspondía (RN-36).
   */
  async registrarEntrada(
    usuarioId: string,
    datos: {
      items: Array<{ ingredienteId: string; cantidad: number; costoUnitario?: number }>;
      nota?: string | null;
    },
  ) {
    return this.db.transaction(async (tx) => {
      const ids = datos.items.map((i) => i.ingredienteId);
      const ingredientes = await this.repo.bloquearIngredientesParaActualizar(ids, tx);
      const mapa = new Map(ingredientes.map((ing) => [ing.id, ing]));

      const resultados = [];
      for (const item of datos.items) {
        const ing = mapa.get(item.ingredienteId);
        if (!ing) {
          throw DomainError.noEncontrado(`Ingrediente no encontrado: ${item.ingredienteId}`);
        }

        const stockAnterior = Number(ing.stockActual);
        const nuevoStock = stockAnterior + item.cantidad;

        await this.repo.actualizarStock(ing.id, nuevoStock, tx);
        if (item.costoUnitario !== undefined) {
          await this.repo.editarIngrediente(ing.id, { costoUnitario: item.costoUnitario }, tx);
        }

        const mov = await this.repo.insertarMovimiento(
          {
            id: nuevoId(),
            ingredienteId: ing.id,
            tipo: 'ENTRADA',
            cantidad: item.cantidad,
            stockResultante: nuevoStock,
            referenciaTipo: 'ENTRADA',
            usuarioId,
            motivo: datos.nota ?? 'Entrada de inventario',
          },
          tx,
        );

        // RN-36: si estaba agotado/en cero o menos y ahora tiene stock positivo, emite IngredienteRepuesto
        if (stockAnterior <= 0 && nuevoStock > 0) {
          await this.eventBus.publicarEnTx(tx, {
            tipo: 'IngredienteRepuesto',
            modulo: 'inventario',
            agregadoId: ing.id,
            usuarioId,
            payload: { ingredienteId: ing.id, nombre: ing.nombre, stockActual: nuevoStock },
          });
        }

        resultados.push(mov);
      }

      return { items: resultados };
    });
  }

  /**
   * Registra un AJUSTE por conteo físico (RN-34).
   * La cantidad del movimiento es la diferencia (stockContado - stockActual).
   */
  async registrarAjuste(
    usuarioId: string,
    datos: {
      ingredienteId: string;
      stockContado: number;
      motivo: string;
    },
  ) {
    return this.db.transaction(async (tx) => {
      const [ing] = await this.repo.bloquearIngredientesParaActualizar([datos.ingredienteId], tx);
      if (!ing) throw DomainError.noEncontrado('Ingrediente no encontrado.');

      const stockAnterior = Number(ing.stockActual);
      const diferencia = datos.stockContado - stockAnterior;

      if (diferencia === 0) {
        return {
          id: nuevoId(),
          ingredienteId: ing.id,
          tipo: 'AJUSTE' as TipoMovimientoInventario,
          cantidad: 0,
          stockResultante: stockAnterior,
          motivo: datos.motivo,
        };
      }

      await this.repo.actualizarStock(ing.id, datos.stockContado, tx);
      const mov = await this.repo.insertarMovimiento(
        {
          id: nuevoId(),
          ingredienteId: ing.id,
          tipo: 'AJUSTE',
          cantidad: diferencia,
          stockResultante: datos.stockContado,
          referenciaTipo: 'CONTEO',
          usuarioId,
          motivo: datos.motivo,
        },
        tx,
      );

      // Eventos RN-36
      if (stockAnterior > ing.stockMinimo && datos.stockContado <= ing.stockMinimo) {
        await this.eventBus.publicarEnTx(tx, {
          tipo: 'StockBajoMinimo',
          modulo: 'inventario',
          agregadoId: ing.id,
          usuarioId,
          payload: {
            ingredienteId: ing.id,
            nombre: ing.nombre,
            stockActual: datos.stockContado,
            stockMinimo: ing.stockMinimo,
            unidad: ing.unidad,
          },
        });
      }

      if (datos.stockContado <= 0) {
        await this.eventBus.publicarEnTx(tx, {
          tipo: 'IngredienteAgotado',
          modulo: 'inventario',
          agregadoId: ing.id,
          usuarioId,
          payload: { ingredienteId: ing.id, nombre: ing.nombre, stockActual: datos.stockContado },
        });
      } else if (stockAnterior <= 0 && datos.stockContado > 0) {
        await this.eventBus.publicarEnTx(tx, {
          tipo: 'IngredienteRepuesto',
          modulo: 'inventario',
          agregadoId: ing.id,
          usuarioId,
          payload: { ingredienteId: ing.id, nombre: ing.nombre, stockActual: datos.stockContado },
        });
      }

      return mov;
    });
  }

  /**
   * Registra una MERMA manual (desperdicio, comida dañada).
   */
  async registrarMermaManual(
    usuarioId: string,
    datos: {
      ingredienteId: string;
      cantidad: number;
      motivo: string;
    },
  ) {
    return this.db.transaction(async (tx) => {
      await this.registrarMerma(
        tx,
        [{ ingredienteId: datos.ingredienteId, cantidad: datos.cantidad }],
        usuarioId,
        datos.motivo,
      );
      return { ok: true };
    });
  }

  // --- API Pública para otros módulos (RN-32, RN-33, RN-35) ---

  /**
   * RN-32: Consumo atómico con SELECT ... FOR UPDATE en orden ascendente de ingredienteId.
   * RN-33: Si no alcanza stock → 409 STOCK_INSUFICIENTE con detalle de faltantes.
   */
  async consumir(
    tx: Tx,
    items: ItemConsumoOReversion[],
    usuarioId: string,
    referenciaId?: string,
  ): Promise<void> {
    const requeridos = await this.agruparRequerimientos(tx, items);
    if (requeridos.size === 0) return;

    const idsOrdenados = Array.from(requeridos.keys()).sort();
    const ingredientes = await this.repo.bloquearIngredientesParaActualizar(idsOrdenados, tx);
    const mapa = new Map(ingredientes.map((i) => [i.id, i]));

    const permitirStockNegativo = await this.consultarPermitirStockNegativo(tx);
    const faltantes: DetalleFaltante[] = [];

    for (const [id, cantRequerida] of requeridos.entries()) {
      const ing = mapa.get(id);
      const disponible = ing ? Number(ing.stockActual) : 0;
      if (!ing || disponible < cantRequerida) {
        faltantes.push({
          ingredienteId: id,
          nombre: ing?.nombre ?? 'Desconocido',
          requerido: cantRequerida,
          disponible,
          unidad: ing?.unidad ?? 'UND',
        });
      }
    }

    if (!permitirStockNegativo && faltantes.length > 0) {
      throw new DomainError(
        'STOCK_INSUFICIENTE',
        'No hay suficiente stock para confirmar el pedido.',
        HttpStatus.CONFLICT,
        { faltantes },
      );
    }

    for (const [id, cantRequerida] of requeridos.entries()) {
      const ing = mapa.get(id)!;
      const stockAnterior = Number(ing.stockActual);
      const nuevoStock = stockAnterior - cantRequerida;

      await this.repo.actualizarStock(id, nuevoStock, tx);
      await this.repo.insertarMovimiento(
        {
          id: nuevoId(),
          ingredienteId: id,
          tipo: 'CONSUMO',
          cantidad: -cantRequerida,
          stockResultante: nuevoStock,
          referenciaTipo: 'PEDIDO',
          referenciaId: referenciaId ?? null,
          usuarioId,
          motivo: 'Consumo por pedido',
        },
        tx,
      );

      // Eventos RN-36
      if (stockAnterior > ing.stockMinimo && nuevoStock <= ing.stockMinimo) {
        await this.eventBus.publicarEnTx(tx, {
          tipo: 'StockBajoMinimo',
          modulo: 'inventario',
          agregadoId: id,
          usuarioId,
          payload: {
            ingredienteId: id,
            nombre: ing.nombre,
            stockActual: nuevoStock,
            stockMinimo: ing.stockMinimo,
            unidad: ing.unidad,
          },
        });
      }

      if (nuevoStock <= 0) {
        await this.eventBus.publicarEnTx(tx, {
          tipo: 'IngredienteAgotado',
          modulo: 'inventario',
          agregadoId: id,
          usuarioId,
          payload: { ingredienteId: id, nombre: ing.nombre, stockActual: nuevoStock },
        });
      }
    }
  }

  /**
   * RN-35: Reversión de consumo (comanda estaba PENDIENTE).
   * El stock vuelve con movimiento REVERSION.
   */
  async revertir(
    tx: Tx,
    items: ItemConsumoOReversion[],
    usuarioId: string,
    referenciaId?: string,
  ): Promise<void> {
    const cantidades = await this.agruparRequerimientos(tx, items);
    if (cantidades.size === 0) return;

    const idsOrdenados = Array.from(cantidades.keys()).sort();
    const ingredientes = await this.repo.bloquearIngredientesParaActualizar(idsOrdenados, tx);
    const mapa = new Map(ingredientes.map((i) => [i.id, i]));

    for (const [id, cantARevertir] of cantidades.entries()) {
      const ing = mapa.get(id);
      if (!ing) continue;

      const stockAnterior = Number(ing.stockActual);
      const nuevoStock = stockAnterior + cantARevertir;

      await this.repo.actualizarStock(id, nuevoStock, tx);
      await this.repo.insertarMovimiento(
        {
          id: nuevoId(),
          ingredienteId: id,
          tipo: 'REVERSION',
          cantidad: cantARevertir,
          stockResultante: nuevoStock,
          referenciaTipo: 'PEDIDO',
          referenciaId: referenciaId ?? null,
          usuarioId,
          motivo: 'Reversión por anulación',
        },
        tx,
      );

      if (stockAnterior <= 0 && nuevoStock > 0) {
        await this.eventBus.publicarEnTx(tx, {
          tipo: 'IngredienteRepuesto',
          modulo: 'inventario',
          agregadoId: id,
          usuarioId,
          payload: { ingredienteId: id, nombre: ing.nombre, stockActual: nuevoStock },
        });
      }
    }
  }

  /**
   * RN-35: Registra merma en transacción (por cancelación de pedido en preparación o merma directa).
   */
  async registrarMerma(
    tx: Tx,
    items: Array<{ ingredienteId: string; cantidad: number }>,
    usuarioId: string,
    motivo: string,
    referenciaId?: string,
  ): Promise<void> {
    if (items.length === 0) return;
    const requeridos = new Map<string, number>();
    for (const it of items) {
      requeridos.set(it.ingredienteId, (requeridos.get(it.ingredienteId) ?? 0) + it.cantidad);
    }

    const idsOrdenados = Array.from(requeridos.keys()).sort();
    const ingredientes = await this.repo.bloquearIngredientesParaActualizar(idsOrdenados, tx);
    const mapa = new Map(ingredientes.map((i) => [i.id, i]));

    const permitirStockNegativo = await this.consultarPermitirStockNegativo(tx);
    const faltantes: DetalleFaltante[] = [];

    for (const [id, req] of requeridos.entries()) {
      const ing = mapa.get(id);
      const disponible = ing ? Number(ing.stockActual) : 0;
      if (!ing || disponible < req) {
        faltantes.push({
          ingredienteId: id,
          nombre: ing?.nombre ?? 'Desconocido',
          requerido: req,
          disponible,
          unidad: ing?.unidad ?? 'UND',
        });
      }
    }

    if (!permitirStockNegativo && faltantes.length > 0) {
      throw new DomainError(
        'STOCK_INSUFICIENTE',
        'No hay suficiente stock para registrar la merma.',
        HttpStatus.CONFLICT,
        { faltantes },
      );
    }

    for (const [id, req] of requeridos.entries()) {
      const ing = mapa.get(id)!;
      const stockAnterior = Number(ing.stockActual);
      const nuevoStock = stockAnterior - req;

      await this.repo.actualizarStock(id, nuevoStock, tx);
      await this.repo.insertarMovimiento(
        {
          id: nuevoId(),
          ingredienteId: id,
          tipo: 'MERMA',
          cantidad: -req,
          stockResultante: nuevoStock,
          referenciaTipo: 'MERMA',
          referenciaId: referenciaId ?? null,
          usuarioId,
          motivo,
        },
        tx,
      );

      if (stockAnterior > ing.stockMinimo && nuevoStock <= ing.stockMinimo) {
        await this.eventBus.publicarEnTx(tx, {
          tipo: 'StockBajoMinimo',
          modulo: 'inventario',
          agregadoId: id,
          usuarioId,
          payload: {
            ingredienteId: id,
            nombre: ing.nombre,
            stockActual: nuevoStock,
            stockMinimo: ing.stockMinimo,
            unidad: ing.unidad,
          },
        });
      }

      if (nuevoStock <= 0) {
        await this.eventBus.publicarEnTx(tx, {
          tipo: 'IngredienteAgotado',
          modulo: 'inventario',
          agregadoId: id,
          usuarioId,
          payload: { ingredienteId: id, nombre: ing.nombre, stockActual: nuevoStock },
        });
      }
    }
  }

  /**
   * RN-35: anulación con la comanda ya iniciada. El consumo (CONSUMO) ya descontó el stock y NO vuelve,
   * así que no se descuenta de nuevo: el consumo se reclasifica como pérdida con un par REVERSION (+)
   * y MERMA (−) de efecto neto cero en `stock_actual`, que deja la pérdida trazada en el kardex.
   */
  async reclasificarConsumoComoMerma(
    tx: Tx,
    items: ItemConsumoOReversion[],
    usuarioId: string,
    motivo: string,
    referenciaId?: string,
  ): Promise<void> {
    const cantidades = await this.agruparRequerimientos(tx, items);
    if (cantidades.size === 0) return;

    const idsOrdenados = Array.from(cantidades.keys()).sort();
    const ingredientes = await this.repo.bloquearIngredientesParaActualizar(idsOrdenados, tx);
    const mapa = new Map(ingredientes.map((i) => [i.id, i]));

    for (const [id, cantidad] of cantidades.entries()) {
      const ing = mapa.get(id);
      if (!ing) continue;
      const stock = Number(ing.stockActual);
      for (const [tipo, signo] of [['REVERSION', 1], ['MERMA', -1]] as const) {
        await this.repo.insertarMovimiento(
          {
            id: nuevoId(),
            ingredienteId: id,
            tipo,
            cantidad: signo * cantidad,
            stockResultante: stock,
            referenciaTipo: 'PEDIDO',
            referenciaId: referenciaId ?? null,
            usuarioId,
            motivo,
          },
          tx,
        );
      }
    }
  }

  // --- Auxiliares privados ---

  private async agruparRequerimientos(
    tx: Executor,
    items: ItemConsumoOReversion[],
  ): Promise<Map<string, number>> {
    const directos: Array<{ ingredienteId: string; cantidad: number }> = [];
    const deProductos: Array<{ productoId: string; cantidad: number }> = [];

    for (const it of items) {
      if (it.ingredienteId) {
        directos.push({ ingredienteId: it.ingredienteId, cantidad: it.cantidad });
      } else if (it.productoId) {
        deProductos.push({ productoId: it.productoId, cantidad: it.cantidad });
      }
    }

    const resueltos = await this.catalogoPublic.resolverRecetas(tx, deProductos);
    const requeridos = new Map<string, number>();

    for (const it of [...directos, ...resueltos]) {
      requeridos.set(it.ingredienteId, (requeridos.get(it.ingredienteId) ?? 0) + it.cantidad);
    }

    return requeridos;
  }

  private async consultarPermitirStockNegativo(executor: Executor): Promise<boolean> {
    const [cfg] = await executor
      .select()
      .from(configuracion)
      .where(eq(configuracion.clave, 'permitir_stock_negativo'));
    return cfg?.valor === true || cfg?.valor === 'true';
  }
}
