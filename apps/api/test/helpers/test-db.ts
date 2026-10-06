import { existsSync } from 'node:fs';
import path from 'node:path';
import * as argon2 from 'argon2';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Rol } from '@mb/shared';
import { crearDb, crearPool, type Db } from '../../src/shared-kernel/db/db';
import { nuevoId } from '../../src/shared-kernel/ids';
import { usuario } from '../../src/modules/identidad/identidad.schema';

const ENV_FILE = path.resolve(__dirname, '../../.env');
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

/** URL de la base de tests. Si no está definida, los tests de integración se omiten. */
export const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

/** Deja la base de tests vacía y con todas las migraciones aplicadas. */
export async function prepararBaseDeTest(url: string): Promise<void> {
  const pool = crearPool(url);
  const db = crearDb(pool);
  try {
    await db.execute(sql`drop schema if exists public cascade`);
    await db.execute(sql`drop schema if exists drizzle cascade`);
    await db.execute(sql`create schema public`);
    await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
  } finally {
    await pool.end();
  }
}

export async function crearUsuario(
  db: Db,
  datos: { username: string; password: string; rol: Rol; activo?: boolean },
): Promise<string> {
  const id = nuevoId();
  await db.insert(usuario).values({
    id,
    nombre: datos.username,
    username: datos.username,
    passwordHash: await argon2.hash(datos.password, { type: argon2.argon2id }),
    rol: datos.rol,
    activo: datos.activo ?? true,
  });
  return id;
}
