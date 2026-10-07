import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { eq as drizzleEq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fechaOperativa } from '@mb/shared';
import type {
  ApiErrorBody,
  MovimientoCaja,
  ResumenCierre,
  SesionCaja,
  SesionCajaDetalle,
  SesionesPaginadasRespuesta,
} from '@mb/shared';
import { crearApp } from '../src/app.factory';
import { cargarEnv } from '../src/config/env';
import { DB, type Db } from '../src/shared-kernel/db/db';
import { eventoSistema } from '../src/shared-kernel/events/evento-sistema.schema';
import { crearUsuario, DATABASE_URL_TEST, prepararBaseDeTest } from './helpers/test-db';

const ORIGEN = 'http://localhost:5201';

describe.skipIf(!DATABASE_URL_TEST)('módulo caja: movimientos manuales, cierre e historial (RN-46, RN-47)', () => {
  let app: INestApplication;
  let db: Db;
  let base: string;
  let cookieAdmin: string;
  let cookieCajero1: string;
  let cookieCajero2: string;
  let idCajero1: string;
  let idCajero2: string;

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
    idCajero1 = await crearUsuario(db, { username: 'cajero1', password: 'caja1234', rol: 'CAJERO' });
    idCajero2 = await crearUsuario(db, { username: 'cajero2', password: 'caja1234', rol: 'CAJERO' });

    const login = async (u: string, p: string) => {
      const res = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGEN },
        body: JSON.stringify({ username: u, password: p }),
      });
      return res.headers.get('set-cookie')?.split(';')[0] ?? '';
    };

    cookieAdmin = await login('admin', 'admin123');
    cookieCajero1 = await login('cajero1', 'caja1234');
    cookieCajero2 = await login('cajero2', 'caja1234');
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

  describe('RN-46: Movimientos manuales de caja (ingresos y retiros)', () => {
    let sesionId: string;

    it('abre una sesión para cajero1 con monto base $100.000 (RN-41)', async () => {
      const res = await post('/caja/sesiones', { montoApertura: 100000 }, cookieCajero1);
      expect(res.status).toBe(201);
      const sesion = (await res.json()) as SesionCaja;
      sesionId = sesion.id;
      expect(sesion.estado).toBe('ABIERTA');
      expect(sesion.montoApertura).toBe(100000);
      expect(sesion.usuarioId).toBe(idCajero1);
    });

    it('RN-46: registra un INGRESO manual de $20.000 con motivo', async () => {
      const res = await post(
        `/caja/sesiones/${sesionId}/movimientos`,
        { tipo: 'INGRESO', monto: 20000, motivo: 'Base adicional para sencillo' },
        cookieCajero1,
      );
      expect(res.status).toBe(201);
      const mov = (await res.json()) as MovimientoCaja;
      expect(mov.tipo).toBe('INGRESO');
      expect(mov.monto).toBe(20000);
      expect(mov.motivo).toBe('Base adicional para sencillo');
      expect(mov.sesionCajaId).toBe(sesionId);
      expect(mov.usuarioId).toBe(idCajero1);
      expect(mov.createdAt).toBeDefined();

      // sesionActual refleja el ingreso en el esperado ($100.000 + $20.000 = $120.000)
      const resActual = await get('/caja/sesion-actual', cookieCajero1);
      const actual = (await resActual.json()) as SesionCaja & {
        ventasEfectivo: number;
        ingresos: number;
        retiros: number;
      };
      expect(actual.efectivoEsperado).toBe(120000);
      expect(actual.ingresos).toBe(20000);
      expect(actual.retiros).toBe(0);

      // Evento MovimientoCajaRegistrado publicado en evento_sistema
      const eventos = await db
        .select()
        .from(eventoSistema)
        .where(drizzleEq(eventoSistema.agregadoId, mov.id));
      expect(eventos).toHaveLength(1);
      expect(eventos[0]?.tipo).toBe('MovimientoCajaRegistrado');
    });

    it('RN-46: registra un RETIRO manual de $5.000 con motivo', async () => {
      const res = await post(
        `/caja/sesiones/${sesionId}/movimientos`,
        { tipo: 'RETIRO', monto: 5000, motivo: 'Pago de hielo para bebidas' },
        cookieCajero1,
      );
      expect(res.status).toBe(201);
      const mov = (await res.json()) as MovimientoCaja;
      expect(mov.tipo).toBe('RETIRO');
      expect(mov.monto).toBe(5000);

      // sesionActual refleja el retiro ($120.000 - $5.000 = $115.000)
      const resActual = await get('/caja/sesion-actual', cookieCajero1);
      const actual = (await resActual.json()) as SesionCaja & {
        ingresos: number;
        retiros: number;
      };
      expect(actual.efectivoEsperado).toBe(115000);
      expect(actual.ingresos).toBe(20000);
      expect(actual.retiros).toBe(5000);
    });

    it('RN-46: rechaza un RETIRO que dejaría el efectivo esperado en negativo (409 EFECTIVO_INSUFICIENTE)', async () => {
      // Efectivo actual esperado: $115.000. Intentar retirar $120.000
      const res = await post(
        `/caja/sesiones/${sesionId}/movimientos`,
        { tipo: 'RETIRO', monto: 120000, motivo: 'Retiro excesivo' },
        cookieCajero1,
      );
      expect(res.status).toBe(409);
      const error = (await res.json()) as ApiErrorBody;
      expect(error.codigo).toBe('EFECTIVO_INSUFICIENTE');
    });

    it('RN-46: rechaza registro de movimiento de un cajero ajeno (403 SIN_PERMISO)', async () => {
      const res = await post(
        `/caja/sesiones/${sesionId}/movimientos`,
        { tipo: 'INGRESO', monto: 10000, motivo: 'Intento ajeno' },
        cookieCajero2,
      );
      expect(res.status).toBe(403);
    });

    it('RN-46: permite a ADMIN registrar un movimiento sobre cualquier sesión', async () => {
      const res = await post(
        `/caja/sesiones/${sesionId}/movimientos`,
        { tipo: 'INGRESO', monto: 10000, motivo: 'Aporte autorizado por admin' },
        cookieAdmin,
      );
      expect(res.status).toBe(201);
      const mov = (await res.json()) as MovimientoCaja;
      expect(mov.monto).toBe(10000);
    });

    it('RN-46: GET /caja/sesiones/:id/movimientos lista todos los movimientos de la sesión', async () => {
      const res = await get(`/caja/sesiones/${sesionId}/movimientos`, cookieCajero1);
      expect(res.status).toBe(200);
      const lista = (await res.json()) as MovimientoCaja[];
      expect(lista).toHaveLength(3); // 20k ingreso, 5k retiro, 10k ingreso admin
      expect(lista[0]?.tipo).toBe('INGRESO');
      expect(lista[0]?.monto).toBe(20000);
      expect(lista[1]?.tipo).toBe('RETIRO');
      expect(lista[1]?.monto).toBe(5000);
      expect(lista[2]?.tipo).toBe('INGRESO');
      expect(lista[2]?.monto).toBe(10000);

      // Cajero ajeno no puede ver los movimientos
      const resAjeno = await get(`/caja/sesiones/${sesionId}/movimientos`, cookieCajero2);
      expect(resAjeno.status).toBe(403);

      // Admin sí puede verlos
      const resAdmin = await get(`/caja/sesiones/${sesionId}/movimientos`, cookieAdmin);
      expect(resAdmin.status).toBe(200);
    });

    it('RN-47: cierra la caja con movimientos y cuadra el arqueo', async () => {
      // Base: $100.000 + Ingresos: $30.000 - Retiros: $5.000 = Esperado: $125.000
      const res = await post(
        `/caja/sesiones/${sesionId}/cerrar`,
        { efectivoContado: 125000 },
        cookieCajero1,
      );
      expect(res.status).toBe(200);
      const resumen = (await res.json()) as ResumenCierre;
      expect(resumen.sesionId).toBe(sesionId);
      expect(resumen.montoApertura).toBe(100000);
      expect(resumen.ingresos).toBe(30000);
      expect(resumen.retiros).toBe(5000);
      expect(resumen.efectivoEsperado).toBe(125000);
      expect(resumen.efectivoContado).toBe(125000);
      expect(resumen.diferencia).toBe(0);

      // Evento SesionCajaCerrada
      const eventos = await db
        .select()
        .from(eventoSistema)
        .where(drizzleEq(eventoSistema.agregadoId, sesionId));
      const cierreEv = eventos.find((e) => e.tipo === 'SesionCajaCerrada');
      expect(cierreEv).toBeDefined();
    });

    it('RN-46: rechaza registrar movimientos en una sesión ya CERRADA (409 ESTADO_INVALIDO)', async () => {
      const res = await post(
        `/caja/sesiones/${sesionId}/movimientos`,
        { tipo: 'INGRESO', monto: 10000, motivo: 'Intento en caja cerrada' },
        cookieCajero1,
      );
      expect(res.status).toBe(409);
      const error = (await res.json()) as ApiErrorBody;
      expect(error.codigo).toBe('ESTADO_INVALIDO');
    });
  });

  describe('Historial de cierres de caja y detalle', () => {
    let sesionCajero2Id: string;

    beforeAll(async () => {
      // Abrir y cerrar sesión para cajero2
      const resAbrir = await post('/caja/sesiones', { montoApertura: 50000 }, cookieCajero2);
      const s2 = (await resAbrir.json()) as SesionCaja;
      sesionCajero2Id = s2.id;
      // Retiro de $10.000
      await post(
        `/caja/sesiones/${sesionCajero2Id}/movimientos`,
        { tipo: 'RETIRO', monto: 10000, motivo: 'Retiro parcial' },
        cookieCajero2,
      );
      // Cerrar con faltante de $2.000 (Esperado: $40.000, Contado: $38.000)
      await post(
        `/caja/sesiones/${sesionCajero2Id}/cerrar`,
        { efectivoContado: 38000 },
        cookieCajero2,
      );
    });

    it('ADMIN ve todas las sesiones en GET /caja/sesiones, con datos del cajero { id, nombre }', async () => {
      const res = await get('/caja/sesiones', cookieAdmin);
      expect(res.status).toBe(200);
      const data = (await res.json()) as SesionesPaginadasRespuesta;
      expect(data.items.length).toBeGreaterThanOrEqual(2);

      const sesion1 = data.items.find((s) => s.usuarioId === idCajero1);
      const sesion2 = data.items.find((s) => s.usuarioId === idCajero2);
      expect(sesion1).toBeDefined();
      expect(sesion1?.cajero).toEqual({ id: idCajero1, nombre: 'cajero1' });
      expect(sesion2).toBeDefined();
      expect(sesion2?.cajero).toEqual({ id: idCajero2, nombre: 'cajero2' });
    });

    it('CAJERO solo ve sus propias sesiones en GET /caja/sesiones', async () => {
      const res = await get('/caja/sesiones', cookieCajero2);
      expect(res.status).toBe(200);
      const data = (await res.json()) as SesionesPaginadasRespuesta;
      expect(data.items.length).toBe(1);
      expect(data.items[0]?.usuarioId).toBe(idCajero2);
      expect(data.items[0]?.cajero.nombre).toBe('cajero2');
    });

    it('rechaza rango de fechas operativas donde desde > hasta (400 VALIDACION)', async () => {
      const res = await get('/caja/sesiones?desde=2026-10-10&hasta=2026-10-05', cookieAdmin);
      expect(res.status).toBe(400);
      const err = (await res.json()) as ApiErrorBody;
      expect(err.codigo).toBe('VALIDACION');
    });

    it('pagina por cursor (limit=1) sin repetir sesiones', async () => {
      const r1 = await get('/caja/sesiones?limit=1', cookieAdmin);
      const p1 = (await r1.json()) as SesionesPaginadasRespuesta;
      expect(p1.items).toHaveLength(1);
      expect(p1.nextCursor).not.toBeNull();
      const r2 = await get(`/caja/sesiones?limit=1&cursor=${p1.nextCursor}`, cookieAdmin);
      const p2 = (await r2.json()) as SesionesPaginadasRespuesta;
      expect(p2.items).toHaveLength(1);
      expect(p2.items[0]?.id).not.toBe(p1.items[0]?.id);
    });

    it('filtra por fecha operativa de apertura (desde/hasta inclusivos)', async () => {
      const hoy = fechaOperativa(new Date());
      const dentro = await get(`/caja/sesiones?desde=${hoy}&hasta=${hoy}`, cookieAdmin);
      expect(((await dentro.json()) as SesionesPaginadasRespuesta).items.length).toBeGreaterThanOrEqual(2);
      const fuera = await get('/caja/sesiones?desde=2999-01-01', cookieAdmin);
      expect(((await fuera.json()) as SesionesPaginadasRespuesta).items).toHaveLength(0);
    });

    it('rechaza formato de fecha inválido (400 VALIDACION)', async () => {
      const res = await get('/caja/sesiones?desde=10-10-2026', cookieAdmin);
      expect(res.status).toBe(400);
    });

    it('GET /caja/sesiones/:id devuelve el detalle completo con totales por método, movimientos y diferencia', async () => {
      const res = await get(`/caja/sesiones/${sesionCajero2Id}`, cookieCajero2);
      expect(res.status).toBe(200);
      const detalle = (await res.json()) as SesionCajaDetalle;
      expect(detalle.id).toBe(sesionCajero2Id);
      expect(detalle.cajero).toEqual({ id: idCajero2, nombre: 'cajero2' });
      expect(detalle.montoApertura).toBe(50000);
      expect(detalle.efectivoEsperado).toBe(40000);
      expect(detalle.efectivoContado).toBe(38000);
      expect(detalle.diferencia).toBe(-2000);
      expect(detalle.totalesMovimientos).toEqual({ ingresos: 0, retiros: 10000 });
      expect(detalle.movimientos).toHaveLength(1);
      expect(detalle.movimientos[0]?.monto).toBe(10000);
      expect(detalle.movimientos[0]?.tipo).toBe('RETIRO');
    });

    it('CAJERO ajeno recibe 403 al intentar consultar el detalle de otra sesión', async () => {
      const res = await get(`/caja/sesiones/${sesionCajero2Id}`, cookieCajero1);
      expect(res.status).toBe(403);
    });

    it('ADMIN puede consultar el detalle de cualquier sesión', async () => {
      const res = await get(`/caja/sesiones/${sesionCajero2Id}`, cookieAdmin);
      expect(res.status).toBe(200);
      const detalle = (await res.json()) as SesionCajaDetalle;
      expect(detalle.id).toBe(sesionCajero2Id);
    });
  });
});
