import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../src/app.factory';
import { cargarEnv } from '../src/config/env';
import { DB, type Db } from '../src/shared-kernel/db/db';
import { crearUsuario, DATABASE_URL_TEST, prepararBaseDeTest } from './helpers/test-db';
import type { ConfiguracionNegocio } from '@mb/shared';

const ORIGEN = 'http://localhost:5173';

describe.skipIf(!DATABASE_URL_TEST)('Configuración del negocio (ADMIN)', () => {
  let app: INestApplication;
  let db: Db;
  let base: string;
  let cookieAdmin: string;
  let cookieCajero: string;

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
    await crearUsuario(db, { username: 'caja1', password: 'caja1234', rol: 'CAJERO' });

    const resAdmin = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGEN },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    cookieAdmin = resAdmin.headers.get('set-cookie')?.split(';')[0] ?? '';

    const resCajero = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGEN },
      body: JSON.stringify({ username: 'caja1', password: 'caja1234' }),
    });
    cookieCajero = resCajero.headers.get('set-cookie')?.split(';')[0] ?? '';
  });

  afterAll(async () => {
    await app?.close();
  });

  const get = (ruta: string, cookie?: string) =>
    fetch(`${base}${ruta}`, {
      headers: { origin: ORIGEN, ...(cookie ? { cookie } : {}) },
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

  describe('Permisos RBAC (RN-51)', () => {
    it('rechaza GET /admin/configuracion sin sesión → 401', async () => {
      const res = await get('/admin/configuracion');
      expect(res.status).toBe(401);
    });

    it('rechaza GET /admin/configuracion con rol CAJERO → 403', async () => {
      const res = await get('/admin/configuracion', cookieCajero);
      expect(res.status).toBe(403);
    });

    it('rechaza PUT /admin/configuracion con rol CAJERO → 403', async () => {
      const res = await put(
        '/admin/configuracion',
        {
          nombre: 'MonsterBurguer',
          nit: '123',
          direccion: 'Calle 1',
          telefono: '123',
          pieRecibo: 'Gracias',
          propinaSugeridaPorcentaje: 10,
          horaCorte: '05:00',
        },
        cookieCajero,
      );
      expect(res.status).toBe(403);
    });
  });

  describe('GET y PUT /admin/configuracion', () => {
    it('obtiene configuración inicial con GET /admin/configuracion', async () => {
      const res = await get('/admin/configuracion', cookieAdmin);
      expect(res.status).toBe(200);
      const conf = await res.json();
      expect(conf).toHaveProperty('nombre');
      expect(conf).toHaveProperty('nit');
      expect(conf).toHaveProperty('direccion');
      expect(conf).toHaveProperty('telefono');
      expect(conf).toHaveProperty('pieRecibo');
      expect(conf).toHaveProperty('propinaSugeridaPorcentaje');
      expect(conf).toHaveProperty('horaCorte');
    });

    it('RN-06: rechaza PUT /admin/configuracion con propina > 10 % (Ley 1935 de 2018) → 400', async () => {
      const res = await put(
        '/admin/configuracion',
        {
          nombre: 'MonsterBurguer',
          nit: '900.123.456-7',
          direccion: 'Centro Histórico',
          telefono: '3001234567',
          pieRecibo: 'Gracias por su compra',
          propinaSugeridaPorcentaje: 12,
          horaCorte: '05:00',
        },
        cookieAdmin,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { codigo?: string };
      expect(body.codigo).toBe('VALIDACION');
    });

    it('RN-16: rechaza PUT /admin/configuracion con hora de corte inválida → 400', async () => {
      const res = await put(
        '/admin/configuracion',
        {
          nombre: 'MonsterBurguer',
          nit: '900.123.456-7',
          direccion: 'Centro Histórico',
          telefono: '3001234567',
          pieRecibo: 'Gracias',
          propinaSugeridaPorcentaje: 10,
          horaCorte: '26:00',
        },
        cookieAdmin,
      );
      expect(res.status).toBe(400);
    });

    it('actualiza y persiste la configuración exitosamente', async () => {
      const nuevaConfig = {
        nombre: 'MonsterBurguer Express',
        nit: '901.999.888-1',
        direccion: 'Av. Pedro de Heredia # 32-14',
        telefono: '3019876543',
        pieRecibo: '¡Gracias por apoyar el talento local! Síguenos en redes @monsterburguer',
        propinaSugeridaPorcentaje: 8,
        horaCorte: '06:00',
      };

      const resPut = await put('/admin/configuracion', nuevaConfig, cookieAdmin);
      expect(resPut.status).toBe(200);
      const confActualizada = (await resPut.json()) as ConfiguracionNegocio;
      expect(confActualizada.nombre).toBe(nuevaConfig.nombre);
      expect(confActualizada.nit).toBe(nuevaConfig.nit);
      expect(confActualizada.direccion).toBe(nuevaConfig.direccion);
      expect(confActualizada.telefono).toBe(nuevaConfig.telefono);
      expect(confActualizada.pieRecibo).toBe(nuevaConfig.pieRecibo);
      expect(confActualizada.propinaSugeridaPorcentaje).toBe(nuevaConfig.propinaSugeridaPorcentaje);
      expect(confActualizada.horaCorte).toBe(nuevaConfig.horaCorte);

      // Verificar que el siguiente GET retorna los valores actualizados
      const resGet = await get('/admin/configuracion', cookieAdmin);
      expect(resGet.status).toBe(200);
      const confGet = (await resGet.json()) as ConfiguracionNegocio;
      expect(confGet).toEqual(confActualizada);
    });
  });
});
