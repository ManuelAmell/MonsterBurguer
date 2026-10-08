import { z } from 'zod';
import { UNIDADES } from '../enums';
import { fechaOperativaSchema, pesosSchema, uuidSchema } from './common';

// ==========================================
// 1. REPORTES DE VENTAS
// ==========================================

export const AGRUPACION_REPORTE_VENTAS = ['dia', 'producto', 'metodo', 'cajero'] as const;
export type AgrupacionReporteVentas = (typeof AGRUPACION_REPORTE_VENTAS)[number];

export const reporteVentasQuerySchema = z
  .object({
    desde: fechaOperativaSchema,
    hasta: fechaOperativaSchema,
    agrupar: z.enum(AGRUPACION_REPORTE_VENTAS).default('dia'),
  })
  .refine((data) => data.desde <= data.hasta, {
    message: 'La fecha "desde" no puede ser posterior a la fecha "hasta"',
    path: ['desde'],
  })
  .refine(
    (data) => {
      const d1 = new Date(`${data.desde}T00:00:00Z`);
      const d2 = new Date(`${data.hasta}T00:00:00Z`);
      const diffDias = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      return diffDias <= 92;
    },
    {
      message: 'El rango de consulta no puede superar 92 días',
      path: ['hasta'],
    },
  );
export type ReporteVentasQuery = z.infer<typeof reporteVentasQuerySchema>;

export const itemReporteVentasSchema = z.object({
  clave: z.string(),
  etiqueta: z.string(),
  pedidos: z.number().int().nonnegative(),
  ventas: pesosSchema,
  propinas: pesosSchema,
  ticketPromedio: pesosSchema,
  unidades: z.number().int().nonnegative().optional(),
});
export type ItemReporteVentas = z.infer<typeof itemReporteVentasSchema>;

export const totalesReporteVentasSchema = z.object({
  pedidos: z.number().int().nonnegative(),
  ventas: pesosSchema,
  propinas: pesosSchema,
  ticketPromedio: pesosSchema,
  unidades: z.number().int().nonnegative().optional(),
  anulados: z.object({
    cantidad: z.number().int().nonnegative(),
    monto: pesosSchema,
  }),
});
export type TotalesReporteVentas = z.infer<typeof totalesReporteVentasSchema>;

export const reporteVentasRespuestaSchema = z.object({
  desde: fechaOperativaSchema,
  hasta: fechaOperativaSchema,
  agrupar: z.enum(AGRUPACION_REPORTE_VENTAS),
  items: z.array(itemReporteVentasSchema),
  totales: totalesReporteVentasSchema,
});
export type ReporteVentasRespuesta = z.infer<typeof reporteVentasRespuestaSchema>;

// ==========================================
// 2. ALERTAS DEL SISTEMA
// ==========================================

export const TIPO_ALERTA = [
  'PEDIDO_OLVIDADO',
  'INGREDIENTE_BAJO_MINIMO',
  'INGREDIENTE_AGOTADO',
  'PRODUCTO_AGOTADO',
] as const;
export type TipoAlerta = (typeof TIPO_ALERTA)[number];

export const SEVERIDAD_ALERTA = ['INFO', 'ADVERTENCIA', 'CRITICA'] as const;
export type SeveridadAlerta = (typeof SEVERIDAD_ALERTA)[number];

export const datosAlertaPedidoOlvidadoSchema = z.object({
  pedidoId: uuidSchema,
  numeroDia: z.number().int(),
  mesaNombre: z.string().nullable(),
  abiertoDesde: z.string(),
});
export type DatosAlertaPedidoOlvidado = z.infer<typeof datosAlertaPedidoOlvidadoSchema>;

export const datosAlertaIngredienteBajoMinimoSchema = z.object({
  ingredienteId: uuidSchema,
  nombre: z.string(),
  stockActual: z.number(),
  stockMinimo: z.number(),
  unidad: z.enum(UNIDADES),
});
export type DatosAlertaIngredienteBajoMinimo = z.infer<typeof datosAlertaIngredienteBajoMinimoSchema>;

export const datosAlertaIngredienteAgotadoSchema = z.object({
  ingredienteId: uuidSchema,
  nombre: z.string(),
  unidad: z.enum(UNIDADES),
});
export type DatosAlertaIngredienteAgotado = z.infer<typeof datosAlertaIngredienteAgotadoSchema>;

export const datosAlertaProductoAgotadoSchema = z.object({
  productoId: uuidSchema,
  nombre: z.string(),
});
export type DatosAlertaProductoAgotado = z.infer<typeof datosAlertaProductoAgotadoSchema>;

export const alertaPedidoOlvidadoSchema = z.object({
  tipo: z.literal('PEDIDO_OLVIDADO'),
  severidad: z.literal('ADVERTENCIA'),
  entidadId: uuidSchema,
  datos: datosAlertaPedidoOlvidadoSchema,
});

export const alertaIngredienteBajoMinimoSchema = z.object({
  tipo: z.literal('INGREDIENTE_BAJO_MINIMO'),
  severidad: z.literal('ADVERTENCIA'),
  entidadId: uuidSchema,
  datos: datosAlertaIngredienteBajoMinimoSchema,
});

export const alertaIngredienteAgotadoSchema = z.object({
  tipo: z.literal('INGREDIENTE_AGOTADO'),
  severidad: z.literal('CRITICA'),
  entidadId: uuidSchema,
  datos: datosAlertaIngredienteAgotadoSchema,
});

export const alertaProductoAgotadoSchema = z.object({
  tipo: z.literal('PRODUCTO_AGOTADO'),
  severidad: z.literal('CRITICA'),
  entidadId: uuidSchema,
  datos: datosAlertaProductoAgotadoSchema,
});

export const alertaSchema = z.discriminatedUnion('tipo', [
  alertaPedidoOlvidadoSchema,
  alertaIngredienteBajoMinimoSchema,
  alertaIngredienteAgotadoSchema,
  alertaProductoAgotadoSchema,
]);
export type Alerta = z.infer<typeof alertaSchema>;

export const alertasRespuestaSchema = z.object({
  items: z.array(alertaSchema),
});
export type AlertasRespuesta = z.infer<typeof alertasRespuestaSchema>;
