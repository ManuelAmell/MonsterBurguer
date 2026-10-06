import { v7 } from 'uuid';

/** UUID v7: ordenable por tiempo; se genera en la app (compatible con PostgreSQL 17 y 18). */
export function nuevoId(): string {
  return v7();
}
