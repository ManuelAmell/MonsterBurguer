/**
 * Extrae el código de error de PostgreSQL, navegando recursivamente por `err.cause`
 * si Drizzle ORM o el entorno encapsulan el error nativo del driver pg.
 */
export function codigoPg(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  if ('code' in err && typeof err.code === 'string') return err.code;
  return 'cause' in err ? codigoPg(err.cause) : undefined;
}

/**
 * Determina si un error corresponde a una violación de unicidad en PostgreSQL
 * (código '23505' - unique_violation, aplicable a restricciones y a índices únicos
 * normales o funcionales como lower(nombre)).
 */
export function esViolacionUnicidad(err: unknown): boolean {
  return codigoPg(err) === '23505';
}
