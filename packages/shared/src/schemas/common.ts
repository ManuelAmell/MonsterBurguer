import { z } from 'zod';

/** Identificador UUID v7 / estándar (docs/API.md § Convenciones). */
export const uuidSchema = z.string().uuid('Identificador inválido: debe ser un UUID válido');

/**
 * Monto en pesos COP (RN-01).
 * Todos los montos se guardan y calculan como enteros en pesos (sin centavos), ≥ 0.
 */
export const pesosSchema = z
  .number()
  .int('El monto debe ser un número entero en pesos COP (RN-01)')
  .min(0, 'El monto no puede ser negativo (RN-01)');

/**
 * Fecha operativa en formato YYYY-MM-DD (RN-16).
 * Verifica formato y existencia real en el calendario.
 */
export const fechaOperativaSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'La fecha operativa debe tener formato YYYY-MM-DD (ej: 2026-10-06) (RN-16)',
  )
  .refine((val) => {
    const parts = val.split('-').map(Number);
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    if (year === undefined || month === undefined || day === undefined) {
      return false;
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, 'La fecha operativa no corresponde a una fecha válida en el calendario');

/**
 * Parámetros de consulta estándar para listas paginadas (docs/API.md).
 * ?limit=50&cursor=<id>
 */
export const paginacionQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int('El límite debe ser un número entero')
    .min(1, 'El límite mínimo es 1')
    .max(100, 'El límite máximo es 100')
    .default(50)
    .optional(),
  cursor: z.string().optional(),
});
export type PaginacionQuery = z.infer<typeof paginacionQuerySchema>;

/**
 * Esquema de respuesta paginada genérica (docs/API.md).
 * { items: [...], nextCursor: string | null }
 */
export function paginacionRespuestaSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable(),
  });
}
