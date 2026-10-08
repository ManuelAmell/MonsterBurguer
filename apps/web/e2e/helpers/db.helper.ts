import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(import.meta.dirname, '../../../..');
const apiDir = path.resolve(repoRoot, 'apps/api');
const pgPath = path.resolve(apiDir, 'node_modules/pg');

interface PgClient {
  connect(): Promise<void>;
  query<R = Record<string, unknown>>(queryText: string, values?: unknown[]): Promise<{ rows: R[] }>;
  end(): Promise<void>;
}

const { Client } = require(pgPath) as {
  Client: new (config: { connectionString: string }) => PgClient;
};

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://mb:mb_dev_pass@localhost:5432/mb_qa_final';

export async function conDb<T>(fn: (client: PgClient) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function ejecutarSql(sqlText: string, params: unknown[] = []): Promise<void> {
  await conDb(async (c) => {
    await c.query(sqlText, params);
  });
}

/** Limpia tablas transaccionales y asegura que las mesas queden libres y sin sesiones de caja abiertas. */
export async function limpiarDatosOperativos(): Promise<void> {
  await conDb(async (c) => {
    await c.query(`
      TRUNCATE TABLE
        recibo,
        pago,
        movimiento_caja,
        sesion_caja,
        comanda_item,
        comanda,
        pedido_item,
        pedido,
        movimiento_inventario
      CASCADE;
      DELETE FROM sesion_usuario WHERE usuario_id IN (SELECT id FROM usuario WHERE username NOT IN ('admin', 'caja1', 'cocina1'));
      DELETE FROM usuario WHERE username NOT IN ('admin', 'caja1', 'cocina1');
      DELETE FROM producto WHERE categoria_id IN (SELECT id FROM categoria WHERE nombre NOT IN ('Hamburguesas', 'Acompañamientos', 'Bebidas', 'Postres', 'Salsas y Adicionales'));
      DELETE FROM categoria WHERE nombre NOT IN ('Hamburguesas', 'Acompañamientos', 'Bebidas', 'Postres', 'Salsas y Adicionales');
    `);
  });
  // Ejecutar seed para restablecer inventario inicial de ingredientes y mesas
  execSync('pnpm db:seed', { cwd: apiDir, stdio: 'ignore', shell: 'cmd.exe' });
}

export async function ajustarStockIngrediente(nombre: string, stock: number): Promise<void> {
  await conDb(async (c) => {
    await c.query('UPDATE ingrediente SET stock_actual = $1 WHERE nombre = $2', [stock, nombre]);
  });
}

export async function obtenerStockIngrediente(nombre: string): Promise<number> {
  return conDb(async (c) => {
    const res = await c.query<{ stock_actual: number | string }>(
      'SELECT stock_actual FROM ingrediente WHERE nombre = $1',
      [nombre],
    );
    return Number(res.rows[0]?.stock_actual ?? 0);
  });
}

/** Genera una sesión de usuario válida directamente en BD para evitar saturar el Throttler (5 req/min) en tests secundarios. */
export async function crearSesionDirecta(username: string): Promise<string> {
  const { createHash, randomBytes } = await import('node:crypto');
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const sesionId = randomBytes(16).toString('hex');
  const expiraAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

  await conDb(async (c) => {
    const res = await c.query<{ id: string }>('SELECT id FROM usuario WHERE username = $1', [username]);
    const usuarioId = res.rows[0]?.id;
    if (!usuarioId) throw new Error(`Usuario "${username}" no existe en la base de datos.`);
    await c.query(
      `INSERT INTO sesion_usuario (id, usuario_id, token_hash, expira_at, created_at, ultimo_uso_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [sesionId, usuarioId, tokenHash, expiraAt],
    );
  });

  return token;
}
