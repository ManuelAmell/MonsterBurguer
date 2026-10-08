import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, lt, sql } from 'drizzle-orm';
import {
  CODIGOS_ERROR,
  NOMBRE_IMPUESTO,
  type BuscarSesionesQuery,
  type CobroInput,
  type CobroRespuesta,
  type MovimientoCaja,
  type MovimientoCajaInput,
  type ResumenCierre,
  type SesionCaja,
  type SesionCajaDetalle,
  type SesionesPaginadasRespuesta,
  type UsuarioSesion,
} from '@mb/shared';
import {
  leerConfiguracion,
  leerRegimen,
} from '../../shared-kernel/configuracion/configuracion.lector';
import { TASA_IMPUESTO_BP } from '@mb/shared';
import { DB, esViolacionUnicidad, type Db, type Executor } from '../../shared-kernel/db/db';
import { DomainError } from '../../shared-kernel/errors/domain-error';
import { EventBus } from '../../shared-kernel/events/event-bus';
import { nuevoId } from '../../shared-kernel/ids';
import { IdentidadPublicService } from '../identidad/identidad.public';
import { PedidosService } from '../pedidos/pedidos.public';
import { movimientoCaja, pago, recibo, sesionCaja } from './caja.schema';

type SesionFila = typeof sesionCaja.$inferSelect;

export const formatoNumeroRecibo = (n: number): string => `R-${String(n).padStart(6, '0')}`;

