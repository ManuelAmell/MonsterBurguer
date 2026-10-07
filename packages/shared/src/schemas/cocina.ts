import { z } from 'zod';
import { ESTADOS_COMANDA, TIPOS_PEDIDO } from '../enums';
import { uuidSchema } from './common';

// --- Items de Comanda ---

export const comandaItemSchema = z.object({
  id: uuidSchema,
  nombre: z.string().trim().min(1, 'El nombre del ítem es obligatorio'),
  cantidad: z
    .number()
    .int('La cantidad debe ser un número entero')
    .positive('La cantidad debe ser mayor a 0'),
  nota: z.string().nullable().optional(),
  orden: z.number().int().optional(),
});
export type ComandaItem = z.infer<typeof comandaItemSchema>;

// --- Comanda completa (docs/API.md § Cocina) ---

export const comandaSchema = z.object({
  id: uuidSchema,
  pedidoId: uuidSchema,
  numeroDia: z.number().int().positive('El número del día debe ser positivo'),
  tipoPedido: z.enum(TIPOS_PEDIDO),
  mesaNombre: z.string().nullable().optional(),
  estado: z.enum(ESTADOS_COMANDA),
  items: z.array(comandaItemSchema),
  iniciadaAt: z.string().nullable().optional(),
  listaAt: z.string().nullable().optional(),
  entregadaAt: z.string().nullable().optional(),
  anuladaAt: z.string().nullable().optional(),
  version: z.number().int().min(0, 'La versión debe ser mayor o igual a 0'),
  createdAt: z.string(),
});
export type Comanda = z.infer<typeof comandaSchema>;

// --- Transiciones de Comanda (iniciar, lista, entregar, deshacer) ---

export const transicionComandaSchema = z.object({
  version: z
    .number()
    .int('La versión debe ser un número entero')
    .min(0, 'La versión debe ser mayor o igual a 0')
    .optional(),
});
export type TransicionComandaInput = z.input<typeof transicionComandaSchema>;
export type TransicionComandaOutput = z.infer<typeof transicionComandaSchema>;

// --- Consulta de Comandas ---

export const listarComandasQuerySchema = z.object({
  // z.coerce.boolean() convertiría "false" en true: se parsea el texto de la query explícitamente.
  activas: z
    .enum(['true', 'false', '1', '0'])
    .transform((v) => v === 'true' || v === '1')
    .optional(),
  estado: z.enum(ESTADOS_COMANDA).optional(),
});
export type ListarComandasQuery = z.infer<typeof listarComandasQuerySchema>;
