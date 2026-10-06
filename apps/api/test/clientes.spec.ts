import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ApiErrorBody, Cliente, ClientesPaginadosRespuesta } from '@mb/shared';
import { crearApp } from '../src/app.factory';
import { cargarEnv } from '../src/config/env';
import { DB, type Db } from '../src/shared-kernel/db/db';
import { crearUsuario, DATABASE_URL_TEST, prepararBaseDeTest } from './helpers/test-db';

const ORIGEN = 'http://localhost:5173';

describe.skipIf(!DATABASE_URL_TEST)('módulo clientes: API y reglas de negocio', () => {
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

  describe('Permisos por rol (RN-51)', () => {
    it('rechaza GET y POST /clientes sin sesión (401)', async () => {
      const resGet = await get('/clientes');
      expect(resGet.status).toBe(401);

      const resPost = await post('/clientes', { nombre: 'Sin Auth' });
      expect(resPost.status).toBe(401);
    });

    it('rechaza GET y POST /clientes para rol COCINA (403)', async () => {
      const resGet = await get('/clientes', cookieCocina);
      expect(resGet.status).toBe(403);

      const resPost = await post('/clientes', { nombre: 'Cocina Cliente' }, cookieCocina);
      expect(resPost.status).toBe(403);
    });

    it('permite GET y POST /clientes para rol ADMIN (200 / 201)', async () => {
      const resPost = await post(
        '/clientes',
        { nombre: 'Cliente Admin', telefono: '3000000001' },
        cookieAdmin,
      );
      expect(resPost.status).toBe(201);

      const resGet = await get('/clientes', cookieAdmin);
      expect(resGet.status).toBe(200);
    });

    it('permite GET y POST /clientes para rol CAJERO (200 / 201)', async () => {
      const resPost = await post(
        '/clientes',
        { nombre: 'Cliente Cajero', telefono: '3000000002' },
        cookieCajero,
      );
      expect(resPost.status).toBe(201);

      const resGet = await get('/clientes', cookieCajero);
      expect(resGet.status).toBe(200);
    });
  });

  describe('Creación de cliente y datos mínimos personales', () => {
    it('crea cliente solo con nombre obligatorio', async () => {
      const res = await post('/clientes', { nombre: 'Pedro Mínimo' }, cookieAdmin);
      expect(res.status).toBe(201);
      const data = (await res.json()) as Cliente;
      expect(data.nombre).toBe('Pedro Mínimo');
      expect(data.telefono).toBeNull();
      expect(data.documento).toBeNull();
      expect(data.email).toBeNull();
      expect(data.id).toBeDefined();
    });

    it('crea cliente completo con todos los datos opcionales', async () => {
      const res = await post(
        '/clientes',
        {
          nombre: 'Laura Morales',
          telefono: '3157778899',
          documento: 'CC10203040',
          email: 'laura@example.com',
        },
        cookieAdmin,
      );
      expect(res.status).toBe(201);
      const data = (await res.json()) as Cliente;
      expect(data.nombre).toBe('Laura Morales');
      expect(data.telefono).toBe('3157778899');
      expect(data.documento).toBe('CC10203040');
      expect(data.email).toBe('laura@example.com');
    });
  });

  describe('Teléfono duplicado → 409 y teléfono UNIQUE parcial', () => {
    it('rechaza crear dos clientes con el mismo teléfono (409)', async () => {
      const tel = '3201112233';
      const primerRes = await post(
        '/clientes',
        { nombre: 'Primero con Tel', telefono: tel },
        cookieAdmin,
      );
      expect(primerRes.status).toBe(201);

      const segundoRes = await post(
        '/clientes',
        { nombre: 'Segundo con Mismo Tel', telefono: tel },
        cookieAdmin,
      );
      expect(segundoRes.status).toBe(409);
      const error = (await segundoRes.json()) as ApiErrorBody;
      expect(error.codigo).toBe('TELEFONO_DUPLICADO');
    });

    it('permite múltiples clientes con teléfono nulo o no provisto', async () => {
      const res1 = await post('/clientes', { nombre: 'Sin Teléfono 1' }, cookieAdmin);
      const res2 = await post('/clientes', { nombre: 'Sin Teléfono 2' }, cookieAdmin);
      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
    });
  });

  describe('Búsqueda insensible a tildes y mayúsculas (GET /clientes?q=)', () => {
    beforeAll(async () => {
      await post(
        '/clientes',
        {
          nombre: 'José Ángel Pérez',
          telefono: '3105551234',
          documento: 'CC998877',
        },
        cookieAdmin,
      );
      await post(
        '/clientes',
        {
          nombre: 'Álvaro Gómez Castaño',
          telefono: '3116664321',
          documento: 'TI112233',
        },
        cookieAdmin,
      );
    });

    it('encuentra "José Ángel Pérez" buscando sin tildes y en minúsculas ("jose")', async () => {
      const res = await get('/clientes?q=jose', cookieCajero);
      expect(res.status).toBe(200);
      const body = (await res.json()) as ClientesPaginadosRespuesta;
      const nombres = body.items.map((c) => c.nombre);
      expect(nombres).toContain('José Ángel Pérez');
    });

    it('encuentra "José Ángel Pérez" buscando en mayúsculas ("JOSÉ")', async () => {
      const res = await get('/clientes?q=JOSÉ', cookieCajero);
      expect(res.status).toBe(200);
      const body = (await res.json()) as ClientesPaginadosRespuesta;
      const nombres = body.items.map((c) => c.nombre);
      expect(nombres).toContain('José Ángel Pérez');
    });

    it('encuentra "Álvaro Gómez" buscando con o sin tildes ("alvaro", "gomez")', async () => {
      const resAlvaro = await get('/clientes?q=alvaro', cookieCajero);
      const bodyAlvaro = (await resAlvaro.json()) as ClientesPaginadosRespuesta;
      expect(bodyAlvaro.items.map((c) => c.nombre)).toContain('Álvaro Gómez Castaño');

      const resGomez = await get('/clientes?q=GÓMEZ', cookieCajero);
      const bodyGomez = (await resGomez.json()) as ClientesPaginadosRespuesta;
      expect(bodyGomez.items.map((c) => c.nombre)).toContain('Álvaro Gómez Castaño');
    });

    it('encuentra clientes por fragmento de teléfono', async () => {
      const res = await get('/clientes?q=5551234', cookieCajero);
      expect(res.status).toBe(200);
      const body = (await res.json()) as ClientesPaginadosRespuesta;
      expect(body.items.map((c) => c.nombre)).toContain('José Ángel Pérez');
    });

    it('encuentra clientes por fragmento de documento', async () => {
      const res = await get('/clientes?q=998877', cookieCajero);
      expect(res.status).toBe(200);
      const body = (await res.json()) as ClientesPaginadosRespuesta;
      expect(body.items.map((c) => c.nombre)).toContain('José Ángel Pérez');
    });
  });

  describe('Paginación en búsqueda de clientes', () => {
    it('soporta paginación con limit y cursor', async () => {
      const res = await get('/clientes?limit=2', cookieAdmin);
      expect(res.status).toBe(200);
      const body = (await res.json()) as ClientesPaginadosRespuesta;
      expect(body.items.length).toBeLessThanOrEqual(2);
      if (body.nextCursor) {
        const resPagina2 = await get(`/clientes?limit=2&cursor=${body.nextCursor}`, cookieAdmin);
        expect(resPagina2.status).toBe(200);
        const bodyPagina2 = (await resPagina2.json()) as ClientesPaginadosRespuesta;
        expect(bodyPagina2.items.length).toBeGreaterThan(0);
      }
    });
  });
});
