import { z } from 'zod';

/** Formato único de error de la API (docs/API.md "Formato de error"). */
export const apiErrorSchema = z.object({
  codigo: z.string(),
  mensaje: z.string(),
  detalles: z.unknown().optional(),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export const CODIGOS_ERROR = {
  VALIDACION: 'VALIDACION',
  NO_AUTENTICADO: 'NO_AUTENTICADO',
  CREDENCIALES_INVALIDAS: 'CREDENCIALES_INVALIDAS',
  SIN_PERMISO: 'SIN_PERMISO',
  NO_ENCONTRADO: 'NO_ENCONTRADO',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  ESTADO_INVALIDO: 'ESTADO_INVALIDO',
  DEMASIADOS_INTENTOS: 'DEMASIADOS_INTENTOS',
  ORIGEN_NO_PERMITIDO: 'ORIGEN_NO_PERMITIDO',
  ERROR_INTERNO: 'ERROR_INTERNO',
} as const;
export type CodigoError = (typeof CODIGOS_ERROR)[keyof typeof CODIGOS_ERROR];