@Injectable()
export class CajaService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly eventBus: EventBus,
    private readonly pedidos: PedidosService,
    private readonly identidad: IdentidadPublicService,
  ) {}

  // --- Sesión de caja (RN-40, RN-41, RN-47) ---

  async sesionActual(
    usuarioId: string,
  ): Promise<
    | (SesionCaja & {
        ventasEfectivo: number;
        ventasTarjeta: number;
        ventasTransferencia: number;
        ingresos: number;
        retiros: number;
      })
    | null
  > {
    const [fila] = await this.db
      .select()
      .from(sesionCaja)
      .where(and(eq(sesionCaja.usuarioId, usuarioId), eq(sesionCaja.estado, 'ABIERTA')))
      .limit(1);
    if (!fila) return null;
    const metodos = await this.ventasPorMetodo(this.db, fila.id);
    const ingresos = await this.totalMovimientos(this.db, fila.id, 'INGRESO');
    const retiros = await this.totalMovimientos(this.db, fila.id, 'RETIRO');
    const efectivoEsperado = fila.montoApertura + metodos.efectivo + ingresos - retiros;
    return {
      ...this.mapearSesion({ ...fila, efectivoEsperado }),
      ventasEfectivo: metodos.efectivo,
      ventasTarjeta: metodos.tarjeta,
      ventasTransferencia: metodos.transferencia,
      ingresos,
      retiros,
    };
  }

  async abrir(usuarioId: string, montoApertura: number): Promise<SesionCaja> {
    try {
      const [fila] = await this.db
        .insert(sesionCaja)
        .values({ id: nuevoId(), usuarioId, montoApertura })
        .returning();
      return this.mapearSesion(fila!);
    } catch (err: unknown) {
      if (esViolacionUnicidad(err)) {
        throw new DomainError(
          'SESION_YA_ABIERTA',
          'Ya tienes una sesión de caja abierta (RN-40).',
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
  }

  async cerrar(
    sesionId: string,
    usuario: UsuarioSesion,
    efectivoContado: number,
  ): Promise<ResumenCierre> {
    return this.db.transaction(async (tx) => {
      const [sesion] = await tx
        .select()
        .from(sesionCaja)
        .where(eq(sesionCaja.id, sesionId))
        .limit(1)
        .for('update');
      if (!sesion) throw DomainError.noEncontrado('Sesión de caja no encontrada.');
      if (sesion.usuarioId !== usuario.id && usuario.rol !== 'ADMIN') throw DomainError.sinPermiso();
      if (sesion.estado !== 'ABIERTA') {
        throw new DomainError(
          CODIGOS_ERROR.ESTADO_INVALIDO,
          'La sesión ya está cerrada.',
          HttpStatus.CONFLICT,
        );
      }
      const ventasEfectivo = await this.ventasEfectivo(tx, sesionId);
      const ingresos = await this.totalMovimientos(tx, sesionId, 'INGRESO');
      const retiros = await this.totalMovimientos(tx, sesionId, 'RETIRO');
      const efectivoEsperado = sesion.montoApertura + ventasEfectivo + ingresos - retiros;
      const diferencia = efectivoContado - efectivoEsperado;
      const cerradaAt = new Date();
      await tx
        .update(sesionCaja)
        .set({
          estado: 'CERRADA',
          efectivoEsperado,
          efectivoContado,
          diferencia,
          cerradaAt,
          version: sesion.version + 1,
        })
        .where(eq(sesionCaja.id, sesionId));
      await this.eventBus.publicarEnTx(tx, {
        tipo: 'SesionCajaCerrada',
        modulo: 'caja',
        agregadoId: sesionId,
        usuarioId: usuario.id,
        payload: {
          sesionId,
          efectivoEsperado,
          efectivoContado,
          diferencia,
          ingresos,
          retiros,
        },
      });
      return {
        sesionId,
        montoApertura: sesion.montoApertura,
        ventasEfectivo,
        ingresos,
        retiros,
        efectivoEsperado,
        efectivoContado,
        diferencia,
        cerradaAt: cerradaAt.toISOString(),
      };
    });
  }

  // --- Movimientos manuales de caja (RN-46) ---

  async registrarMovimiento(
    sesionId: string,
    input: MovimientoCajaInput,
    usuario: UsuarioSesion,
  ): Promise<MovimientoCaja> {
    return this.db.transaction(async (tx) => {
      const [sesion] = await tx
        .select()
        .from(sesionCaja)
        .where(eq(sesionCaja.id, sesionId))
        .limit(1)
        .for('update');
      if (!sesion) throw DomainError.noEncontrado('Sesión de caja no encontrada.');
      if (sesion.usuarioId !== usuario.id && usuario.rol !== 'ADMIN') {
        throw DomainError.sinPermiso();
      }
      if (sesion.estado !== 'ABIERTA') {
        throw new DomainError(
          CODIGOS_ERROR.ESTADO_INVALIDO,
          'No se pueden registrar movimientos en una sesión cerrada (RN-46).',
          HttpStatus.CONFLICT,
        );
      }

      const ventasEf = await this.ventasEfectivo(tx, sesionId);
      const ingresos = await this.totalMovimientos(tx, sesionId, 'INGRESO');
      const retiros = await this.totalMovimientos(tx, sesionId, 'RETIRO');
      const efectivoEsperado = sesion.montoApertura + ventasEf + ingresos - retiros;

      if (input.tipo === 'RETIRO' && efectivoEsperado - input.monto < 0) {
        throw new DomainError(
          'EFECTIVO_INSUFICIENTE',
          'El retiro no puede dejar el efectivo esperado en negativo (RN-46).',
          HttpStatus.CONFLICT,
          { efectivoEsperado, montoRetiro: input.monto },
        );
      }

      const id = nuevoId();
      const [mov] = await tx
        .insert(movimientoCaja)
        .values({
          id,
          sesionCajaId: sesion.id,
          tipo: input.tipo,
          monto: input.monto,
          motivo: input.motivo.trim(),
          usuarioId: usuario.id,
        })
        .returning();

      await this.eventBus.publicarEnTx(tx, {
        tipo: 'MovimientoCajaRegistrado',
        modulo: 'caja',
        agregadoId: mov!.id,
        usuarioId: usuario.id,
        payload: {
          movimientoId: mov!.id,
          sesionId: sesion.id,
          tipo: mov!.tipo,
          monto: mov!.monto,
          motivo: mov!.motivo,
        },
      });

      return {
        id: mov!.id,
        sesionCajaId: mov!.sesionCajaId,
        tipo: mov!.tipo as 'INGRESO' | 'RETIRO',
        monto: mov!.monto,
        motivo: mov!.motivo,
        usuarioId: mov!.usuarioId,
        createdAt: mov!.createdAt.toISOString(),
      };
    });
  }

  async listarMovimientos(
    sesionId: string,
    usuario: UsuarioSesion,
  ): Promise<MovimientoCaja[]> {
    const [sesion] = await this.db
      .select()
      .from(sesionCaja)
      .where(eq(sesionCaja.id, sesionId))
      .limit(1);
    if (!sesion) throw DomainError.noEncontrado('Sesión de caja no encontrada.');
    if (sesion.usuarioId !== usuario.id && usuario.rol !== 'ADMIN') {
      throw DomainError.sinPermiso();
    }

    const filas = await this.db
      .select()
      .from(movimientoCaja)
      .where(eq(movimientoCaja.sesionCajaId, sesionId))
      .orderBy(asc(movimientoCaja.createdAt), asc(movimientoCaja.id));

    return filas.map((m) => ({
      id: m.id,
      sesionCajaId: m.sesionCajaId,
      tipo: m.tipo as 'INGRESO' | 'RETIRO',
      monto: m.monto,
      motivo: m.motivo,
      usuarioId: m.usuarioId,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  // --- Historial de cierres de caja ---

  async listarSesiones(
    query: BuscarSesionesQuery,
    usuario: UsuarioSesion,
  ): Promise<SesionesPaginadasRespuesta> {
    const condiciones = [];

    // ADMIN ve todas las sesiones; CAJERO solo las suyas
    if (usuario.rol !== 'ADMIN') {
      condiciones.push(eq(sesionCaja.usuarioId, usuario.id));
    }

    // Filtro por fecha operativa de apertura (desde / hasta inclusivos)
    if (query.desde) {
      const inicioUtc = new Date(`${query.desde}T05:00:00.000-05:00`);
      condiciones.push(gte(sesionCaja.abiertaAt, inicioUtc));
    }
    if (query.hasta) {
      const parts = query.hasta.split('-').map(Number);
      const nextDay = new Date(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]! + 1));
      const y = nextDay.getUTCFullYear();
      const m = String(nextDay.getUTCMonth() + 1).padStart(2, '0');
      const d = String(nextDay.getUTCDate()).padStart(2, '0');
      const finUtc = new Date(`${y}-${m}-${d}T05:00:00.000-05:00`);
      condiciones.push(lt(sesionCaja.abiertaAt, finUtc));
    }

    // Paginación por cursor (descendente por UUID v7)
    if (query.cursor) {
      condiciones.push(lt(sesionCaja.id, query.cursor));
    }

    const limit = Math.min(query.limit ?? 50, 100);
    const consulta = this.db
      .select()
      .from(sesionCaja)
      .orderBy(desc(sesionCaja.id))
      .limit(limit + 1);

    const filas =
      condiciones.length > 0 ? await consulta.where(and(...condiciones)) : await consulta;

    const tieneMas = filas.length > limit;
    const sesiones = tieneMas ? filas.slice(0, limit) : filas;
    const nextCursor = tieneMas ? (sesiones[sesiones.length - 1]?.id ?? null) : null;

    // Resolver nombres de cajeros vía identidad
    const userIds = [...new Set(sesiones.map((s) => s.usuarioId))];
    const nombresMap = await this.identidad.nombresPorIds(userIds);

    const items = sesiones.map((s) => ({
      id: s.id,
      usuarioId: s.usuarioId,
      cajero: {
        id: s.usuarioId,
        nombre: nombresMap.get(s.usuarioId) ?? 'Desconocido',
      },
      estado: s.estado,
      montoApertura: s.montoApertura,
      efectivoEsperado: s.efectivoEsperado,
      efectivoContado: s.efectivoContado,
      diferencia: s.diferencia,
      abiertaAt: s.abiertaAt.toISOString(),
      cerradaAt: s.cerradaAt?.toISOString() ?? null,
      version: s.version,
    }));

    return { items, nextCursor };
  }

  async obtenerSesionDetalle(
    sesionId: string,
    usuario: UsuarioSesion,
  ): Promise<SesionCajaDetalle> {
    const [sesion] = await this.db
      .select()
      .from(sesionCaja)
      .where(eq(sesionCaja.id, sesionId))
      .limit(1);
    if (!sesion) throw DomainError.noEncontrado('Sesión de caja no encontrada.');
    if (sesion.usuarioId !== usuario.id && usuario.rol !== 'ADMIN') {
      throw DomainError.sinPermiso();
    }

    const nombresMap = await this.identidad.nombresPorIds([sesion.usuarioId]);
    const metodos = await this.ventasPorMetodo(this.db, sesionId);
    const ingresos = await this.totalMovimientos(this.db, sesionId, 'INGRESO');
    const retiros = await this.totalMovimientos(this.db, sesionId, 'RETIRO');
    const movimientos = await this.listarMovimientos(sesionId, usuario);

    const efectivoEsperado =
      sesion.efectivoEsperado ??
      (sesion.montoApertura + metodos.efectivo + ingresos - retiros);
    const diferencia =
      sesion.diferencia ??
      (sesion.efectivoContado != null ? sesion.efectivoContado - efectivoEsperado : null);

    return {
      id: sesion.id,
      usuarioId: sesion.usuarioId,
      cajero: {
        id: sesion.usuarioId,
        nombre: nombresMap.get(sesion.usuarioId) ?? 'Desconocido',
      },
      estado: sesion.estado,
      montoApertura: sesion.montoApertura,
      efectivoEsperado,
      efectivoContado: sesion.efectivoContado,
      diferencia,
      abiertaAt: sesion.abiertaAt.toISOString(),
      cerradaAt: sesion.cerradaAt?.toISOString() ?? null,
      version: sesion.version,
      totalesPorMetodo: metodos,
      totalesMovimientos: { ingresos, retiros },
      movimientos,
    };
  }


  // --- Cobro (RN-42..RN-45) ---

  async cobrar(input: CobroInput, usuario: UsuarioSesion): Promise<CobroRespuesta> {
    const propina = input.propina ?? 0;

    return this.db.transaction(async (tx) => {
      const [sesion] = await tx
        .select()
        .from(sesionCaja)
        .where(and(eq(sesionCaja.usuarioId, usuario.id), eq(sesionCaja.estado, 'ABIERTA')))
        .limit(1);
      if (!sesion) {
        throw new DomainError(
          'CAJA_NO_ABIERTA',
          'Debes abrir una sesión de caja para cobrar (RN-40).',
          HttpStatus.CONFLICT,
        );
      }

      const ped = await this.pedidos.prepararCobro(tx, input.pedidoId, usuario.id);
      const esperado = ped.total + propina;
      const sumaMontos = input.pagos.reduce((acc, p) => acc + p.monto, 0);
      if (sumaMontos !== esperado) {
        throw new DomainError(
          'PAGOS_NO_CUADRAN',
          'El pago no coincide con total + propina (RN-43).',
          HttpStatus.CONFLICT,
          { esperado, recibido: sumaMontos },
        );
      }

      const efectivos = input.pagos.filter((p) => p.metodo === 'EFECTIVO');
      if (efectivos.length > 1) {
        throw new DomainError(
          CODIGOS_ERROR.VALIDACION,
          'Solo se permite un único pago en EFECTIVO por cobro (RN-43).',
          HttpStatus.BAD_REQUEST,
        );
      }

      const pagoEfectivo = efectivos[0];
      const cambio = pagoEfectivo ? (pagoEfectivo.recibido ?? 0) - pagoEfectivo.monto : 0;

      const regimen = await leerRegimen(tx);
      const reciboId = nuevoId();
      const [r] = await tx
        .insert(recibo)
        .values({
          id: reciboId,
          pedidoId: ped.id,
          sesionCajaId: sesion.id,
          usuarioId: usuario.id,
          total: ped.total,
          base: ped.base,
          impuesto: ped.impuesto,
          impuestoTasaBp: TASA_IMPUESTO_BP[regimen],
          regimenTributario: regimen,
          propina,
        })
        .returning({ numero: recibo.numero });

      for (const p of input.pagos) {
        const pagoCambio = p.metodo === 'EFECTIVO' ? (p.recibido ?? 0) - p.monto : null;
        await tx.insert(pago).values({
          id: nuevoId(),
          reciboId,
          metodo: p.metodo,
          monto: p.monto,
          recibido: p.metodo === 'EFECTIVO' ? (p.recibido ?? null) : null,
          cambio: pagoCambio,
          referencia: p.referencia ?? null,
        });
      }

      await this.pedidos.cerrar(tx, ped.id);
      await this.eventBus.publicarEnTx(tx, {
        tipo: 'PedidoCobrado',
        modulo: 'caja',
        agregadoId: ped.id,
        usuarioId: usuario.id,
        payload: { pedidoId: ped.id, reciboId, numeroDia: ped.numeroDia, total: ped.total },
      });
      return {
        reciboId,
        numero: formatoNumeroRecibo(r!.numero),
        total: ped.total,
        propina,
        cambio,
      };
    });
  }

  // --- Recibo para imprimir (RN-45) ---

  async obtenerRecibo(id: string) {
    const [r] = await this.db.select().from(recibo).where(eq(recibo.id, id)).limit(1);
    if (!r) throw DomainError.noEncontrado('Recibo no encontrado.');
    const pagos = await this.db.select().from(pago).where(eq(pago.reciboId, id));
    const ped = await this.pedidos.obtenerPedido(r.pedidoId);
    const negocio = (await leerConfiguracion(this.db, 'negocio')) ?? {};
    const nombreImpuesto = NOMBRE_IMPUESTO[r.regimenTributario];
    const leyendas = ['Documento no fiscal'];
    if (r.regimenTributario === 'NO_RESPONSABLE') leyendas.push('No responsable de INC');
    return {
      id: r.id,
      numero: formatoNumeroRecibo(r.numero),
      fecha: r.createdAt.toISOString(),
      negocio,
      pedido: {
        id: ped.id,
        numeroDia: ped.numeroDia,
        tipo: ped.tipo,
        mesa: ped.mesa?.nombre ?? null,
      },
      items: ped.items.map((i) => ({
        nombre: i.nombre,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario,
        totalLinea: i.totalLinea,
        nota: i.nota ?? null,
      })),
      total: r.total,
      base: r.base,
      impuesto: r.impuesto,
      impuestoNombre: nombreImpuesto,
      impuestoTasaBp: r.impuestoTasaBp,
      propina: r.propina,
      totalPagado: r.total + r.propina,
      pagos: pagos.map((p) => ({
        metodo: p.metodo,
        monto: p.monto,
        recibido: p.recibido,
        cambio: p.cambio,
        referencia: p.referencia,
      })),
      cambio: pagos.reduce((acc, p) => acc + (p.cambio ?? 0), 0),
      leyendas,
    };
  }

  // --- Internos ---

  private async totalMovimientos(
    executor: Executor,
    sesionId: string,
    tipo: 'INGRESO' | 'RETIRO',
  ): Promise<number> {
    const [fila] = await executor
      .select({ total: sql<string>`coalesce(sum(${movimientoCaja.monto}), 0)` })
      .from(movimientoCaja)
      .where(and(eq(movimientoCaja.sesionCajaId, sesionId), eq(movimientoCaja.tipo, tipo)));
    return Number(fila?.total ?? 0);
  }

  private async ventasPorMetodo(
    executor: Executor,
    sesionId: string,
  ): Promise<{ efectivo: number; tarjeta: number; transferencia: number }> {
    const filas = await executor
      .select({
        metodo: pago.metodo,
        total: sql<string>`coalesce(sum(${pago.monto}), 0)`,
      })
      .from(pago)
      .innerJoin(recibo, eq(recibo.id, pago.reciboId))
      .where(eq(recibo.sesionCajaId, sesionId))
      .groupBy(pago.metodo);
    let efectivo = 0;
    let tarjeta = 0;
    let transferencia = 0;
    for (const f of filas) {
      const m = Number(f.total);
      if (f.metodo === 'EFECTIVO') efectivo = m;
      else if (f.metodo === 'TARJETA') tarjeta = m;
      else if (f.metodo === 'TRANSFERENCIA') transferencia = m;
    }
    return { efectivo, tarjeta, transferencia };
  }

  private async ventasEfectivo(executor: Executor, sesionId: string): Promise<number> {
    const [fila] = await executor
      .select({ total: sql<string>`coalesce(sum(${pago.monto}), 0)` })
      .from(pago)
      .innerJoin(recibo, eq(recibo.id, pago.reciboId))
      .where(and(eq(recibo.sesionCajaId, sesionId), eq(pago.metodo, 'EFECTIVO')));
    return Number(fila?.total ?? 0);
  }

  private mapearSesion(f: SesionFila): SesionCaja {
    return {
      id: f.id,
      usuarioId: f.usuarioId,
      estado: f.estado,
      montoApertura: f.montoApertura,
      efectivoEsperado: f.efectivoEsperado,
      efectivoContado: f.efectivoContado,
      diferencia: f.diferencia,
      abiertaAt: f.abiertaAt.toISOString(),
      cerradaAt: f.cerradaAt?.toISOString() ?? null,
      version: f.version,
    };
  }
}
