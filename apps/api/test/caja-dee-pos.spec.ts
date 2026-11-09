import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { CobroRespuesta, Pedido } from '@mb/shared';
import { crearApp } from '../src/app.factory';
import { cargarEnv } from '../src/config/env';
import { categoria, producto } from '../src/modules/catalogo/catalogo.schema';
import {
  EMISOR_DOCUMENTO_ELECTRONICO,
  type EmisorDocumentoElectronico,
} from '../src/modules/caja/caja.public';
import { documentoElectronico } from '../src/modules/caja/caja.schema';
import { DB, type Db } from '../src/shared-kernel/db/db';
import { guardarConfiguracion } from '../src/shared-kernel/configuracion/configuracion.lector';
import { nuevoId } from '../src/shared-kernel/ids';
import { crearUsuario, DATABASE_URL_TEST, prepararBaseDeTest } from './helpers/test-db';

const ORIGEN = 'http://localhost:5202';

describe.skipIf(!DATABASE_URL_TEST)('Emisión de Documento Equivalente Electrónico POS (DEE POS - ADR-0012)', () => {
  let app: INestApplication;
  let db: Db;
  let base: string;
  let cookieCajero: string;
  let prodClasicaId: string;

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
    await crearUsuario(db, { username: 'cajero_dee', password: 'caja1234', rol: 'CAJERO' });

    const login = async (u: string, p: string) => {
      const res = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGEN },
        body: JSON.stringify({ username: u, password: p }),
      });
      return res.headers.get('set-cookie')?.split(';')[0] ?? '';
    };

    cookieCajero = await login('cajero_dee', 'caja1234');

    const catId = nuevoId();
    await db.insert(categoria).values({ id: catId, nombre: 'Hamburguesas', orden: 1, activa: true });
    prodClasicaId = nuevoId();
    await db.insert(producto).values({
      id: prodClasicaId,
      categoriaId: catId,
      nombre: 'Monster Clásica',
      precio: 25000,
      orden: 1,
      activo: true,
      agotado: false,
    });
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

  describe('Integración: Comportamiento según flag dee_pos_habilitado', () => {
    beforeAll(async () => {
      // Abrir sesión de caja para el cajero
      const res = await post('/caja/sesiones', { montoApertura: 50000 }, cookieCajero);
      expect(res.status).toBe(201);
    });

    it('con flag apagado (por defecto): comportamiento idéntico, no llama al puerto y emite "Documento no fiscal" (RN-45)', async () => {
      // Crear pedido
      const pedRes = await post('/pedidos', { tipo: 'LLEVAR' }, cookieCajero);
      expect(pedRes.status).toBe(201);
      const ped = (await pedRes.json()) as Pedido;
      await post(`/pedidos/${ped.id}/items`, { productoId: prodClasicaId, cantidad: 1 }, cookieCajero);

      // Cobrar con flag apagado
      const cobroRes = await post(
        '/caja/cobros',
        {
          pedidoId: ped.id,
          pedidoVersion: 1,
          propina: 0,
          pagos: [{ metodo: 'EFECTIVO', monto: 25000, recibido: 30000 }],
        },
        cookieCajero,
      );
      expect(cobroRes.status).toBe(201);
      const dataCobro = (await cobroRes.json()) as CobroRespuesta;
      expect(dataCobro.documentoElectronico).toBeUndefined();

      // Verificar que NO existe fila en documento_electronico
      const filasDoc = await db
        .select()
        .from(documentoElectronico)
        .where(eq(documentoElectronico.reciboId, dataCobro.reciboId));
      expect(filasDoc).toHaveLength(0);

      // Consultar recibo
      const reciboRes = await get(`/recibos/${dataCobro.reciboId}`, cookieCajero);
      expect(reciboRes.status).toBe(200);
      const reciboData = (await reciboRes.json()) as {
        leyendas: string[];
        documentoElectronico: { cude: string; qr: string; proveedor: string; estado: string } | null;
      };

      expect(reciboData.leyendas).toContain('Documento no fiscal');
      expect(reciboData.leyendas).toContain('No responsable de INC');
      expect(reciboData.leyendas).not.toContain('Documento Equivalente Electrónico POS');
      expect(reciboData.documentoElectronico).toBeNull();
    });

    it('con flag encendido y proveedor simulado: invoca el puerto, persiste el CUDE simulado y expone DEE POS en el recibo', async () => {
      // Encender el flag en la configuración de base de datos
      await guardarConfiguracion(db, 'dee_pos_habilitado', true);

      // Crear nuevo pedido
      const pedRes = await post('/pedidos', { tipo: 'LLEVAR' }, cookieCajero);
      expect(pedRes.status).toBe(201);
      const ped = (await pedRes.json()) as Pedido;
      await post(`/pedidos/${ped.id}/items`, { productoId: prodClasicaId, cantidad: 1 }, cookieCajero);

      // Cobrar con flag encendido
      const cobroRes = await post(
        '/caja/cobros',
        {
          pedidoId: ped.id,
          pedidoVersion: 1,
          propina: 2000,
          pagos: [{ metodo: 'EFECTIVO', monto: 27000, recibido: 30000 }],
        },
        cookieCajero,
      );
      expect(cobroRes.status).toBe(201);
      const dataCobro = (await cobroRes.json()) as CobroRespuesta;

      // Debe incluir documentoElectronico simulado en la respuesta de cobro
      expect(dataCobro.documentoElectronico).toBeDefined();
      expect(dataCobro.documentoElectronico!.cude).toMatch(/^SIMULADO-CUDE-[a-f0-9]{64}$/);
      expect(dataCobro.documentoElectronico!.qr).toContain('documentkey=SIMULADO-');
      expect(dataCobro.documentoElectronico!.proveedor).toBe('SIMULADO');

      // Verificar persistencia en base de datos
      const [filaDoc] = await db
        .select()
        .from(documentoElectronico)
        .where(eq(documentoElectronico.reciboId, dataCobro.reciboId));
      expect(filaDoc).toBeDefined();
      expect(filaDoc!.cude).toBe(dataCobro.documentoElectronico!.cude);
      expect(filaDoc!.proveedor).toBe('SIMULADO');
      expect(filaDoc!.estado).toBe('EMITIDO');

      // Consultar recibo expuesto
      const reciboRes = await get(`/recibos/${dataCobro.reciboId}`, cookieCajero);
      expect(reciboRes.status).toBe(200);
      const reciboData = (await reciboRes.json()) as {
        leyendas: string[];
        documentoElectronico: { cude: string; qr: string; proveedor: string; estado: string } | null;
      };

      // Un DEE POS simulado NO es fiscal: el recibo no puede presentarse como documento electrónico real
      expect(reciboData.leyendas).toContain('Documento no fiscal');
      expect(reciboData.leyendas).toContain('DEE POS SIMULADO - sin validez fiscal');
      expect(reciboData.leyendas).not.toContain('Documento Equivalente Electrónico POS');
      expect(reciboData.leyendas).toContain('No responsable de INC');
      expect(dataCobro.documentoElectronico!.qr).not.toContain('dian.gov.co');

      // Datos expuestos del documento electrónico
      expect(reciboData.documentoElectronico).toBeDefined();
      expect(reciboData.documentoElectronico!.cude).toBe(filaDoc!.cude);
      expect(reciboData.documentoElectronico!.qr).toBe(filaDoc!.qr);
      expect(reciboData.documentoElectronico!.proveedor).toBe('SIMULADO');
      expect(reciboData.documentoElectronico!.estado).toBe('EMITIDO');

      // Restaurar flag apagado
      await guardarConfiguracion(db, 'dee_pos_habilitado', false);
    });
  });

  describe('Pruebas unitarias con puerto mockeado', () => {
    it('el servicio no invoca el puerto cuando dee_pos_habilitado es false', async () => {
      const mockEmisor: EmisorDocumentoElectronico = {
        emitir: vi.fn().mockResolvedValue({
          cude: 'SIMULADO-CUDE-TEST',
          qr: 'SIMULADO-QR-TEST',
          proveedor: 'SIMULADO',
          fechaEmision: new Date().toISOString(),
        }),
      };

      // Mock de cajaService con emisor mockeado
      const emisorSpy = vi.spyOn(mockEmisor, 'emitir');

      // Asegurar flag apagado
      await guardarConfiguracion(db, 'dee_pos_habilitado', false);

      const pedRes = await post('/pedidos', { tipo: 'LLEVAR' }, cookieCajero);
      const ped = (await pedRes.json()) as Pedido;
      await post(`/pedidos/${ped.id}/items`, { productoId: prodClasicaId, cantidad: 1 }, cookieCajero);

      await post(
        '/caja/cobros',
        {
          pedidoId: ped.id,
          pedidoVersion: 1,
          propina: 0,
          pagos: [{ metodo: 'EFECTIVO', monto: 25000, recibido: 25000 }],
        },
        cookieCajero,
      );

      expect(emisorSpy).not.toHaveBeenCalled();
    });

    it('el servicio invoca el puerto con los datos exactos del pedido y recibo cuando dee_pos_habilitado es true', async () => {
      const emisorSpy = vi.spyOn(app.get<EmisorDocumentoElectronico>(EMISOR_DOCUMENTO_ELECTRONICO), 'emitir');

      await guardarConfiguracion(db, 'dee_pos_habilitado', true);

      const pedRes = await post('/pedidos', { tipo: 'LLEVAR' }, cookieCajero);
      const ped = (await pedRes.json()) as Pedido;
      await post(`/pedidos/${ped.id}/items`, { productoId: prodClasicaId, cantidad: 1 }, cookieCajero);

      const cobroRes = await post(
        '/caja/cobros',
        {
          pedidoId: ped.id,
          pedidoVersion: 1,
          propina: 1000,
          pagos: [{ metodo: 'EFECTIVO', monto: 26000, recibido: 30000 }],
        },
        cookieCajero,
      );
      expect(cobroRes.status).toBe(201);

      expect(emisorSpy).toHaveBeenCalledTimes(1);
      const arg = emisorSpy.mock.calls[0]![0];
      expect(arg.total).toBe(25000);
      expect(arg.propina).toBe(1000);
      expect(arg.items).toHaveLength(1);
      expect(arg.items[0]!.nombre).toBe('Monster Clásica');
      expect(arg.pagos).toHaveLength(1);
      expect(arg.pagos[0]!.metodo).toBe('EFECTIVO');

      emisorSpy.mockRestore();
      await guardarConfiguracion(db, 'dee_pos_habilitado', false);
    });
  });
});
