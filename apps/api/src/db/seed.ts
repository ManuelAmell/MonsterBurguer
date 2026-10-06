// Datos semilla de desarrollo: usuarios de prueba y configuración inicial. Idempotente.
// Uso: pnpm --filter api db:seed
import * as argon2 from 'argon2';
import type { Rol } from '@mb/shared';
import { crearDb, crearPool } from '../shared-kernel/db/db';
import { configuracion, CONFIGURACION_INICIAL } from '../shared-kernel/configuracion/configuracion.schema';
import { nuevoId } from '../shared-kernel/ids';
import { usuario } from '../modules/identidad/identidad.schema';
import { mesa } from '../modules/pedidos/pedidos.schema';

const USUARIOS_DEMO: { nombre: string; username: string; password: string; rol: Rol }[] = [
  { nombre: 'Administrador', username: 'admin', password: 'admin123', rol: 'ADMIN' },
  { nombre: 'Caja 1', username: 'caja1', password: 'caja1234', rol: 'CAJERO' },
  { nombre: 'Cocina 1', username: 'cocina1', password: 'cocina1234', rol: 'COCINA' },
];

const MESAS_DEMO = Array.from({ length: 8 }, (_, i) => ({
  nombre: `Mesa ${i + 1}`,
  capacidad: 4,
  activa: true,
  orden: i + 1,
}));

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('El seed de demo no se ejecuta en producción');
  }

  const pool = crearPool(url);
  const db = crearDb(pool);
  try {
    for (const u of USUARIOS_DEMO) {
      await db
        .insert(usuario)
        .values({
          id: nuevoId(),
          nombre: u.nombre,
          username: u.username,
          passwordHash: await argon2.hash(u.password, { type: argon2.argon2id }),
          rol: u.rol,
        })
        .onConflictDoNothing({ target: usuario.username });
    }

    for (const m of MESAS_DEMO) {
      await db
        .insert(mesa)
        .values({
          id: nuevoId(),
          nombre: m.nombre,
          capacidad: m.capacidad,
          activa: m.activa,
          orden: m.orden,
        })
        .onConflictDoNothing({ target: mesa.nombre });
    }

    await db
      .insert(configuracion)
      .values(Object.entries(CONFIGURACION_INICIAL).map(([clave, valor]) => ({ clave, valor })))
      .onConflictDoNothing({ target: configuracion.clave });

    console.info(
      `Seed listo: usuarios ${USUARIOS_DEMO.map((u) => u.username).join(', ')}, 8 mesas`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
