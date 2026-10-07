import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../src/app.factory';
import { cargarEnv } from '../src/config/env';
import { DB, type Db } from '../src/shared-kernel/db/db';
import { crearUsuario, DATABASE_URL_TEST, prepararBaseDeTest } from './helpers/test-db';
import type { UsuarioDetalle } from '@mb/shared';

const ORIGEN = 'http://localhost:5173';

describe.skipIf(!DATABASE_URL_TEST)('CRUD de usuarios y reglas de seguridad (ADMIN)', () => {
  let app: INestApplication;
  let db: Db;
  let base: string;
  let cookieAdmin: string;
  let cookieCajero: string;
  let adminId: string;
  let contadorIp = 1;

  const loginComo = async (username: string, password: string) => {
    contadorIp++;
    const ip = `192.168.10.${contadorIp}`;
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: ORIGEN,
        'x-forwarded-for': ip,
      },
      body: JSON.stringify({ username, password }),
    });
    const cookie = res.headers.get('set-cookie')?.split(';')[0] ?? '';
    return { res, cookie };
  };

  beforeAll(async () => {
    const url = DATABASE_URL_TEST as string;
    await prepararBaseDeTest(url);
    app = await crearApp(
      cargarEnv({ NODE_ENV: 'test', APP_ORIGIN: ORIGEN, DATABASE_URL: url, LOG_LEVEL: 'silent', TRUST_PROXY: 'true' }),
    );
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    base = `http://127.0.0.1:${port}/api/v1`;
    db = app.get<Db>(DB);

    adminId = await crearUsuario(db, { username: 'admin', password: 'admin123', rol: 'ADMIN' });
    await crearUsuario(db, { username: 'caja1', password: 'caja1234', rol: 'CAJERO' });

    // Iniciar sesiones para admin y cajero
    const resAdmin = await loginComo('admin', 'admin123');
    cookieAdmin = resAdmin.cookie;

    const resCajero = await loginComo('caja1', 'caja1234');
    cookieCajero = resCajero.cookie;
  });

  afterAll(async () => {
    await app?.close();
  });

  const get = (ruta: string, cookie?: string) =>
    fetch(`${base}${ruta}`, {
      headers: { origin: ORIGEN, ...(cookie ? { cookie } : {}) },
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

  describe('Permisos RBAC (RN-51)', () => {
    it('RN-51: rechaza GET /usuarios sin sesión → 401', async () => {
      const res = await get('/usuarios');
      expect(res.status).toBe(401);
    });

    it('RN-51: rechaza GET /usuarios con rol CAJERO → 403', async () => {
      const res = await get('/usuarios', cookieCajero);
      expect(res.status).toBe(403);
    });

    it('RN-51: rechaza POST /usuarios con rol CAJERO → 403', async () => {
      const res = await post(
        '/usuarios',
        { username: 'caja2', nombre: 'Cajero', rol: 'CAJERO', password: 'password123' },
        cookieCajero,
      );
      expect(res.status).toBe(403);
    });

    it('RN-51: rechaza PATCH /usuarios/:id con rol CAJERO → 403', async () => {
      const res = await patch(`/usuarios/${adminId}`, { nombre: 'Otro' }, cookieCajero);
      expect(res.status).toBe(403);
    });

    it('RN-51: rechaza POST /usuarios/:id/clave con rol CAJERO → 403', async () => {
      const res = await post(`/usuarios/${adminId}/clave`, { password: 'nuevaClave123' }, cookieCajero);
      expect(res.status).toBe(403);
    });
  });

  describe('Listar usuarios (GET /usuarios)', () => {
    it('permite a ADMIN listar usuarios y nunca devuelve el hash', async () => {
      const res = await get('/usuarios', cookieAdmin);
      expect(res.status).toBe(200);
      const lista = (await res.json()) as UsuarioDetalle[];
      expect(Array.isArray(lista)).toBe(true);
      expect(lista.length).toBeGreaterThanOrEqual(2);

      for (const u of lista) {
        expect(u).toHaveProperty('id');
        expect(u).toHaveProperty('nombre');
        expect(u).toHaveProperty('username');
        expect(u).toHaveProperty('rol');
        expect(u).toHaveProperty('activo');
        expect(u).not.toHaveProperty('passwordHash');
        expect(u).not.toHaveProperty('password');
      }
    });
  });

  describe('Crear usuario (POST /usuarios)', () => {
    it('crea usuario con éxito y retorna detalle sin hash', async () => {
      const res = await post(
        '/usuarios',
        { username: 'cocina1', nombre: 'Cocinero Jefe', rol: 'COCINA', password: 'cocinaClave123' },
        cookieAdmin,
      );
      expect(res.status).toBe(201);
      const creado = (await res.json()) as UsuarioDetalle;
      expect(creado.username).toBe('cocina1');
      expect(creado.nombre).toBe('Cocinero Jefe');
      expect(creado.rol).toBe('COCINA');
      expect(creado.activo).toBe(true);
      expect(creado).not.toHaveProperty('passwordHash');
    });

    it('valida que la clave tenga al menos 8 caracteres → 400', async () => {
      const res = await post(
        '/usuarios',
        { username: 'caja_corta', nombre: 'Test', rol: 'CAJERO', password: 'corta' },
        cookieAdmin,
      );
      expect(res.status).toBe(400);
    });

    it('detecta username duplicado mediante código Postgres 23505 → 409', async () => {
      const res = await post(
        '/usuarios',
        { username: 'admin', nombre: 'Otro Admin', rol: 'ADMIN', password: 'password123' },
        cookieAdmin,
      );
      expect(res.status).toBe(409);
      const err = (await res.json()) as { codigo?: string };
      expect(err.codigo).toBe('USERNAME_DUPLICADO');
    });
  });

  describe('Actualizar usuario y reglas de seguridad (PATCH /usuarios/:id)', () => {
    it('admin no puede desactivarse a sí mismo → 409', async () => {
      const res = await patch(`/usuarios/${adminId}`, { activo: false }, cookieAdmin);
      expect(res.status).toBe(409);
      const err = (await res.json()) as { codigo?: string };
      expect(err.codigo).toBe('OPERACION_INVALIDA');
    });

    it('admin no puede quitarse el rol ADMIN a sí mismo → 409', async () => {
      const res = await patch(`/usuarios/${adminId}`, { rol: 'CAJERO' }, cookieAdmin);
      expect(res.status).toBe(409);
      const err = (await res.json()) as { codigo?: string };
      expect(err.codigo).toBe('OPERACION_INVALIDA');
    });

    it('RN-51: siempre queda un ADMIN activo: con 2 admins se puede desactivar uno, el último no (409)', async () => {
      const resCrear = await post(
        '/usuarios',
        { username: 'admin2', nombre: 'Admin Secundario', rol: 'ADMIN', password: 'adminPassword2' },
        cookieAdmin,
      );
      expect(resCrear.status).toBe(201);
      const admin2 = (await resCrear.json()) as UsuarioDetalle;

      // Con dos admins activos, desactivar al segundo es válido.
      const resDesactivar = await patch(`/usuarios/${admin2.id}`, { activo: false }, cookieAdmin);
      expect(resDesactivar.status).toBe(200);

      // El único admin activo restante no puede desactivarse ni degradarse (409).
      const resUltimo = await patch(`/usuarios/${adminId}`, { activo: false }, cookieAdmin);
      expect(resUltimo.status).toBe(409);
      const resRol = await patch(`/usuarios/${adminId}`, { rol: 'CAJERO' }, cookieAdmin);
      expect(resRol.status).toBe(409);
    });

    it('desactivar un usuario invalida su sesión activa: su siguiente /auth/me → 401', async () => {
      // 1. Crear usuario temporal y loguearse con él
      const resCrear = await post(
        '/usuarios',
        { username: 'cajatest', nombre: 'Caja Test', rol: 'CAJERO', password: 'cajaClave123' },
        cookieAdmin,
      );
      expect(resCrear.status).toBe(201);
      const cajaTest = (await resCrear.json()) as UsuarioDetalle;

      const { res: resLogin, cookie: cookieCajaTest } = await loginComo('cajatest', 'cajaClave123');
      expect(resLogin.status).toBe(200);

      // 2. Verificar que la sesión de cajatest funciona
      const meAntes = await get('/auth/me', cookieCajaTest);
      expect(meAntes.status).toBe(200);

      // 3. Admin desactiva a cajatest
      const resDesactivar = await patch(`/usuarios/${cajaTest.id}`, { activo: false }, cookieAdmin);
      expect(resDesactivar.status).toBe(200);

      // 4. La sesión de cajatest debe caer inmediatamente (401)
      const meDespues = await get('/auth/me', cookieCajaTest);
      expect(meDespues.status).toBe(401);
    });
  });

  describe('Restablecer clave (POST /usuarios/:id/clave)', () => {
    it('restablecer clave invalida sesiones activas y permite login con la nueva clave', async () => {
      // 1. Crear usuario y loguearse
      const resCrear = await post(
        '/usuarios',
        { username: 'cajaclave', nombre: 'Caja Clave', rol: 'CAJERO', password: 'claveOriginal1' },
        cookieAdmin,
      );
      expect(resCrear.status).toBe(201);
      const cajaClave = (await resCrear.json()) as UsuarioDetalle;

      const { res: resLogin1, cookie: cookieVieja } = await loginComo('cajaclave', 'claveOriginal1');
      expect(resLogin1.status).toBe(200);

      // Sesión vieja funciona
      const meAntes = await get('/auth/me', cookieVieja);
      expect(meAntes.status).toBe(200);

      // 2. Admin restablece clave
      const resReset = await post(
        `/usuarios/${cajaClave.id}/clave`,
        { password: 'nuevaClaveSuperSegura' },
        cookieAdmin,
      );
      expect(resReset.status).toBe(200);

      // 3. La sesión vieja queda invalidada (401)
      const meDespues = await get('/auth/me', cookieVieja);
      expect(meDespues.status).toBe(401);

      // 4. Login con la clave vieja falla (401)
      const { res: resLoginViejo } = await loginComo('cajaclave', 'claveOriginal1');
      expect(resLoginViejo.status).toBe(401);

      // 5. Login con la nueva clave funciona (200)
      const { res: resLoginNuevo } = await loginComo('cajaclave', 'nuevaClaveSuperSegura');
      expect(resLoginNuevo.status).toBe(200);
    });
  });
});
