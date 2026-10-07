import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { count, eq as drizzleEq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ApiErrorBody, Mesa, MesaConEstado } from '@mb/shared';
import { crearApp } from '../src/app.factory';
import { cargarEnv } from '../src/config/env';
import { DB, type Db } from '../src/shared-kernel/db/db';
import { mesa } from '../src/modules/pedidos/pedidos.schema';
import { nuevoId } from '../src/shared-kernel/ids';
import { crearUsuario, DATABASE_URL_TEST, prepararBaseDeTest } from './helpers/test-db';

const ORIGEN = 'http://localhost:5173';

const MESAS_DEMO = Array.from({ length: 8 }, (_, i) => ({
  nombre: `Mesa ${i + 1}`,
  capacidad: 4,
  activa: true,
  orden: i + 1,
}));

async function sembrarMesasIdempotente(db: Db): Promise<void> {
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
}

describe.skipIf(!DATABASE_URL_TEST)('módulo pedidos (mesas): API y reglas de negocio', () => {
  let app: INestApplication;
  let db: Db;
  let base: string;
  let cookieAdmin: string;
  let cookieCajero: string;
  let cookieCocina: string;

  beforeAll(async () => {
    const url = DATABASE_URL_TEST as string;
    await prepararBaseDeTest(url);
    app = await crearApp(
      cargarEnv({ NODE_ENV: 'test', APP_ORIGIN: ORIGEN, DATABASE_URL: url, LOG_LEVEL: 'silent' }),
    );
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    base = `http://127.0.0.1:${port}/api/v1`;
    db = app.get<Db>(DB);

    await crearUsuario(db, { username: 'admin', password: 'admin123', rol: 'ADMIN' });
    await crearUsuario(db, { username: 'cajero', password: 'caja1234', rol: 'CAJERO' });
    await crearUsuario(db, { username: 'cocina', password: 'cocina1234', rol: 'COCINA' });

    const login = async (u: string, p: string) => {
      const res = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGEN },
        body: JSON.stringify({ username: u, password: p }),
      });
      return res.headers.get('set-cookie')?.split(';')[0] ?? '';
    };

    cookieAdmin = await login('admin', 'admin123');
    cookieCajero = await login('cajero', 'caja1234');
    cookieCocina = await login('cocina', 'cocina1234');
  });

  afterAll(async () => {
    await app?.close();
  });

  const get = (ruta: string, cookie?: string) =>
    fetch(`${base}${ruta}`, {
      headers: cookie ? { cookie } : {},
    });

  const post = (ruta: string, body: unknown, cookie?: string) =>
    fetch(`${base}${ruta}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: ORIGEN,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });

  const patch = (ruta: string, body: unknown, cookie?: string) =>
    fetch(`${base}${ruta}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        origin: ORIGEN,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });

  const put = (ruta: string, body: unknown, cookie?: string) =>
    fetch(`${base}${ruta}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        origin: ORIGEN,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });

  describe('Permisos por rol (RN-51)', () => {
    it('rechaza GET /mesas sin sesión (401)', async () => {
      const res = await get('/mesas');
      expect(res.status).toBe(401);
    });

    it('rechaza GET /mesas para rol COCINA (403)', async () => {
      const res = await get('/mesas', cookieCocina);
      expect(res.status).toBe(403);
    });

    it('permite GET /mesas para CAJERO y ADMIN (200)', async () => {
      const resCajero = await get('/mesas', cookieCajero);
      expect(resCajero.status).toBe(200);

      const resAdmin = await get('/mesas', cookieAdmin);
      expect(resAdmin.status).toBe(200);
    });

    it('solo ADMIN puede crear mesas (POST /mesas)', async () => {
      const resSinAuth = await post('/mesas', { nombre: 'Mesa Test' });
      expect(resSinAuth.status).toBe(401);

      const resCajero = await post('/mesas', { nombre: 'Mesa Cajero' }, cookieCajero);
      expect(resCajero.status).toBe(403);

      const resCocina = await post('/mesas', { nombre: 'Mesa Cocina' }, cookieCocina);
      expect(resCocina.status).toBe(403);

      const resAdmin = await post('/mesas', { nombre: 'Mesa Permiso Admin' }, cookieAdmin);
      expect(resAdmin.status).toBe(201);
    });

    it('solo ADMIN puede editar mesas (PATCH /mesas/:id)', async () => {
      const mesaCreada = ((await (
        await post('/mesas', { nombre: 'Mesa Editable' }, cookieAdmin)
      ).json()) as Mesa);

      const resCajero = await patch(
        `/mesas/${mesaCreada.id}`,
        { nombre: 'Mesa Editada Cajero' },
        cookieCajero,
      );
      expect(resCajero.status).toBe(403);

      const resAdmin = await patch(
        `/mesas/${mesaCreada.id}`,
        { nombre: 'Mesa Editada Admin' },
        cookieAdmin,
      );
      expect(resAdmin.status).toBe(200);
    });
  });

  describe('GET /mesas y estructura de estado (docs/API.md)', () => {
    it('devuelve ocupada: false y pedidoId: null con estructura mesaConEstadoSchema', async () => {
      const res = await get('/mesas', cookieCajero);
      expect(res.status).toBe(200);
      const mesas = (await res.json()) as MesaConEstado[];
      expect(Array.isArray(mesas)).toBe(true);
      expect(mesas.length).toBeGreaterThan(0);

      for (const m of mesas) {
        expect(m.id).toBeDefined();
        expect(m.nombre).toBeDefined();
        expect(m.capacidad).toBeDefined();
        expect(m.activa).toBeDefined();
        expect(m.orden).toBeDefined();
        expect(m.ocupada).toBe(false);
        expect(m.pedidoId).toBeNull();
      }
    });
  });

  describe('CRUD admin: crear, renombrar, activar/desactivar y ordenar mesas', () => {
    let mesaId: string;

    it('crea una mesa nueva con orden y capacidad', async () => {
      const res = await post(
        '/mesas',
        { nombre: 'Terraza 1', capacidad: 6, orden: 20 },
        cookieAdmin,
      );
      expect(res.status).toBe(201);
      const data = (await res.json()) as Mesa;
      expect(data.nombre).toBe('Terraza 1');
      expect(data.capacidad).toBe(6);
      expect(data.orden).toBe(20);
      expect(data.activa).toBe(true);
      mesaId = data.id;
    });

    it('rechaza crear mesa con nombre duplicado (409)', async () => {
      const res = await post('/mesas', { nombre: 'Terraza 1' }, cookieAdmin);
      expect(res.status).toBe(409);
      const error = (await res.json()) as ApiErrorBody;
      expect(error.codigo).toBe('MESA_DUPLICADA');
    });

    it('renombra la mesa mediante PATCH', async () => {
      const res = await patch('/mesas/' + mesaId, { nombre: 'Terraza VIP' }, cookieAdmin);
      expect(res.status).toBe(200);
      const data = (await res.json()) as Mesa;
      expect(data.nombre).toBe('Terraza VIP');
    });

    it('desactiva la mesa (activa = false)', async () => {
      const res = await patch('/mesas/' + mesaId, { activa: false }, cookieAdmin);
      expect(res.status).toBe(200);
      const data = (await res.json()) as Mesa;
      expect(data.activa).toBe(false);

      const detalle = await get('/mesas/' + mesaId, cookieAdmin);
      expect(detalle.status).toBe(200);
      const detalleData = (await detalle.json()) as Mesa;
      expect(detalleData.activa).toBe(false);
    });

    it('reactiva la mesa (activa = true)', async () => {
      const res = await patch('/mesas/' + mesaId, { activa: true }, cookieAdmin);
      expect(res.status).toBe(200);
      const data = (await res.json()) as Mesa;
      expect(data.activa).toBe(true);
    });

    it('reordena mesas mediante PUT /mesas/orden', async () => {
      const res = await put(
        '/mesas/orden',
        {
          mesas: [{ id: mesaId, orden: 99 }],
        },
        cookieAdmin,
      );
      expect(res.status).toBe(200);
      const lista = (await res.json()) as MesaConEstado[];
      const mesaModificada = lista.find((m) => m.id === mesaId);
      expect(mesaModificada?.orden).toBe(99);
    });
  });

  describe('Seed idempotente de 8 mesas', () => {
    it('ejecutar el seed dos veces produce exactamente las 8 mesas sin duplicados ni errores', async () => {
      await sembrarMesasIdempotente(db);
      await sembrarMesasIdempotente(db);

      const [resCount] = await db.select({ total: count() }).from(mesa);
      // Incluye las 8 del seed más las creadas en las pruebas anteriores
      expect(Number(resCount?.total)).toBeGreaterThanOrEqual(8);

      // Verificar que las 8 mesas del seed existen exactamente una vez cada una
      for (let i = 1; i <= 8; i++) {
        const nombre = `Mesa ${i}`;
        const filas = await db.select().from(mesa).where(drizzleEq(mesa.nombre, nombre));
        expect(filas.length).toBe(1);
        expect(filas[0]?.orden).toBe(i);
        expect(filas[0]?.capacidad).toBe(4);
      }
    });
  });
});
