import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import {
  CODIGOS_ERROR,
  NOMBRE_IMPUESTO,
  type CobroInput,
  type CobroRespuesta,
  type ResumenCierre,
  type SesionCaja,
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
import { PedidosService } from '../pedidos/pedidos.public';
import { pago, recibo, sesionCaja } from './caja.schema';

type SesionFila = typeof sesionCaja.$inferSelect;

export const formatoNumeroRecibo = (n: number): string => `R-${String(n).padStart(6, '0')}`;

@Injectable()
export class CajaService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly eventBus: EventBus,
    private readonly pedidos: PedidosService,
  ) {}

  // --- Sesión de caja (RN-40, RN-41, RN-47) ---

  async sesionActual(usuarioId: string): Promise<(SesionCaja & { ventasEfectivo: number }) | null> {
    const [fila] = await this.db
      .select()
      .from(sesionCaja)
      .where(and(eq(sesionCaja.usuarioId, usuarioId), eq(sesionCaja.estado, 'ABIERTA')))
      .limit(1);
    if (!fila) return null;
    const ventasEfectivo = await this.ventasEfectivo(this.db, fila.id);
    return {
      ...this.mapearSesion({ ...fila, efectivoEsperado: fila.montoApertura + ventasEfectivo }),
      ventasEfectivo,
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
      const efectivoEsperado = sesion.montoApertura + ventasEfectivo; // sin ingresos/retiros en el MVP
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
        payload: { sesionId, efectivoEsperado, efectivoContado, diferencia },
      });
      return {
        sesionId,
        montoApertura: sesion.montoApertura,
        ventasEfectivo,
        ingresos: 0,
        retiros: 0,
        efectivoEsperado,
        efectivoContado,
        diferencia,
        cerradaAt: cerradaAt.toISOString(),
      };
    });
  }

  // --- Cobro (RN-42..RN-45) ---

  async cobrar(input: CobroInput, usuario: UsuarioSesion): Promise<CobroRespuesta> {
    const propina = input.propina ?? 0;
    if (input.pagos.length !== 1) {
      throw new DomainError(
        CODIGOS_ERROR.VALIDACION,
        'En el MVP el cobro admite un solo método de pago.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const metodoPago = input.pagos[0]!;

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
      if (metodoPago.monto !== esperado) {
        throw new DomainError(
          'PAGOS_NO_CUADRAN',
          'El pago no coincide con total + propina (RN-43).',
          HttpStatus.CONFLICT,
          { esperado, recibido: metodoPago.monto },
        );
      }
      const cambio =
        metodoPago.metodo === 'EFECTIVO' ? (metodoPago.recibido ?? 0) - metodoPago.monto : 0;

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
      await tx.insert(pago).values({
        id: nuevoId(),
        reciboId,
        metodo: metodoPago.metodo,
        monto: metodoPago.monto,
        recibido: metodoPago.metodo === 'EFECTIVO' ? (metodoPago.recibido ?? null) : null,
        cambio: metodoPago.metodo === 'EFECTIVO' ? cambio : null,
        referencia: metodoPago.referencia ?? null,
      });
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
