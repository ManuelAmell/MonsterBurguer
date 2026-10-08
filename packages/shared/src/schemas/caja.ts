import { z } from 'zod';
import { ESTADOS_SESION_CAJA, METODOS_PAGO, TIPOS_MOVIMIENTO_CAJA } from '../enums';
import {
  fechaOperativaSchema,
  paginacionQuerySchema,
  paginacionRespuestaSchema,
  pesosSchema,
  uuidSchema,
} from './common';

// --- Apertura de Sesión de Caja (RN-41) ---

export const abrirSesionCajaSchema = z.object({
  montoApertura: pesosSchema,
});
export type AbrirSesionCajaInput = z.input<typeof abrirSesionCajaSchema>;
export type AbrirSesionCajaOutput = z.infer<typeof abrirSesionCajaSchema>;

// --- Movimientos Manuales de Caja (RN-46) ---

export const movimientoCajaInputSchema = z.object({
  tipo: z.enum(TIPOS_MOVIMIENTO_CAJA, {
    message: 'El tipo de movimiento debe ser INGRESO o RETIRO (RN-46)',
  }),
  monto: z
    .number()
    .int('El monto debe ser un entero en pesos COP (RN-01)')
    .positive('El monto del movimiento debe ser mayor a 0 (RN-46)'),
  motivo: z
    .string()
    .trim()
    .min(3, 'El motivo del movimiento es obligatorio y debe tener entre 3 y 140 caracteres (RN-46)')
    .max(140, 'El motivo no puede superar 140 caracteres (RN-46)'),
});
export type MovimientoCajaInput = z.input<typeof movimientoCajaInputSchema>;
export type MovimientoCajaOutput = z.infer<typeof movimientoCajaInputSchema>;

export const movimientoCajaSchema = z.object({
  id: uuidSchema,
  sesionCajaId: uuidSchema,
  tipo: z.enum(TIPOS_MOVIMIENTO_CAJA),
  monto: pesosSchema,
  motivo: z.string(),
  usuarioId: uuidSchema,
  createdAt: z.string(),
});
export type MovimientoCaja = z.infer<typeof movimientoCajaSchema>;

// --- Cobro de Pedido (RN-42, RN-43) ---

export const pagoCobroItemSchema = z
  .object({
    metodo: z.enum(METODOS_PAGO, {
      message: 'El método de pago debe ser EFECTIVO, TARJETA o TRANSFERENCIA (RN-42)',
    }),
    monto: z
      .number()
      .int('El monto debe ser un entero en pesos COP (RN-01)')
      .positive('El monto a pagar debe ser mayor a 0 (RN-42)'),
    recibido: z
      .number()
      .int('El monto recibido debe ser un entero en pesos COP (RN-01)')
      .positive('El monto recibido debe ser mayor a 0')
      .optional(),
    referencia: z
      .string()
      .trim()
      .max(100, 'La referencia no puede superar 100 caracteres')
      .optional()
      .nullable(),
  })
  .refine(
    (pago) => {
      if (pago.metodo === 'EFECTIVO') {
        return pago.recibido !== undefined && pago.recibido >= pago.monto;
      }
      return true;
    },
    {
      message:
        'En pagos con EFECTIVO, se debe indicar el monto recibido y debe ser mayor o igual al monto a pagar (RN-43)',
      path: ['recibido'],
    },
  );
export type PagoCobroItem = z.infer<typeof pagoCobroItemSchema>;

export const cobroSchema = z
  .object({
    pedidoId: uuidSchema,
    pedidoVersion: z
      .number()
      .int('La versión del pedido debe ser un entero')
      .min(0, 'La versión del pedido no puede ser negativa')
      .optional(),
    propina: pesosSchema.default(0),
    pagos: z
      .array(pagoCobroItemSchema)
      .min(1, 'Debe registrar al menos un pago para cobrar el pedido (RN-42)')
      .max(3, 'Se permite un máximo de 3 pagos por cobro (RN-42)'),
  })
  .refine(
    (data) => {
      const efectivos = data.pagos.filter((p) => p.metodo === 'EFECTIVO');
      return efectivos.length <= 1;
    },
    {
      message: 'Solo se permite un único pago en EFECTIVO por cobro (RN-43)',
      path: ['pagos'],
    },
  )
  .refine(
    (data) => {
      const metodos = data.pagos.map((p) => p.metodo);
      return new Set(metodos).size === metodos.length;
    },
    {
      message: 'No se permiten métodos de pago repetidos (RN-42)',
      path: ['pagos'],
    },
  );
