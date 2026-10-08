import { Inject, Injectable } from '@nestjs/common';
import { desc, lt, sql } from 'drizzle-orm';
import {
  fechaOperativa,
  type Alerta,
  type AlertasRespuesta,
  type ConfiguracionNegocio,
  type ItemReporteVentas,
  type ReporteVentasQuery,
  type ReporteVentasRespuesta,
  type Unidad,
} from '@mb/shared';
import { DB, type Db } from '../../shared-kernel/db/db';
import { eventoSistema } from '../../shared-kernel/events/evento-sistema.schema';
import {
  guardarConfiguracion,
  leerConfiguracion,
  leerHoraCorte,
} from '../../shared-kernel/configuracion/configuracion.lector';

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

  async reporteVentas(q: ReporteVentasQuery): Promise<ReporteVentasRespuesta> {
    const { desde, hasta, agrupar } = q;

    let items: ItemReporteVentas[] = [];

    if (agrupar === 'dia') {
      const res = await this.db.execute<{
        clave: string;
        etiqueta: string;
        pedidos: number;
        ventas: string;
        propinas: string;
      }>(sql`
        SELECT clave,
               etiqueta,
               sum(pedidos)::int AS pedidos,
               sum(ventas)::bigint AS ventas,
               sum(propinas)::bigint AS propinas
        FROM v_reporte_ventas_dia
        WHERE fecha_operativa BETWEEN ${desde} AND ${hasta}
        GROUP BY clave, etiqueta
        ORDER BY clave ASC
      `);
      items = res.rows.map((r) => {
        const pedidos = Number(r.pedidos);
        const ventas = Number(r.ventas);
        const propinas = Number(r.propinas);
        return {
          clave: r.clave,
          etiqueta: r.etiqueta,
          pedidos,
          ventas,
          propinas,
          ticketPromedio: pedidos > 0 ? Math.round(ventas / pedidos) : 0,
        };
      });
    } else if (agrupar === 'producto') {
      const res = await this.db.execute<{
        clave: string;
        etiqueta: string;
        pedidos: number;
        ventas: string;
        propinas: string;
        unidades: string;
      }>(sql`
        SELECT clave,
               etiqueta,
               sum(pedidos)::int AS pedidos,
               sum(ventas)::bigint AS ventas,
               0::bigint AS propinas,
               sum(unidades)::bigint AS unidades
        FROM v_reporte_ventas_producto
        WHERE fecha_operativa BETWEEN ${desde} AND ${hasta}
        GROUP BY clave, etiqueta
        ORDER BY ventas DESC, unidades DESC
      `);
      items = res.rows.map((r) => {
        const pedidos = Number(r.pedidos);
        const ventas = Number(r.ventas);
        const unidades = Number(r.unidades);
        return {
          clave: r.clave,
          etiqueta: r.etiqueta,
          pedidos,
          ventas,
          propinas: 0,
          unidades,
          ticketPromedio: pedidos > 0 ? Math.round(ventas / pedidos) : 0,
        };
      });
    } else if (agrupar === 'metodo') {
      const res = await this.db.execute<{
        clave: string;
        etiqueta: string;
        pedidos: number;
        ventas: string;
        propinas: string;
        cobrado: string;
      }>(sql`
        SELECT clave,
               etiqueta,
               sum(pedidos)::int AS pedidos,
               sum(ventas)::bigint AS ventas,
               sum(propinas)::bigint AS propinas,
               sum(cobrado)::bigint AS cobrado
        FROM v_reporte_ventas_metodo
        WHERE fecha_operativa BETWEEN ${desde} AND ${hasta}
        GROUP BY clave, etiqueta
        ORDER BY ventas DESC
      `);
      items = res.rows.map((r) => {
        const pedidos = Number(r.pedidos);
        const ventas = Number(r.ventas);
        const propinas = Number(r.propinas);
        const cobrado = Number(r.cobrado);
        return {
          clave: r.clave,
          etiqueta: r.etiqueta,
          pedidos,
          ventas,
          propinas,
          cobrado,
          ticketPromedio: pedidos > 0 ? Math.round(ventas / pedidos) : 0,
        };
      });
    } else if (agrupar === 'cajero') {
      const res = await this.db.execute<{
        clave: string;
        etiqueta: string;
        pedidos: number;
        ventas: string;
        propinas: string;
      }>(sql`
        SELECT clave,
               etiqueta,
               sum(pedidos)::int AS pedidos,
               sum(ventas)::bigint AS ventas,
               sum(propinas)::bigint AS propinas
        FROM v_reporte_ventas_cajero
        WHERE fecha_operativa BETWEEN ${desde} AND ${hasta}
        GROUP BY clave, etiqueta
        ORDER BY ventas DESC
      `);
      items = res.rows.map((r) => {
        const pedidos = Number(r.pedidos);
        const ventas = Number(r.ventas);
        const propinas = Number(r.propinas);
        return {
          clave: r.clave,
          etiqueta: r.etiqueta,
          pedidos,
          ventas,
          propinas,
          ticketPromedio: pedidos > 0 ? Math.round(ventas / pedidos) : 0,
        };
      });
    }

    // Totales del rango
    const totalesRes = await this.db.execute<{
      pedidos: number;
      ventas: string;
      propinas: string;
    }>(sql`
      SELECT coalesce(sum(pedidos), 0)::int AS pedidos,
             coalesce(sum(ventas), 0)::bigint AS ventas,
             coalesce(sum(propinas), 0)::bigint AS propinas
      FROM v_reporte_ventas_dia
      WHERE fecha_operativa BETWEEN ${desde} AND ${hasta}
    `);
    const totRow = totalesRes.rows[0];
    const totPedidos = Number(totRow?.pedidos ?? 0);
    const totVentas = Number(totRow?.ventas ?? 0);
    const totPropinas = Number(totRow?.propinas ?? 0);
    const totTicket = totPedidos > 0 ? Math.round(totVentas / totPedidos) : 0;

    const anuladosRes = await this.db.execute<{
      pedidos: number;
      monto: string;
    }>(sql`
      SELECT coalesce(sum(pedidos), 0)::int AS pedidos,
             coalesce(sum(monto), 0)::bigint AS monto
      FROM v_reporte_pedidos_anulados
      WHERE fecha_operativa BETWEEN ${desde} AND ${hasta}
    `);
    const anuladosRow = anuladosRes.rows[0];
    const anuladosCantidad = Number(anuladosRow?.pedidos ?? 0);
    const anuladosMonto = Number(anuladosRow?.monto ?? 0);

    let totUnidades: number | undefined;
    if (agrupar === 'producto') {
      const unidadesRes = await this.db.execute<{
        unidades: string;
      }>(sql`
        SELECT coalesce(sum(unidades), 0)::bigint AS unidades
        FROM v_reporte_ventas_producto
        WHERE fecha_operativa BETWEEN ${desde} AND ${hasta}
      `);
      totUnidades = Number(unidadesRes.rows[0]?.unidades ?? 0);
    }

    return {
      desde,
      hasta,
      agrupar,
      items,
      totales: {
        pedidos: totPedidos,
        ventas: totVentas,
        propinas: totPropinas,
        ticketPromedio: totTicket,
        unidades: totUnidades,
        cobrado: agrupar === 'metodo' ? totVentas + totPropinas : undefined,
        anulados: {
          cantidad: anuladosCantidad,
          monto: anuladosMonto,
        },
      },
    };
  }

  async reporteVentasCsv(q: ReporteVentasQuery): Promise<string> {
    const data = await this.reporteVentas(q);
    const lineas: string[] = [];

    const escapar = (s: string) => {
      if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    if (data.agrupar === 'dia') {
      lineas.push('Fecha;Pedidos;Ventas;Propinas;Ticket Promedio');
      for (const item of data.items) {
        lineas.push(`${escapar(item.etiqueta)};${item.pedidos};${item.ventas};${item.propinas};${item.ticketPromedio}`);
      }
      lineas.push(`TOTAL;${data.totales.pedidos};${data.totales.ventas};${data.totales.propinas};${data.totales.ticketPromedio}`);
    } else if (data.agrupar === 'producto') {
      lineas.push('Producto;Pedidos;Unidades;Ventas;Ticket Promedio');
      for (const item of data.items) {
        lineas.push(`${escapar(item.etiqueta)};${item.pedidos};${item.unidades ?? 0};${item.ventas};${item.ticketPromedio}`);
      }
      lineas.push(`TOTAL;${data.totales.pedidos};${data.totales.unidades ?? 0};${data.totales.ventas};${data.totales.ticketPromedio}`);
    } else if (data.agrupar === 'metodo') {
      lineas.push('Método de Pago;Pedidos;Ventas;Propinas;Cobrado;Ticket Promedio');
      for (const item of data.items) {
        lineas.push(
          `${escapar(item.etiqueta)};${item.pedidos};${item.ventas};${item.propinas};${item.cobrado ?? item.ventas + item.propinas};${item.ticketPromedio}`,
        );
      }
      const totCobrado = data.totales.cobrado ?? data.totales.ventas + data.totales.propinas;
      lineas.push(
        `TOTAL;${data.totales.pedidos};${data.totales.ventas};${data.totales.propinas};${totCobrado};${data.totales.ticketPromedio}`,
      );
    } else if (data.agrupar === 'cajero') {
      lineas.push('Cajero;Pedidos;Ventas;Propinas;Ticket Promedio');
      for (const item of data.items) {
        lineas.push(`${escapar(item.etiqueta)};${item.pedidos};${item.ventas};${item.propinas};${item.ticketPromedio}`);
      }
      lineas.push(`TOTAL;${data.totales.pedidos};${data.totales.ventas};${data.totales.propinas};${data.totales.ticketPromedio}`);
    }

    if (data.totales.anulados.cantidad > 0) {
      lineas.push('');
      lineas.push(`Pedidos Anulados;${data.totales.anulados.cantidad}`);
      lineas.push(`Monto Anulado;${data.totales.anulados.monto}`);
    }

    // UTF-8 BOM (\uFEFF) para compatibilidad con Microsoft Excel
    return `\uFEFF${lineas.join('\r\n')}`;
  }

  async obtenerAlertas(): Promise<AlertasRespuesta> {
    const items: Alerta[] = [];

    // 1. Pedidos olvidados (> 12 h sin actividad) (RN-17)
    const olvidadosRes = await this.db.execute<{
      pedido_id: string;
      numero_dia: number;
      mesa_nombre: string | null;
      abierto_desde: Date;
    }>(sql`
      SELECT pedido_id, numero_dia, mesa_nombre, abierto_desde
      FROM v_pedidos_olvidados
      ORDER BY abierto_desde ASC
    `);
    for (const r of olvidadosRes.rows) {
      items.push({
        tipo: 'PEDIDO_OLVIDADO',
        severidad: 'ADVERTENCIA',
        entidadId: r.pedido_id,
        datos: {
          pedidoId: r.pedido_id,
          numeroDia: Number(r.numero_dia),
          mesaNombre: r.mesa_nombre ?? null,
          abiertoDesde: new Date(r.abierto_desde).toISOString(),
        },
      });
    }

    // 2. Ingredientes bajo mínimo y agotados (RN-36)
    const stockRes = await this.db.execute<{
      ingrediente_id: string;
      nombre: string;
      unidad: string;
      stock_actual: string;
      stock_minimo: string;
      agotado: boolean;
    }>(sql`
      SELECT ingrediente_id, nombre, unidad, stock_actual, stock_minimo, agotado
      FROM v_stock_alertas
      ORDER BY agotado DESC, nombre ASC
    `);
    for (const r of stockRes.rows) {
      if (r.agotado) {
        items.push({
          tipo: 'INGREDIENTE_AGOTADO',
          severidad: 'CRITICA',
          entidadId: r.ingrediente_id,
          datos: {
            ingredienteId: r.ingrediente_id,
            nombre: r.nombre,
            unidad: r.unidad as Unidad,
          },
        });
      } else {
        items.push({
          tipo: 'INGREDIENTE_BAJO_MINIMO',
          severidad: 'ADVERTENCIA',
          entidadId: r.ingrediente_id,
          datos: {
            ingredienteId: r.ingrediente_id,
            nombre: r.nombre,
            stockActual: Number(r.stock_actual),
            stockMinimo: Number(r.stock_minimo),
            unidad: r.unidad as Unidad,
          },
        });
      }
    }

    // 3. Productos agotados
    const prodRes = await this.db.execute<{
      producto_id: string;
      nombre: string;
    }>(sql`
      SELECT producto_id, nombre
      FROM v_productos_agotados
      ORDER BY nombre ASC
    `);
    for (const r of prodRes.rows) {
      items.push({
        tipo: 'PRODUCTO_AGOTADO',
        severidad: 'CRITICA',
        entidadId: r.producto_id,
        datos: {
          productoId: r.producto_id,
          nombre: r.nombre,
        },
      });
    }

    return { items };
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

  async obtenerConfiguracion(): Promise<ConfiguracionNegocio> {
    const negocio = (await leerConfiguracion(this.db, 'negocio')) as Record<string, unknown> | undefined;
    const propinaBp = Number((await leerConfiguracion(this.db, 'propina_sugerida_bp')) ?? 1000);
    const horaCorte = await leerHoraCorte(this.db);

    return {
      nombre: String(negocio?.nombre ?? negocio?.razonSocial ?? 'MonsterBurguer'),
      nit: String(negocio?.nit ?? negocio?.documento ?? ''),
      direccion: String(negocio?.direccion ?? ''),
      telefono: String(negocio?.telefono ?? ''),
      pieRecibo: String(negocio?.pieRecibo ?? ''),
      propinaSugeridaPorcentaje: Math.round(propinaBp / 100),
      horaCorte,
    };
  }

  async guardarConfiguracion(
    input: ConfiguracionNegocio,
    usuarioId: string,
  ): Promise<ConfiguracionNegocio> {
    const nit = (input.nit ?? '').trim();
    const direccion = (input.direccion ?? '').trim();
    const telefono = (input.telefono ?? '').trim();
    const pieRecibo = (input.pieRecibo ?? '').trim();

    const negocio = {
      nombre: input.nombre.trim(),
      razonSocial: input.nombre.trim(),
      documento: nit,
      nit,
      direccion,
      telefono,
      pieRecibo,
    };

    await this.db.transaction(async (tx) => {
      await guardarConfiguracion(tx, 'negocio', negocio, usuarioId);
      await guardarConfiguracion(tx, 'propina_sugerida_bp', input.propinaSugeridaPorcentaje * 100, usuarioId);
      await guardarConfiguracion(tx, 'hora_corte_dia', input.horaCorte.trim(), usuarioId);
    });

    return {
      nombre: input.nombre.trim(),
      nit,
      direccion,
      telefono,
      pieRecibo,
      propinaSugeridaPorcentaje: input.propinaSugeridaPorcentaje,
      horaCorte: input.horaCorte.trim(),
    };
  }
}
