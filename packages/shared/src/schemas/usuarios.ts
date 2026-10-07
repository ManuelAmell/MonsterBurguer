import { z } from 'zod';
import { ROLES } from '../enums';
import { uuidSchema } from './common';

export const rolUsuarioSchema = z.enum(ROLES);
export type RolUsuario = z.infer<typeof rolUsuarioSchema>;

export const usuarioDetalleSchema = z.object({
  id: uuidSchema,
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  username: z.string().trim().min(1, 'El nombre de usuario es obligatorio'),
  rol: rolUsuarioSchema,
  activo: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type UsuarioDetalle = z.infer<typeof usuarioDetalleSchema>;

export const crearUsuarioSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'El nombre de usuario es obligatorio')
    .max(50, 'El nombre de usuario no puede superar 50 caracteres')
    .transform((v) => v.toLowerCase()),
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  rol: rolUsuarioSchema,
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(100, 'La contraseña no puede superar 100 caracteres'),
});
export type CrearUsuarioInput = z.input<typeof crearUsuarioSchema>;
export type CrearUsuarioOutput = z.infer<typeof crearUsuarioSchema>;

export const actualizarUsuarioSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre no puede estar vacío')
    .max(100, 'El nombre no puede superar 100 caracteres')
    .optional(),
  rol: rolUsuarioSchema.optional(),
  activo: z.boolean().optional(),
});
export type ActualizarUsuarioInput = z.input<typeof actualizarUsuarioSchema>;
export type ActualizarUsuarioOutput = z.infer<typeof actualizarUsuarioSchema>;

export const restablecerClaveSchema = z.object({
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(100, 'La contraseña no puede superar 100 caracteres'),
});
export type RestablecerClaveInput = z.input<typeof restablecerClaveSchema>;
export type RestablecerClaveOutput = z.infer<typeof restablecerClaveSchema>;
