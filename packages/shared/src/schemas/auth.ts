import { z } from 'zod';
import { ROLES } from '../enums';

export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'Escribe tu usuario')
    .max(50, 'Máximo 50 caracteres')
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1, 'Escribe tu contraseña').max(200, 'Máximo 200 caracteres'),
});
export type LoginInput = z.input<typeof loginSchema>;

export const usuarioSesionSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
  username: z.string(),
  rol: z.enum(ROLES),
});
export type UsuarioSesion = z.infer<typeof usuarioSesionSchema>;
