import { z } from 'zod';
import { paginacionQuerySchema, paginacionRespuestaSchema, uuidSchema } from './common';

// --- Cliente ---
// Nota de datos personales: guarda solo lo mínimo (nombre, teléfono, documento, email opcionales).

export const clienteSchema = z.object({
  id: uuidSchema,
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre del cliente es obligatorio')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  telefono: z
    .string()
    .trim()
    .min(7, 'El teléfono debe tener al menos 7 caracteres')
    .max(20, 'El teléfono no puede superar 20 caracteres')
    .nullable()
    .optional(),
  documento: z
    .string()
    .trim()
    .max(30, 'El documento no puede superar 30 caracteres')
    .nullable()
    .optional(),
  email: z
    .string()
    .trim()
    .email('El correo electrónico no es válido')
    .max(100, 'El correo electrónico no puede superar 100 caracteres')
    .nullable()
    .optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Cliente = z.infer<typeof clienteSchema>;

export const crearClienteSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre del cliente es obligatorio')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  telefono: z
    .string()
    .trim()
    .min(7, 'El teléfono debe tener al menos 7 caracteres')
    .max(20, 'El teléfono no puede superar 20 caracteres')
    .nullable()
    .optional(),
  documento: z
    .string()
    .trim()
    .max(30, 'El documento no puede superar 30 caracteres')
    .nullable()
    .optional(),
  email: z
    .string()
    .trim()
    .email('El correo electrónico no es válido')
    .max(100, 'El correo electrónico no puede superar 100 caracteres')
    .nullable()
    .optional(),
});
export type CrearClienteInput = z.input<typeof crearClienteSchema>;
export type CrearClienteOutput = z.infer<typeof crearClienteSchema>;

export const buscarClientesQuerySchema = paginacionQuerySchema.extend({
  q: z.string().trim().optional(),
});
export type BuscarClientesQuery = z.infer<typeof buscarClientesQuerySchema>;

export const clientesPaginadosRespuestaSchema = paginacionRespuestaSchema(clienteSchema);
export type ClientesPaginadosRespuesta = z.infer<typeof clientesPaginadosRespuestaSchema>;
