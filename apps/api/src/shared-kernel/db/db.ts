import { drizzle, type NodePgDatabase, type NodePgTransaction } from 'drizzle-orm/node-postgres';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import { Pool } from 'pg';

export type Db = NodePgDatabase;
export type Tx = NodePgTransaction<Record<string, never>, ExtractTablesWithRelations<Record<string, never>>>;
/** Ejecutor de queries: la conexión raíz o una transacción en curso. */
export type Executor = Db | Tx;

export const DB = Symbol('DB');
export const PG_POOL = Symbol('PG_POOL');

export function crearPool(connectionString: string, max = 20): Pool {
  return new Pool({ connectionString, max });
}

export function crearDb(pool: Pool): Db {
  return drizzle({ client: pool, casing: 'snake_case' });
}
