import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ApiErrorBody, Comanda, Pedido } from '@mb/shared';
import { crearApp } from '../src/app.factory';
import { cargarEnv } from '../src/config/env';
import { DB, type Db } from '../src/shared-kernel/db/db';
import { nuevoId } from '../src/shared-kernel/ids';
import { mesa, pedido } from '../src/modules/pedidos/pedidos.schema';
import { comanda } from '../src/modules/cocina/cocina.schema';
import { eventoSistema } from '../src/shared-kernel/events/evento-sistema.schema';
import { crearUsuario, DATABASE_URL_TEST, prepararBaseDeTest } from './helpers/test-db';

const ORIGEN = 'http://localhost:5173';

describe.skipIf(!DATABASE_URL_TEST)('Feature C: Anular pedidos (RN-50, RN-35) y Deshacer en cocina (RN-22)', () => {
  let app: INestApplication;
  let db: Db;
  let base: string;
  let cookieAdmin: string;
  let cookieCajero: string;
  let cookieCocina: string;

  let catId: string;
  let ingId: string;
  let prodId: string;
  let mesa1Id: string;
  let mesa2Id: string;

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

    // Sembrar categoría, producto, ingrediente, receta y mesas
    const catRes = await post('/categorias', { nombre: 'Hamburguesas Test' }, cookieAdmin);
    catId = ((await catRes.json()) as { id: string }).id;

    const ingRes = await post(
      '/ingredientes',
      { nombre: 'Carne 150g Test', unidad: 'UND', stockMinimo: 5, costoUnitario: 5000000 },
      cookieAdmin,
    );
    ingId = ((await ingRes.json()) as { id: string }).id;

    const prodRes = await post(
      '/productos',
      { categoriaId: catId, nombre: 'Burger Clásica Test', precio: 25000 },
      cookieAdmin,
    );
    prodId = ((await prodRes.json()) as { id: string }).id;

    await put(`/productos/${prodId}/receta`, { items: [{ ingredienteId: ingId, cantidad: 1 }] }, cookieAdmin);

    // Entrada inicial de 50 unidades de carne
    await post('/inventario/entradas', { items: [{ ingredienteId: ingId, cantidad: 50 }] }, cookieAdmin);

    mesa1Id = nuevoId();
    mesa2Id = nuevoId();
    await db.insert(mesa).values([
      { id: mesa1Id, nombre: 'Mesa Anular 1', capacidad: 4, orden: 1 },
      { id: mesa2Id, nombre: 'Mesa Anular 2', capacidad: 4, orden: 2 },
    ]);
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

  describe('RN-50: Anulación de pedidos (POST /pedidos/:id/anular)', () => {
    it('RN-50: rechaza anulación si el rol no es ADMIN (CAJERO -> 403)', async () => {
      // Crear pedido como cajero
      const crearRes = await post('/pedidos', { tipo: 'MESA', mesaId: mesa1Id }, cookieCajero);
      const ped = (await crearRes.json()) as Pedido;

      const anularRes = await post(
        `/pedidos/${ped.id}/anular`,
        { motivo: 'Cliente se fue sin ordenar', version: ped.version },
        cookieCajero,
      );
      expect(anularRes.status).toBe(403);
      const err = (await anularRes.json()) as ApiErrorBody;
      expect(err.codigo).toBe('SIN_PERMISO');
    });

    it('RN-50: rechaza motivo corto de menos de 5 caracteres -> 400', async () => {
      const res = await get('/mesas', cookieAdmin);
      const mesas = (await res.json()) as Array<{ id: string; ocupada: boolean; pedidoId: string | null }>;
      const m1 = mesas.find((m) => m.id === mesa1Id);
      const pedId = m1!.pedidoId!;
      const pedRes = await get(`/pedidos/${pedId}`, cookieAdmin);
      const ped = (await pedRes.json()) as Pedido;

      const anularRes = await post(
        `/pedidos/${ped.id}/anular`,
        { motivo: 'chau', version: ped.version },
        cookieAdmin,
      );
      expect(anularRes.status).toBe(400);
      const err = (await anularRes.json()) as ApiErrorBody;
      expect(err.codigo).toBe('VALIDACION');
    });

    it('RN-50: rechaza si version no coincide -> 409 VERSION_CONFLICT', async () => {
      const res = await get('/mesas', cookieAdmin);
      const mesas = (await res.json()) as Array<{ id: string; ocupada: boolean; pedidoId: string | null }>;
      const pedId = mesas.find((m) => m.id === mesa1Id)!.pedidoId!;
      const pedRes = await get(`/pedidos/${pedId}`, cookieAdmin);
      const ped = (await pedRes.json()) as Pedido;

      const anularRes = await post(
        `/pedidos/${ped.id}/anular`,
        { motivo: 'Error en digitación de mesa', version: ped.version + 99 },
        cookieAdmin,
      );
      expect(anularRes.status).toBe(409);
      const err = (await anularRes.json()) as ApiErrorBody;
      expect(err.codigo).toBe('VERSION_CONFLICT');
    });

    it('RN-50 / RN-11: anula pedido ABIERTO sin comanda, guarda motivo y libera la mesa', async () => {
      const res = await get('/mesas', cookieAdmin);
      const mesas = (await res.json()) as Array<{ id: string; ocupada: boolean; pedidoId: string | null }>;
      const pedId = mesas.find((m) => m.id === mesa1Id)!.pedidoId!;
      const pedRes = await get(`/pedidos/${pedId}`, cookieAdmin);
      const ped = (await pedRes.json()) as Pedido;

      // Consultar stock antes de anular
      const ingAntes = (await (await get(`/ingredientes/${ingId}`, cookieAdmin)).json()) as { stockActual: number };

      const anularRes = await post(
        `/pedidos/${ped.id}/anular`,
        { motivo: 'Cliente desistió antes de pedir', version: ped.version },
        cookieAdmin,
      );
      expect(anularRes.status).toBe(200);
      const pedAnulado = (await anularRes.json()) as Pedido;
      expect(pedAnulado.estado).toBe('ANULADO');
      expect(pedAnulado.anuladoAt).toBeDefined();

      // Verificar que el stock no fue tocado (no tenía comanda ni consumo)
      const ingDespues = (await (await get(`/ingredientes/${ingId}`, cookieAdmin)).json()) as { stockActual: number };
      expect(ingDespues.stockActual).toBe(ingAntes.stockActual);

      // Verificar que la mesa 1 quedó libre (RN-11)
      const mesasDespues = (await (await get('/mesas', cookieAdmin)).json()) as Array<{ id: string; ocupada: boolean }>;
      const m1 = mesasDespues.find((m) => m.id === mesa1Id);
      expect(m1?.ocupada).toBe(false);
    });

    it('RN-50: rechaza anular un pedido que ya está ANULADO -> 409 ESTADO_INVALIDO', async () => {
      // Buscar el pedido recién anulado
      const filas = await db.select().from(pedido).where(eq(pedido.mesaId, mesa1Id));
      const pedAnulado = filas[0]!;
      expect(pedAnulado.estado).toBe('ANULADO');

      const anularRes = await post(
        `/pedidos/${pedAnulado.id}/anular`,
        { motivo: 'Intentando anular de nuevo', version: pedAnulado.version },
        cookieAdmin,
      );
      expect(anularRes.status).toBe(409);
      const err = (await anularRes.json()) as ApiErrorBody;
      expect(err.codigo).toBe('ESTADO_INVALIDO');
    });

    it('RN-50: rechaza anular un pedido CERRADO -> 409 ESTADO_INVALIDO', async () => {
      // Abrir caja para cajero
      await post('/caja/sesiones', { montoApertura: 50000 }, cookieCajero);

      // Crear pedido para llevar, agregar item, cobrar y cerrar
      const pedRes = await post('/pedidos', { tipo: 'LLEVAR' }, cookieCajero);
      const ped = (await pedRes.json()) as Pedido;
      await post(`/pedidos/${ped.id}/items`, { productoId: prodId, cantidad: 1 }, cookieCajero);

      // Cobrar
      const cobroRes = await post(
        '/caja/cobros',
        {
          pedidoId: ped.id,
          propina: 0,
          pagos: [{ metodo: 'EFECTIVO', monto: 25000, recibido: 30000 }],
        },
        cookieCajero,
      );
      expect(cobroRes.status).toBe(201);

      const detalleRes = await get(`/pedidos/${ped.id}`, cookieAdmin);
      const pedCerrado = (await detalleRes.json()) as Pedido;
      expect(pedCerrado.estado).toBe('CERRADO');

      // Intentar anular pedido CERRADO
      const anularRes = await post(
        `/pedidos/${ped.id}/anular`,
        { motivo: 'Intento de anular pedido ya cobrado', version: pedCerrado.version },
        cookieAdmin,
      );
      expect(anularRes.status).toBe(409);
      const err = (await anularRes.json()) as ApiErrorBody;
      expect(err.codigo).toBe('ESTADO_INVALIDO');
    });
  });

  describe('RN-35 / RN-50: Stock en anulación de pedidos y trazabilidad', () => {
    it('RN-35: anular con comanda PENDIENTE devuelve exactamente el stock consumido (REVERSION)', async () => {
      const stockAntes = Number(
        ((await (await get(`/ingredientes/${ingId}`, cookieAdmin)).json()) as { stockActual: number }).stockActual,
      );

      // 1. Crear pedido en mesa 2 con 3 hamburguesas
      const crearRes = await post('/pedidos', { tipo: 'MESA', mesaId: mesa2Id }, cookieCajero);
      const ped = (await crearRes.json()) as Pedido;
      await post(`/pedidos/${ped.id}/items`, { productoId: prodId, cantidad: 3 }, cookieCajero);

      // 2. Confirmar pedido (envía a cocina, comanda en PENDIENTE, descuenta 3 de stock)
      const confRes = await post(`/pedidos/${ped.id}/confirmar`, {}, cookieCajero);
      expect(confRes.status).toBe(200);
      const pedConf = (await confRes.json()) as Pedido;

      const stockTrasConfirmar = Number(
        ((await (await get(`/ingredientes/${ingId}`, cookieAdmin)).json()) as { stockActual: number }).stockActual,
      );
      expect(stockTrasConfirmar).toBe(stockAntes - 3);

      // 3. Anular pedido con comanda PENDIENTE
      const anularRes = await post(
        `/pedidos/${ped.id}/anular`,
        { motivo: 'Mesa canceló su orden a tiempo', version: pedConf.version },
        cookieAdmin,
      );
      expect(anularRes.status).toBe(200);
      const pedAnulado = (await anularRes.json()) as Pedido;
      expect(pedAnulado.estado).toBe('ANULADO');

      // 4. Verificar que el stock volvió exactamente a su saldo anterior
      const stockTrasAnular = Number(
        ((await (await get(`/ingredientes/${ingId}`, cookieAdmin)).json()) as { stockActual: number }).stockActual,
      );
      expect(stockTrasAnular).toBe(stockAntes);

      // 5. Verificar kardex: debe contener el movimiento REVERSION por +3
      const kardexRes = await get(`/ingredientes/${ingId}/movimientos`, cookieAdmin);
      const kardex = (await kardexRes.json()) as {
        items: Array<{ tipo: string; cantidad: number; referenciaTipo: string; referenciaId: string }>;
      };
      const revMov = kardex.items.find((m) => m.tipo === 'REVERSION' && m.referenciaId === ped.id);
      expect(revMov).toBeDefined();
      expect(Number(revMov?.cantidad)).toBe(3);

      // 6. Verificar comanda: pasó a ANULADA
      const comandas = (await (await get(`/comandas?estado=ANULADA`, cookieCocina)).json()) as Comanda[];
      const cAnulada = comandas.find((c) => c.pedidoId === ped.id);
      expect(cAnulada).toBeDefined();
      expect(cAnulada?.estado).toBe('ANULADA');
      expect(cAnulada?.anuladaAt).toBeDefined();

      // 7. Mesa 2 quedó libre
      const mesas = (await (await get('/mesas', cookieAdmin)).json()) as Array<{ id: string; ocupada: boolean }>;
      expect(mesas.find((m) => m.id === mesa2Id)?.ocupada).toBe(false);
    });

    it('RN-35: anular con comanda EN_PREPARACION crea MERMA y no devuelve stock', async () => {
      const stockAntes = Number(
        ((await (await get(`/ingredientes/${ingId}`, cookieAdmin)).json()) as { stockActual: number }).stockActual,
      );

      // 1. Crear pedido en mesa 2 con 2 hamburguesas
      const crearRes = await post('/pedidos', { tipo: 'MESA', mesaId: mesa2Id }, cookieCajero);
      const ped = (await crearRes.json()) as Pedido;
      await post(`/pedidos/${ped.id}/items`, { productoId: prodId, cantidad: 2 }, cookieCajero);

      // 2. Confirmar pedido (comanda PENDIENTE, stock -2)
      const confRes = await post(`/pedidos/${ped.id}/confirmar`, {}, cookieCajero);
      const pedConf = (await confRes.json()) as Pedido;

      // 3. Cocina inicia la comanda -> EN_PREPARACION
      const comandasActivas = (await (await get('/comandas?activas=true', cookieCocina)).json()) as Comanda[];
      const comandaPed = comandasActivas.find((c) => c.pedidoId === ped.id)!;
      expect(comandaPed).toBeDefined();

      const iniciarRes = await post(`/comandas/${comandaPed.id}/iniciar`, { version: comandaPed.version }, cookieCocina);
      expect(iniciarRes.status).toBe(200);

      // 4. Anular pedido cuando ya está EN_PREPARACION
      const anularRes = await post(
        `/pedidos/${ped.id}/anular`,
        { motivo: 'Carne se cayó al piso durante preparación', version: pedConf.version },
        cookieAdmin,
      );
      expect(anularRes.status).toBe(200);

      // 5. Verificar que el stock neto NO volvió (se mantiene consumido/mermado: stockAntes - 2)
      const stockTrasAnular = Number(
        ((await (await get(`/ingredientes/${ingId}`, cookieAdmin)).json()) as { stockActual: number }).stockActual,
      );
      expect(stockTrasAnular).toBe(stockAntes - 2);

      // 6. Verificar kardex: debe contener el movimiento MERMA
      const kardexRes = await get(`/ingredientes/${ingId}/movimientos`, cookieAdmin);
      const kardex = (await kardexRes.json()) as {
        items: Array<{ tipo: string; cantidad: number; referenciaTipo: string; referenciaId: string; motivo: string }>;
      };
      const mermaMov = kardex.items.find((m) => m.tipo === 'MERMA' && m.referenciaId === ped.id);
      expect(mermaMov).toBeDefined();
      expect(Number(mermaMov?.cantidad)).toBe(-2);
      expect(mermaMov?.motivo).toContain('Carne se cayó al piso');
    });

    it('RN-60: eventos PedidoAnulado y ComandaAnulada quedan registrados en evento_sistema', async () => {
      const eventos = await db.select().from(eventoSistema);
      const pedidoAnuladoEvt = eventos.find((e) => e.tipo === 'PedidoAnulado');
      const comandaAnuladaEvt = eventos.find((e) => e.tipo === 'ComandaAnulada');

      expect(pedidoAnuladoEvt).toBeDefined();
      expect(pedidoAnuladoEvt?.modulo).toBe('pedidos');
      expect(pedidoAnuladoEvt?.payload).toBeDefined();

      expect(comandaAnuladaEvt).toBeDefined();
      expect(comandaAnuladaEvt?.modulo).toBe('cocina');
      expect(comandaAnuladaEvt?.payload).toBeDefined();
    });
  });

  describe('RN-22: Deshacer transición de comanda (POST /comandas/:id/deshacer)', () => {
    let comandaDeshacerId: string;
    let comandaDeshacerVersion: number;

    beforeAll(async () => {
      // Crear y confirmar un pedido para llevar
      const pedRes = await post('/pedidos', { tipo: 'LLEVAR' }, cookieCajero);
      const ped = (await pedRes.json()) as Pedido;
      await post(`/pedidos/${ped.id}/items`, { productoId: prodId, cantidad: 1 }, cookieCajero);
      await post(`/pedidos/${ped.id}/confirmar`, {}, cookieCajero);

      const comandas = (await (await get('/comandas?activas=true', cookieCocina)).json()) as Comanda[];
      const c = comandas.find((item) => item.pedidoId === ped.id)!;
      comandaDeshacerId = c.id;
      comandaDeshacerVersion = c.version;
    });

    it('RN-22: rechaza si comanda está en PENDIENTE (no hay transición que deshacer) -> 409', async () => {
      const deshacerRes = await post(
        `/comandas/${comandaDeshacerId}/deshacer`,
        { version: comandaDeshacerVersion },
        cookieCocina,
      );
      expect(deshacerRes.status).toBe(409);
      const err = (await deshacerRes.json()) as ApiErrorBody;
      expect(err.codigo).toBe('ESTADO_INVALIDO');
    });

    it('RN-22: rechaza si el rol es CAJERO -> 403', async () => {
      const deshacerRes = await post(
        `/comandas/${comandaDeshacerId}/deshacer`,
        { version: comandaDeshacerVersion },
        cookieCajero,
      );
      expect(deshacerRes.status).toBe(403);
    });

    it('RN-22: deshacer revierte EN_PREPARACION -> PENDIENTE antes de 10 s', async () => {
      // Avanzar PENDIENTE -> EN_PREPARACION
      const avanzarRes = await post(
        `/comandas/${comandaDeshacerId}/iniciar`,
        { version: comandaDeshacerVersion },
        cookieCocina,
      );
      expect(avanzarRes.status).toBe(200);
      const cIniciada = (await avanzarRes.json()) as Comanda;
      expect(cIniciada.estado).toBe('EN_PREPARACION');
      expect(cIniciada.iniciadaAt).toBeDefined();

      // Deshacer inmediatamente (< 10 s)
      const deshacerRes = await post(
        `/comandas/${comandaDeshacerId}/deshacer`,
        { version: cIniciada.version },
        cookieCocina,
      );
      expect(deshacerRes.status).toBe(200);
      const cDeshecha = (await deshacerRes.json()) as Comanda;
      expect(cDeshecha.estado).toBe('PENDIENTE');
      expect(cDeshecha.iniciadaAt).toBeNull();
      expect(cDeshecha.version).toBe(cIniciada.version + 1);

      comandaDeshacerVersion = cDeshecha.version;
    });

    it('RN-22: deshacer revierte LISTA -> EN_PREPARACION antes de 10 s', async () => {
      // Avanzar PENDIENTE -> EN_PREPARACION -> LISTA
      const res1 = await post(
        `/comandas/${comandaDeshacerId}/iniciar`,
        { version: comandaDeshacerVersion },
        cookieCocina,
      );
      const c1 = (await res1.json()) as Comanda;

      const res2 = await post(
        `/comandas/${comandaDeshacerId}/lista`,
        { version: c1.version },
        cookieCocina,
      );
      const c2 = (await res2.json()) as Comanda;
      expect(c2.estado).toBe('LISTA');
      expect(c2.listaAt).toBeDefined();

      // Deshacer LISTA -> EN_PREPARACION
      const deshacerRes = await post(
        `/comandas/${comandaDeshacerId}/deshacer`,
        { version: c2.version },
        cookieCocina,
      );
      expect(deshacerRes.status).toBe(200);
      const cDeshecha = (await deshacerRes.json()) as Comanda;
      expect(cDeshecha.estado).toBe('EN_PREPARACION');
      expect(cDeshecha.listaAt).toBeNull();
      expect(cDeshecha.version).toBe(c2.version + 1);

      comandaDeshacerVersion = cDeshecha.version;
    });

    it('RN-22: deshacer revierte ENTREGADA -> LISTA antes de 10 s', async () => {
      // Avanzar EN_PREPARACION -> LISTA -> ENTREGADA
      const res1 = await post(
        `/comandas/${comandaDeshacerId}/lista`,
        { version: comandaDeshacerVersion },
        cookieCocina,
      );
      const c1 = (await res1.json()) as Comanda;

      const res2 = await post(
        `/comandas/${comandaDeshacerId}/entregar`,
        { version: c1.version },
        cookieCocina,
      );
      const c2 = (await res2.json()) as Comanda;
      expect(c2.estado).toBe('ENTREGADA');
      expect(c2.entregadaAt).toBeDefined();

      // Deshacer ENTREGADA -> LISTA
      const deshacerRes = await post(
        `/comandas/${comandaDeshacerId}/deshacer`,
        { version: c2.version },
        cookieCocina,
      );
      expect(deshacerRes.status).toBe(200);
      const cDeshecha = (await deshacerRes.json()) as Comanda;
      expect(cDeshecha.estado).toBe('LISTA');
      expect(cDeshecha.entregadaAt).toBeNull();

      comandaDeshacerVersion = cDeshecha.version;
    });

    it('RN-22: rechaza deshacer si pasaron más de 10 segundos -> 409', async () => {
      // Simular que lista_at fue hace 15 segundos
      const quinceSegundosAtras = new Date(Date.now() - 15_000);
      await db
        .update(comanda)
        .set({ listaAt: quinceSegundosAtras })
        .where(eq(comanda.id, comandaDeshacerId));

      const deshacerRes = await post(
        `/comandas/${comandaDeshacerId}/deshacer`,
        { version: comandaDeshacerVersion },
        cookieAdmin,
      );
      expect(deshacerRes.status).toBe(409);
      const err = (await deshacerRes.json()) as ApiErrorBody;
      expect(err.codigo).toBe('ESTADO_INVALIDO');
      expect(err.mensaje).toContain('expirado');
    });

    it('RN-22: rechaza con conflicto de versión -> 409 VERSION_CONFLICT', async () => {
      // Reajustar marca de tiempo a reciente para probar version conflict
      await db
        .update(comanda)
        .set({ listaAt: new Date() })
        .where(eq(comanda.id, comandaDeshacerId));

      const deshacerRes = await post(
        `/comandas/${comandaDeshacerId}/deshacer`,
        { version: comandaDeshacerVersion + 10 },
        cookieCocina,
      );
      expect(deshacerRes.status).toBe(409);
      const err = (await deshacerRes.json()) as ApiErrorBody;
      expect(err.codigo).toBe('VERSION_CONFLICT');
    });
  });
});
