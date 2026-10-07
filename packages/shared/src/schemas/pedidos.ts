import { z } from 'zod';
import { ESTADOS_COMANDA, ESTADOS_PEDIDO, TIPOS_PEDIDO } from '../enums';
import { fechaOperativaSchema, paginacionQuerySchema, pesosSchema, uuidSchema } from './common';

// --- Mesa ---

export const mesaSchema = z.object({
  id: uuidSchema,
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre de la mesa es obligatorio')
    .max(50, 'El nombre de la mesa no puede superar 50 caracteres'),
  capacidad: z
    .number()
    .int('La capacidad debe ser un número entero')
    .min(1, 'La capacidad mínima de la mesa es 1 persona')
    .default(4),
  activa: z.boolean().default(true),
  orden: z
    .number()
    .int('El orden debe ser un número entero')
    .min(0, 'El orden no puede ser negativo')
    .default(0),
});
export type Mesa = z.infer<typeof mesaSchema>;

export const mesaConEstadoSchema = mesaSchema.extend({
  ocupada: z.boolean(),
  pedidoId: uuidSchema.nullable(),
});
export type MesaConEstado = z.infer<typeof mesaConEstadoSchema>;

export const crearMesaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre de la mesa es obligatorio')
    .max(50, 'El nombre de la mesa no puede superar 50 caracteres'),
  capacidad: z
    .number()
    .int('La capacidad debe ser un número entero')
    .min(1, 'La capacidad mínima de la mesa es 1 persona')
    .default(4)
    .optional(),
  activa: z.boolean().default(true).optional(),
  orden: z
    .number()
    .int('El orden debe ser un número entero')
    .min(0, 'El orden no puede ser negativo')
    .default(0)
    .optional(),
});
export type CrearMesaInput = z.input<typeof crearMesaSchema>;
export type CrearMesaOutput = z.infer<typeof crearMesaSchema>;

export const editarMesaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre de la mesa no puede estar vacío')
    .max(50, 'El nombre de la mesa no puede superar 50 caracteres')
    .optional(),
  capacidad: z
    .number()
    .int('La capacidad debe ser un número entero')
    .min(1, 'La capacidad mínima de la mesa es 1 persona')
    .optional(),
  activa: z.boolean().optional(),
  orden: z
    .number()
    .int('El orden debe ser un número entero')
    .min(0, 'El orden no puede ser negativo')
    .optional(),
});
export type EditarMesaInput = z.input<typeof editarMesaSchema>;
export type EditarMesaOutput = z.infer<typeof editarMesaSchema>;

export const reordenarMesasSchema = z.object({
  mesas: z
    .array(
      z.object({
        id: uuidSchema,
        orden: z
          .number()
          .int('El orden debe ser un número entero')
          .min(0, 'El orden no puede ser negativo'),
      }),
    )
    .min(1, 'Debe incluir al menos una mesa para ordenar'),
});
export type ReordenarMesasInput = z.input<typeof reordenarMesasSchema>;
export type ReordenarMesasOutput = z.infer<typeof reordenarMesasSchema>;


// --- Crear Pedido (RN-11) ---

export const crearPedidoSchema = z
  .object({
    tipo: z.enum(TIPOS_PEDIDO, {
      message: 'El tipo de pedido debe ser MESA o LLEVAR (RN-10)',
    }),
    mesaId: uuidSchema.optional().nullable(),
    clienteId: uuidSchema.optional().nullable(),
    nota: z
      .string()
      .max(500, 'La nota del pedido no puede superar 500 caracteres')
      .optional()
      .nullable(),
  })
  .refine(
    (data) => {
      if (data.tipo === 'MESA') {
        return !!data.mesaId;
      }
      return data.mesaId == null;
    },
    {
      message:
        'Un pedido de tipo MESA requiere una mesa asignada, y un pedido LLEVAR no debe tener mesa asignada (RN-11)',
      path: ['mesaId'],
    },
  );
export type CrearPedidoInput = z.input<typeof crearPedidoSchema>;
export type CrearPedidoOutput = z.infer<typeof crearPedidoSchema>;

// --- Items de Pedido (RN-12) ---