export type CobroInput = z.input<typeof cobroSchema>;
export type CobroOutput = z.infer<typeof cobroSchema>;

// --- Respuesta de Cobro ---

export const cobroRespuestaSchema = z.object({
  reciboId: uuidSchema,
  numero: z.string(),
  total: pesosSchema,
  propina: pesosSchema,
  cambio: pesosSchema,
});
export type CobroRespuesta = z.infer<typeof cobroRespuestaSchema>;

// --- Cierre de Sesión de Caja (RN-47) ---

export const cerrarSesionCajaSchema = z.object({
  efectivoContado: pesosSchema,
  version: z
    .number()
    .int('La versión debe ser un entero')
    .min(0, 'La versión no puede ser negativa')
    .optional(),
});
export type CerrarSesionCajaInput = z.input<typeof cerrarSesionCajaSchema>;
export type CerrarSesionCajaOutput = z.infer<typeof cerrarSesionCajaSchema>;

export const resumenCierreSchema = z.object({
  sesionId: uuidSchema,
  montoApertura: pesosSchema,
  ventasEfectivo: pesosSchema,
  ingresos: pesosSchema,
  retiros: pesosSchema,
  efectivoEsperado: pesosSchema,
  efectivoContado: pesosSchema,
  diferencia: z.number().int(),
  cerradaAt: z.string(),
});
export type ResumenCierre = z.infer<typeof resumenCierreSchema>;

export const sesionCajaSchema = z.object({
  id: uuidSchema,
  usuarioId: uuidSchema,
  estado: z.enum(ESTADOS_SESION_CAJA),
  montoApertura: pesosSchema,
  efectivoEsperado: pesosSchema.nullable().optional(),
  efectivoContado: pesosSchema.nullable().optional(),
  diferencia: z.number().int().nullable().optional(),
  abiertaAt: z.string(),
  cerradaAt: z.string().nullable().optional(),
  version: z.number().int().min(0),
});
export type SesionCaja = z.infer<typeof sesionCajaSchema>;

// --- Historial y Detalle de Sesiones de Caja ---

export const buscarSesionesQuerySchema = paginacionQuerySchema
  .extend({
    desde: fechaOperativaSchema.optional(),
    hasta: fechaOperativaSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.desde && data.hasta) {
        return data.desde <= data.hasta;
      }
      return true;
    },
    {
      message: 'La fecha "desde" no puede ser posterior a "hasta"',
      path: ['desde'],
    },
  );
export type BuscarSesionesQuery = z.infer<typeof buscarSesionesQuerySchema>;

export const cajeroResumenSchema = z.object({
  id: uuidSchema,
  nombre: z.string(),
});
export type CajeroResumen = z.infer<typeof cajeroResumenSchema>;

export const sesionCajaResumenSchema = z.object({
  id: uuidSchema,
  usuarioId: uuidSchema,
  cajero: cajeroResumenSchema,
  estado: z.enum(ESTADOS_SESION_CAJA),
  montoApertura: pesosSchema,
  efectivoEsperado: pesosSchema.nullable().optional(),
  efectivoContado: pesosSchema.nullable().optional(),
  diferencia: z.number().int().nullable().optional(),
  abiertaAt: z.string(),
  cerradaAt: z.string().nullable().optional(),
  version: z.number().int().min(0),
});
export type SesionCajaResumen = z.infer<typeof sesionCajaResumenSchema>;

export const sesionesPaginadasRespuestaSchema = paginacionRespuestaSchema(sesionCajaResumenSchema);
export type SesionesPaginadasRespuesta = z.infer<typeof sesionesPaginadasRespuestaSchema>;

export const sesionCajaDetalleSchema = z.object({
  id: uuidSchema,
  usuarioId: uuidSchema,
  cajero: cajeroResumenSchema,
  estado: z.enum(ESTADOS_SESION_CAJA),
  montoApertura: pesosSchema,
  efectivoEsperado: pesosSchema.nullable().optional(),
  efectivoContado: pesosSchema.nullable().optional(),
  diferencia: z.number().int().nullable().optional(),
  abiertaAt: z.string(),
  cerradaAt: z.string().nullable().optional(),
  version: z.number().int().min(0),
  totalesPorMetodo: z.object({
    efectivo: pesosSchema,
    tarjeta: pesosSchema,
    transferencia: pesosSchema,
  }),
  totalesMovimientos: z.object({
    ingresos: pesosSchema,
    retiros: pesosSchema,
  }),
  movimientos: z.array(movimientoCajaSchema),
});
export type SesionCajaDetalle = z.infer<typeof sesionCajaDetalleSchema>;

