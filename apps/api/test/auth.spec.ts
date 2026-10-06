import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../src/app.factory';
import { cargarEnv } from '../src/config/env';
import { DB, type Db } from '../src/shared-kernel/db/db';
import { eventoSistema } from '../src/shared-kernel/events/evento-sistema.schema';
import { OutboxDispatcher } from '../src/shared-kernel/events/outbox.dispatcher';
import { crearUsuario, DATABASE_URL_TEST, prepararBaseDeTest } from './helpers/test-db';

const ORIGEN = 'http://localhost:5173';

describe.skipIf(!DATABASE_URL_TEST)('identidad: login, sesión y logout (HU-01)', () => {
  let app: INestApplication;
  let db: Db;
  let base: string;

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
    await crearUsuario(db, { username: 'inactivo', password: 'clave1234', rol: 'CAJERO', activo: false });
  });

  afterAll(async () => {
    await app?.close();
  });

  const post = (ruta: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${base}${ruta}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGEN, ...headers },
      body: JSON.stringify(body),
    });

  const login = async (username: string, password: string) => {
    const res = await post('/auth/login', { username, password });
    const cookie = res.headers.get('set-cookie')?.split(';')[0] ?? '';
    return { res, cookie };
  };

  it('health responde ok sin sesión', async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', db: 'ok' });
  });

  it('login válido entrega cookie HttpOnly y el usuario con su rol', async () => {
    const { res, cookie } = await login('ADMIN', 'admin123'); // el username no distingue mayúsculas
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ usuario: { username: 'admin', rol: 'ADMIN' } });
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/^mb_session=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);

    const me = await fetch(`${base}/auth/me`, { headers: { cookie } });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ usuario: { username: 'admin' } });
  });

  it('contraseña incorrecta → 401 CREDENCIALES_INVALIDAS con mensaje genérico', async () => {
    const { res, cookie } = await login('admin', 'mala');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      codigo: 'CREDENCIALES_INVALIDAS',
      mensaje: 'Usuario o contraseña incorrectos.',
    });
    expect(cookie).toBe('');
  });

  it('usuario inactivo no puede entrar', async () => {
    const { res } = await login('inactivo', 'clave1234');
    expect(res.status).toBe(401);
  });

  it('sin cookie → 401 NO_AUTENTICADO', async () => {
    const res = await fetch(`${base}/auth/me`);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ codigo: 'NO_AUTENTICADO' });
  });

  it('cuerpo inválido → 400 VALIDACION con detalle por campo', async () => {
    const res = await post('/auth/login', { username: '' });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { codigo: string; detalles: { campo: string }[] };
    expect(body.codigo).toBe('VALIDACION');
    expect(body.detalles.map((d) => d.campo)).toEqual(expect.arrayContaining(['username', 'password']));
  });

  it('rechaza peticiones mutantes desde otro origen (CSRF)', async () => {
    const res = await post('/auth/login', { username: 'admin', password: 'admin123' }, {
      origin: 'https://evil.example',
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ codigo: 'ORIGEN_NO_PERMITIDO' });
  });

  it('logout invalida la sesión en el servidor', async () => {
    const { cookie } = await login('admin', 'admin123');
    const out = await post('/auth/logout', {}, { cookie });
    expect(out.status).toBe(204);
    const me = await fetch(`${base}/auth/me`, { headers: { cookie } });
    expect(me.status).toBe(401);
  });

  it('RN-60: el login queda registrado en evento_sistema y el outbox lo procesa', async () => {
    await app.get(OutboxDispatcher).drenar();
    const eventos = await db.select().from(eventoSistema).where(eq(eventoSistema.tipo, 'SesionIniciada'));
    expect(eventos.length).toBeGreaterThan(0);
    expect(eventos.every((e) => e.procesadoAt !== null)).toBe(true);
  });

  it('limita los intentos de login (5 por minuto)', async () => {
    const respuestas = [];
    for (let i = 0; i < 6; i++) respuestas.push((await login('admin', 'mala')).res.status);
    expect(respuestas).toContain(429);
  });
});
