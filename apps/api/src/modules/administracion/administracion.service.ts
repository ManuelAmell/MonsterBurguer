import { Inject, Injectable } from '@nestjs/common';
import { desc, lt, sql } from 'drizzle-orm';
import { fechaOperativa } from '@mb/shared';
import { DB, type Db } from '../../shared-kernel/db/db';
import { eventoSistema } from '../../shared-kernel/events/evento-sistema.schema';
import { leerHoraCorte } from '../../shared-kernel/configuracion/configuracion.lector';

export interface DashboardDia {
  fecha: string;
  ventasTotal: number;
  pedidosCerrados: number;
  ticketPromedio: number;
  propinas: number;
  topProductos: Array<{ productoId: string; nombre: string; unidades: number; monto: number }>;
}

/** Solo lectura: consulta las vistas `v_*` de la migración y la bitácora `evento_sistema`. */
@Injectable()
export class AdministracionService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async dashboard(fecha?: string): Promise<DashboardDia> {
    const dia = fecha ?? fechaOperativa(new Date(), await leerHoraCorte(this.db));
    const resumen = await this.db.execute<{
      total: string;
      pedidos: number;
      ticket_promedio: string;
      propinas: string;
    }>(sql`select total, pedidos, ticket_promedio, propinas from v_ventas_dia where fecha_operativa = ${dia}`);
    const top = await this.db.execute<{
      producto_id: string;
      nombre: string;
      unidades: string;
      monto: string;
    }>(sql`select producto_id, nombre, unidades, monto from v_ventas_producto
           where fecha_operativa = ${dia} order by unidades desc, monto desc limit 5`);
    const r = resumen.rows[0];
    return {
      fecha: dia,
      ventasTotal: Number(r?.total ?? 0),
      pedidosCerrados: Number(r?.pedidos ?? 0),
      ticketPromedio: Number(r?.ticket_promedio ?? 0),
      propinas: Number(r?.propinas ?? 0),
      topProductos: top.rows.map((t) => ({
        productoId: t.producto_id,
        nombre: t.nombre,
        unidades: Number(t.unidades),
        monto: Number(t.monto),
      })),
    };
  }

  async eventos(cursor?: string) {
    const filas = await this.db
      .select()
      .from(eventoSistema)
      .where(cursor && /^\d+$/.test(cursor) ? lt(eventoSistema.id, Number(cursor)) : undefined)
      .orderBy(desc(eventoSistema.id))
      .limit(50);
    return {
      items: filas.map((f) => ({
        id: f.id,
        tipo: f.tipo,
        modulo: f.modulo,
        fecha: f.createdAt.toISOString(),
        usuarioId: f.usuarioId,
        payload: f.payload,
      })),
      nextCursor: filas.length === 50 ? String(filas[filas.length - 1]!.id) : null,
    };
  }
}