export const agregarPedidoItemSchema = z.object({
  productoId: uuidSchema,
  cantidad: z
    .number()
    .int('La cantidad debe ser un número entero')
    .min(1, 'La cantidad mínima por ítem es 1 (RN-12)')
    .max(99, 'La cantidad máxima por ítem es 99 (RN-12)'),
  nota: z
    .string()
    .trim()
    .max(140, 'La nota del ítem no puede superar 140 caracteres (RN-12)')
    .optional()
    .nullable(),
});
export type AgregarPedidoItemInput = z.input<typeof agregarPedidoItemSchema>;
export type AgregarPedidoItemOutput = z.infer<typeof agregarPedidoItemSchema>;

export const editarPedidoItemSchema = z.object({
  cantidad: z
    .number()
    .int('La cantidad debe ser un número entero')
    .min(1, 'La cantidad mínima por ítem es 1 (RN-12)')
    .max(99, 'La cantidad máxima por ítem es 99 (RN-12)')
    .optional(),
  nota: z
    .string()
    .trim()
    .max(140, 'La nota del ítem no puede superar 140 caracteres (RN-12)')
    .optional()
    .nullable(),
});
export type EditarPedidoItemInput = z.input<typeof editarPedidoItemSchema>;
export type EditarPedidoItemOutput = z.infer<typeof editarPedidoItemSchema>;

export const pedidoItemSchema = z.object({
  id: uuidSchema,
  productoId: uuidSchema,
  nombre: z.string(),
  precioUnitario: pesosSchema,
  cantidad: z
    .number()
    .int('La cantidad debe ser un número entero')
    .min(1, 'La cantidad mínima por ítem es 1 (RN-12)')
    .max(99, 'La cantidad máxima por ítem es 99 (RN-12)'),
  nota: z.string().max(140).nullable().optional(),
  totalLinea: pesosSchema,
  orden: z.number().int().optional(),
});
export type PedidoItem = z.infer<typeof pedidoItemSchema>;

// --- Pedido completo (docs/API.md) ---

export const pedidoMesaResumenSchema = z.object({
  id: uuidSchema,
  nombre: z.string(),
});
export type PedidoMesaResumen = z.infer<typeof pedidoMesaResumenSchema>;

export const pedidoSchema = z.object({
  id: uuidSchema,
  numeroDia: z.number().int().positive('El número del día debe ser positivo'),
  fechaOperativa: fechaOperativaSchema,
  tipo: z.enum(TIPOS_PEDIDO),
  mesa: pedidoMesaResumenSchema.nullable(),
  clienteId: uuidSchema.nullable().optional(),
  usuarioId: uuidSchema.optional(),
  estado: z.enum(ESTADOS_PEDIDO),
  estadoComanda: z.enum(ESTADOS_COMANDA).nullable().optional(),
  items: z.array(pedidoItemSchema),
  total: pesosSchema,
  base: pesosSchema,
  impuesto: pesosSchema,
  nota: z.string().nullable().optional(),
  version: z.number().int().min(0, 'La versión debe ser mayor o igual a 0'),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  confirmadoAt: z.string().nullable().optional(),
  cerradoAt: z.string().nullable().optional(),
  anuladoAt: z.string().nullable().optional(),
});
export type Pedido = z.infer<typeof pedidoSchema>;

// --- Confirmar / Anular Pedido (RN-50) ---

export const confirmarPedidoSchema = z.object({
  version: z
    .number()
    .int('La versión debe ser un número entero')
    .min(0, 'La versión debe ser mayor o igual a 0'),
});
export type ConfirmarPedidoInput = z.input<typeof confirmarPedidoSchema>;
export type ConfirmarPedidoOutput = z.infer<typeof confirmarPedidoSchema>;

export const anularPedidoSchema = z.object({
  version: z
    .number()
    .int('La versión debe ser un número entero')
    .min(0, 'La versión debe ser mayor o igual a 0'),
  motivo: z
    .string()
    .trim()
    .min(5, 'El motivo de anulación debe tener al menos 5 caracteres (RN-50)')
    .max(500, 'El motivo de anulación no puede superar 500 caracteres'),
});
export type AnularPedidoInput = z.input<typeof anularPedidoSchema>;
export type AnularPedidoOutput = z.infer<typeof anularPedidoSchema>;

// --- Consultas ---

export const listarPedidosQuerySchema = paginacionQuerySchema.extend({
  estado: z.enum(ESTADOS_PEDIDO).optional(),
  fechaOperativa: fechaOperativaSchema.optional(),
  tipo: z.enum(TIPOS_PEDIDO).optional(),
});
export type ListarPedidosQuery = z.infer<typeof listarPedidosQuerySchema>;
