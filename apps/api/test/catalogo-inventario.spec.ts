import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../src/app.factory';
import { cargarEnv } from '../src/config/env';
import { DB, type Db } from '../src/shared-kernel/db/db';
import { OutboxDispatcher } from '../src/shared-kernel/events/outbox.dispatcher';
import { CatalogoService } from '../src/modules/catalogo/catalogo.service';
import { InventarioService } from '../src/modules/inventario/inventario.service';
import { ingrediente, movimientoInventario } from '../src/modules/inventario/inventario.schema';
import { configuracion, CONFIGURACION_INICIAL } from '../src/shared-kernel/configuracion/configuracion.schema';
import { nuevoId } from '../src/shared-kernel/ids';
import { crearUsuario, DATABASE_URL_TEST, prepararBaseDeTest } from './helpers/test-db';

const ORIGEN = 'http://localhost:5173';

describe.skipIf(!DATABASE_URL_TEST)('Hito 1: Catálogo e Inventario (RN-30 a RN-36, RN-51)', () => {
  let app: INestApplication;
  let db: Db;
  let base: string;
  let dispatcher: OutboxDispatcher;
  let catalogoService: CatalogoService;
  let inventarioService: InventarioService;
  let adminUsuarioId: string;
  let catHamburguesasId: string;

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
    dispatcher = app.get(OutboxDispatcher);
    catalogoService = app.get(CatalogoService);
    inventarioService = app.get(InventarioService);

    adminUsuarioId = await crearUsuario(db, { username: 'admin_h1', password: 'password123', rol: 'ADMIN' });
    await crearUsuario(db, { username: 'cajero_h1', password: 'password123', rol: 'CAJERO' });
    await crearUsuario(db, { username: 'cocina_h1', password: 'password123', rol: 'COCINA' });

    await db
      .insert(configuracion)
      .values(Object.entries(CONFIGURACION_INICIAL).map(([clave, valor]) => ({ clave, valor })))
      .onConflictDoNothing({ target: configuracion.clave });

    // Iniciar sesión con cada rol para obtener cookies
    cookieAdmin = (await login('admin_h1', 'password123')).cookie;
    cookieCajero = (await login('cajero_h1', 'password123')).cookie;
    cookieCocina = (await login('cocina_h1', 'password123')).cookie;
  });

  afterAll(async () => {
    await app?.close();
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

  const get = (ruta: string, cookie?: string) =>
    fetch(`${base}${ruta}`, {
      method: 'GET',
      headers: {
        ...(cookie ? { cookie } : {}),
      },
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

  async function login(username: string, password: string) {
    const res = await post('/auth/login', { username, password });
    const cookie = res.headers.get('set-cookie')?.split(';')[0] ?? '';
    return { res, cookie };
  }

  // --- 1. Roles y permisos (RN-51) ---
  describe('RN-51: permisos por rol en catálogo e inventario', () => {
    it('sin autenticación → 401 NO_AUTENTICADO', async () => {
      const resCat = await get('/categorias');
      expect(resCat.status).toBe(401);
      const resIng = await get('/ingredientes');
      expect(resIng.status).toBe(401);
      const resMenu = await get('/catalogo/menu');
      expect(resMenu.status).toBe(401);
    });

    it('cajero puede ver menú del POS pero no puede crear categorías ni ingredientes (403)', async () => {
      const resMenu = await get('/catalogo/menu', cookieCajero);
      expect(resMenu.status).toBe(200);

      const resCat = await post('/categorias', { nombre: 'Cat Cajero' }, cookieCajero);
      expect(resCat.status).toBe(403);

      const resIng = await post(
        '/ingredientes',
        { nombre: 'Ing Cajero', unidad: 'UND' },
        cookieCajero,
      );
      expect(resIng.status).toBe(403);
    });

    it('cocina no tiene permiso en catálogo ni en inventario (403)', async () => {
      const resMenu = await get('/catalogo/menu', cookieCocina);
      expect(resMenu.status).toBe(403);

      const resCat = await get('/categorias', cookieCocina);
      expect(resCat.status).toBe(403);

      const resIng = await get('/ingredientes', cookieCocina);
      expect(resIng.status).toBe(403);
    });

    it('admin tiene acceso total a catálogo e inventario', async () => {
      const resCat = await get('/categorias', cookieAdmin);
      expect(resCat.status).toBe(200);

      const resIng = await get('/ingredientes', cookieAdmin);
      expect(resIng.status).toBe(200);
    });
  });

  // --- 2. Catálogo, Productos y Recetas (RN-30, RN-31, RN-01, RN-02) ---
  describe('RN-30 y RN-31: CRUD de catálogo, categorías, productos y recetas', () => {
    let prodClasicaId: string;
    let ingPanId: string;
    let ingCarneId: string;

    it('admin crea categoría y productos con precio entero COP > 0 (RN-01, RN-02)', async () => {
      const resCat = await post('/categorias', { nombre: 'Hamburguesas', orden: 1 }, cookieAdmin);
      expect(resCat.status).toBe(201);
      const catData = (await resCat.json()) as { id: string; nombre: string };
      catHamburguesasId = catData.id;
      expect(catData.nombre).toBe('Hamburguesas');

      const resProd = await post(
        '/productos',
        {
          categoriaId: catHamburguesasId,
          nombre: 'Monster Clásica',
          descripcion: '150g carne',
          precio: 25000,
          orden: 1,
        },
        cookieAdmin,
      );
      expect(resProd.status).toBe(201);
      const prodData = (await resProd.json()) as { id: string; precio: number };
      prodClasicaId = prodData.id;
      expect(prodData.precio).toBe(25000);
    });

    it('admin crea ingredientes con unidades base enteras (RN-30)', async () => {
      const resPan = await post(
        '/ingredientes',
        {
          nombre: 'Pan Hamburguesa',
          unidad: 'UND',
          stockMinimo: 10,
          costoUnitario: 1200000,
        },
        cookieAdmin,
      );
      expect(resPan.status).toBe(201);
      ingPanId = ((await resPan.json()) as { id: string }).id;

      const resCarne = await post(
        '/ingredientes',
        {
          nombre: 'Carne 150g',
          unidad: 'G',
          stockMinimo: 1000,
          costoUnitario: 35000,
        },
        cookieAdmin,
      );
      expect(resCarne.status).toBe(201);
      ingCarneId = ((await resCarne.json()) as { id: string }).id;
    });

    it('RN-31: PUT receta reemplaza la receta en una transacción y GET detalle la incluye', async () => {
      const resReceta = await put(
        `/productos/${prodClasicaId}/receta`,
        {
          items: [
            { ingredienteId: ingPanId, cantidad: 1 },
            { ingredienteId: ingCarneId, cantidad: 150 },
          ],
        },
        cookieAdmin,
      );
      expect(resReceta.status).toBe(200);

      const resDetalle = await get(`/productos/${prodClasicaId}`, cookieAdmin);
      expect(resDetalle.status).toBe(200);
      const detalle = (await resDetalle.json()) as {
        id: string;
        receta: Array<{ ingredienteId: string; cantidad: number; nombre: string; unidad: string }>;
      };
      expect(detalle.receta).toHaveLength(2);
      expect(detalle.receta.find((r) => r.ingredienteId === ingPanId)?.cantidad).toBe(1);
      expect(detalle.receta.find((r) => r.ingredienteId === ingCarneId)?.cantidad).toBe(150);
    });

    it('admin puede editar producto e ingrediente con PATCH', async () => {
      const resPatchProd = await patch(
        `/productos/${prodClasicaId}`,
        { precio: 26000 },
        cookieAdmin,
      );
      expect(resPatchProd.status).toBe(200);
      const prodEditado = (await resPatchProd.json()) as { precio: number };
      expect(prodEditado.precio).toBe(26000);

      const resPatchIng = await patch(
        `/ingredientes/${ingPanId}`,
        { stockMinimo: 15 },
        cookieAdmin,
      );
      expect(resPatchIng.status).toBe(200);
      const ingEditado = (await resPatchIng.json()) as { stockMinimo: number };
      expect(Number(ingEditado.stockMinimo)).toBe(15);
    });
  });

  // --- 3. Consumo, Movimientos y Kardex (RN-32, RN-34) ---
  describe('RN-32 y RN-34: consumo descuenta stock y crea movimientos con stock_resultante', () => {
    let ingTestPanId: string;
    let prodTestBurgerId: string;

    beforeAll(async () => {
      // Crear categoría e ingrediente fresco para esta suite
      const catRes = await post('/categorias', { nombre: 'Cat Consumo Test' }, cookieAdmin);
      const catId = ((await catRes.json()) as { id: string }).id;

      const ingRes = await post(
        '/ingredientes',
        { nombre: 'Pan Consumo Test', unidad: 'UND', stockMinimo: 2 },
        cookieAdmin,
      );
      ingTestPanId = ((await ingRes.json()) as { id: string }).id;

      const prodRes = await post(
        '/productos',
        { categoriaId: catId, nombre: 'Burger Consumo Test', precio: 20000 },
        cookieAdmin,
      );
      prodTestBurgerId = ((await prodRes.json()) as { id: string }).id;

      await put(
        `/productos/${prodTestBurgerId}/receta`,
        { items: [{ ingredienteId: ingTestPanId, cantidad: 1 }] },
        cookieAdmin,
      );

      // Entrada inicial de 10 unidades
      const entradaRes = await post(
        '/inventario/entradas',
        { items: [{ ingredienteId: ingTestPanId, cantidad: 10 }] },
        cookieAdmin,
      );
      expect(entradaRes.status).toBe(201);
    });

    it('consumo atómico descuenta stock y genera movimiento CONSUMO con stock_resultante', async () => {
      await db.transaction(async (tx) => {
        await inventarioService.consumir(
          tx,
          [{ productoId: prodTestBurgerId, cantidad: 3 }],
          adminUsuarioId,
        );
      });

      const ing = await inventarioService.obtenerPorId(ingTestPanId);
      expect(Number(ing.stockActual)).toBe(7);

      const kardexRes = await get(`/ingredientes/${ingTestPanId}/movimientos`, cookieAdmin);
      const kardex = (await kardexRes.json()) as {
        items: Array<{ tipo: string; cantidad: number; stockResultante: number }>;
      };
      const consumoMov = kardex.items.find((m) => m.tipo === 'CONSUMO');
      expect(consumoMov).toBeDefined();
      expect(Number(consumoMov?.cantidad)).toBe(-3);
      expect(Number(consumoMov?.stockResultante)).toBe(7);
    });
  });

  // --- 4. Stock Insuficiente (RN-33) ---
  describe('RN-33: rechaza confirmar sin stock suficiente con 409 STOCK_INSUFICIENTE', () => {
    let ingQuesoId: string;
    let prodQuesoId: string;

    beforeAll(async () => {
      const catRes = await post('/categorias', { nombre: 'Cat RN33' }, cookieAdmin);
      const catId = ((await catRes.json()) as { id: string }).id;

      const ingRes = await post(
        '/ingredientes',
        { nombre: 'Queso RN33', unidad: 'G', stockMinimo: 50 },
        cookieAdmin,
      );
      ingQuesoId = ((await ingRes.json()) as { id: string }).id;

      const prodRes = await post(
        '/productos',
        { categoriaId: catId, nombre: 'Burger RN33', precio: 15000 },
        cookieAdmin,
      );
      prodQuesoId = ((await prodRes.json()) as { id: string }).id;

      await put(
        `/productos/${prodQuesoId}/receta`,
        { items: [{ ingredienteId: ingQuesoId, cantidad: 100 }] },
        cookieAdmin,
      );

      // Stock de 150g
      await post(
        '/inventario/entradas',
        { items: [{ ingredienteId: ingQuesoId, cantidad: 150 }] },
        cookieAdmin,
      );
    });

    it('RN-33: falla con 409 y lista de faltantes cuando se solicitan 2 burgers (200g > 150g)', async () => {
      let errorLanzado: unknown = null;
      try {
        await db.transaction(async (tx) => {
          await inventarioService.consumir(
            tx,
            [{ productoId: prodQuesoId, cantidad: 2 }],
            adminUsuarioId,
          );
        });
      } catch (err) {
        errorLanzado = err;
      }

      expect(errorLanzado).toBeDefined();
      const errObj = errorLanzado as {
        codigo: string;
        status: number;
        detalles?: { faltantes: Array<{ ingredienteId: string; requerido: number; disponible: number }> };
      };
      expect(errObj.codigo).toBe('STOCK_INSUFICIENTE');
      expect(errObj.status).toBe(409);
      expect(errObj.detalles?.faltantes).toHaveLength(1);
      expect(errObj.detalles?.faltantes[0]?.ingredienteId).toBe(ingQuesoId);
      expect(errObj.detalles?.faltantes[0]?.requerido).toBe(200);
      expect(errObj.detalles?.faltantes[0]?.disponible).toBe(150);

      // Comprobar que no se descontó nada (rollback)
      const ing = await inventarioService.obtenerPorId(ingQuesoId);
      expect(Number(ing.stockActual)).toBe(150);
    });

    it('RN-33: con permitir_stock_negativo=true permite el consumo en negativo', async () => {
      // Habilitar permitir_stock_negativo
      await db
        .update(configuracion)
        .set({ valor: true })
        .where(eq(configuracion.clave, 'permitir_stock_negativo'));

      await db.transaction(async (tx) => {
        await inventarioService.consumir(
          tx,
          [{ productoId: prodQuesoId, cantidad: 2 }], // requiere 200g, hay 150g -> queda -50g
          adminUsuarioId,
        );
      });

      const ing = await inventarioService.obtenerPorId(ingQuesoId);
      expect(Number(ing.stockActual)).toBe(-50);

      // Restaurar permitir_stock_negativo=false
      await db
        .update(configuracion)
        .set({ valor: false })
        .where(eq(configuracion.clave, 'permitir_stock_negativo'));
    });
  });

  // --- 5. Concurrencia (RN-32 SELECT ... FOR UPDATE) ---
  describe('CONCURRENCIA: dos consumos simultáneos del último stock → exactamente uno gana', () => {
    let ingUltimoId: string;
    let prodUltimoId: string;

    beforeAll(async () => {
      const catRes = await post('/categorias', { nombre: 'Cat Concurrencia' }, cookieAdmin);
      const catId = ((await catRes.json()) as { id: string }).id;

      const ingRes = await post(
        '/ingredientes',
        { nombre: 'Ing Concurrencia', unidad: 'UND', stockMinimo: 0 },
        cookieAdmin,
      );
      ingUltimoId = ((await ingRes.json()) as { id: string }).id;

      const prodRes = await post(
        '/productos',
        { categoriaId: catId, nombre: 'Burger Concurrencia', precio: 10000 },
        cookieAdmin,
      );
      prodUltimoId = ((await prodRes.json()) as { id: string }).id;

      await put(
        `/productos/${prodUltimoId}/receta`,
        { items: [{ ingredienteId: ingUltimoId, cantidad: 1 }] },
        cookieAdmin,
      );

      // Entrada exacta de 1 unidad
      await post(
        '/inventario/entradas',
        { items: [{ ingredienteId: ingUltimoId, cantidad: 1 }] },
        cookieAdmin,
      );
    });

    it('dos transacciones paralelas compitiendo por 1 unidad: 1 éxito y 1 fallo 409 STOCK_INSUFICIENTE', async () => {
      const intento1 = db.transaction(async (tx) => {
        await inventarioService.consumir(
          tx,
          [{ productoId: prodUltimoId, cantidad: 1 }],
          adminUsuarioId,
        );
      });

      const intento2 = db.transaction(async (tx) => {
        await inventarioService.consumir(
          tx,
          [{ productoId: prodUltimoId, cantidad: 1 }],
          adminUsuarioId,
        );
      });

      const resultados = await Promise.allSettled([intento1, intento2]);
      const exitosos = resultados.filter((r) => r.status === 'fulfilled');
      const fallidos = resultados.filter((r) => r.status === 'rejected');

      expect(exitosos).toHaveLength(1);
      expect(fallidos).toHaveLength(1);

      const fallo = fallidos[0] as PromiseRejectedResult;
      expect((fallo.reason as { codigo: string }).codigo).toBe('STOCK_INSUFICIENTE');

      // El stock final debe ser exactamente 0
      const ing = await inventarioService.obtenerPorId(ingUltimoId);
      expect(Number(ing.stockActual)).toBe(0);
    });
  });

  // --- 6. Reversión y Merma (RN-35) ---
  describe('RN-35: revertir consumo y registrar merma', () => {
    let ingRevId: string;
    let prodRevId: string;

    beforeAll(async () => {
      const catRes = await post('/categorias', { nombre: 'Cat RN35' }, cookieAdmin);
      const catId = ((await catRes.json()) as { id: string }).id;

      const ingRes = await post(
        '/ingredientes',
        { nombre: 'Ing RN35', unidad: 'UND', stockMinimo: 0 },
        cookieAdmin,
      );
      ingRevId = ((await ingRes.json()) as { id: string }).id;

      const prodRes = await post(
        '/productos',
        { categoriaId: catId, nombre: 'Burger RN35', precio: 10000 },
        cookieAdmin,
      );
      prodRevId = ((await prodRes.json()) as { id: string }).id;

      await put(
        `/productos/${prodRevId}/receta`,
        { items: [{ ingredienteId: ingRevId, cantidad: 1 }] },
        cookieAdmin,
      );

      await post(
        '/inventario/entradas',
        { items: [{ ingredienteId: ingRevId, cantidad: 10 }] },
        cookieAdmin,
      );
    });

    it('revertir devuelve el stock y genera movimiento REVERSION', async () => {
      // Consumir 2 unidades
      await db.transaction(async (tx) => {
        await inventarioService.consumir(
          tx,
          [{ productoId: prodRevId, cantidad: 2 }],
          adminUsuarioId,
        );
      });
      let ing = await inventarioService.obtenerPorId(ingRevId);
      expect(Number(ing.stockActual)).toBe(8);

      // Revertir 2 unidades
      await db.transaction(async (tx) => {
        await inventarioService.revertir(
          tx,
          [{ productoId: prodRevId, cantidad: 2 }],
          adminUsuarioId,
        );
      });
      ing = await inventarioService.obtenerPorId(ingRevId);
      expect(Number(ing.stockActual)).toBe(10);

      const kardexRes = await get(`/ingredientes/${ingRevId}/movimientos`, cookieAdmin);
      const kardex = (await kardexRes.json()) as {
        items: Array<{ tipo: string; cantidad: number; stockResultante: number }>;
      };
      const revMov = kardex.items.find((m) => m.tipo === 'REVERSION');
      expect(revMov).toBeDefined();
      expect(Number(revMov?.cantidad)).toBe(2);
      expect(Number(revMov?.stockResultante)).toBe(10);
    });

    it('registrarMerma descuenta stock y genera movimiento MERMA', async () => {
      await db.transaction(async (tx) => {
        await inventarioService.registrarMerma(
          tx,
          [{ ingredienteId: ingRevId, cantidad: 3 }],
          adminUsuarioId,
          'Pan quemado',
        );
      });

      const ing = await inventarioService.obtenerPorId(ingRevId);
      expect(Number(ing.stockActual)).toBe(7);

      const kardexRes = await get(`/ingredientes/${ingRevId}/movimientos`, cookieAdmin);
      const kardex = (await kardexRes.json()) as {
        items: Array<{ tipo: string; cantidad: number; stockResultante: number; motivo: string }>;
      };
      const mermaMov = kardex.items.find((m) => m.tipo === 'MERMA');
      expect(mermaMov).toBeDefined();
      expect(Number(mermaMov?.cantidad)).toBe(-3);
      expect(Number(mermaMov?.stockResultante)).toBe(7);
      expect(mermaMov?.motivo).toBe('Pan quemado');
    });
  });

  // --- 7. Retroalimentación RN-36 (Agotado Automático y Reposición) ---
  describe('RN-36: agotado automático por stock y reposición (retroalimentación)', () => {
    let ingFeedbackId: string;
    let prodFeedbackId: string;

    beforeAll(async () => {
      const catRes = await post('/categorias', { nombre: 'Cat Feedback RN36' }, cookieAdmin);
      const catId = ((await catRes.json()) as { id: string }).id;

      const ingRes = await post(
        '/ingredientes',
        { nombre: 'Ing Feedback RN36', unidad: 'UND', stockMinimo: 1 },
        cookieAdmin,
      );
      ingFeedbackId = ((await ingRes.json()) as { id: string }).id;

      const prodRes = await post(
        '/productos',
        { categoriaId: catId, nombre: 'Burger Feedback RN36', precio: 12000 },
        cookieAdmin,
      );
      prodFeedbackId = ((await prodRes.json()) as { id: string }).id;

      await put(
        `/productos/${prodFeedbackId}/receta`,
        { items: [{ ingredienteId: ingFeedbackId, cantidad: 1 }] },
        cookieAdmin,
      );

      // Entrada inicial de 1 unidad
      await post(
        '/inventario/entradas',
        { items: [{ ingredienteId: ingFeedbackId, cantidad: 1 }] },
        cookieAdmin,
      );
      await dispatcher.drenar();
    });

    it('inicialmente con stock disponible: el producto no está agotado en el menú', async () => {
      const menuRes = await get('/catalogo/menu', cookieAdmin);
      const menu = (await menuRes.json()) as Array<{
        productos: Array<{ id: string; agotado: boolean }>;
      }>;
      const prodEnMenu = menu.flatMap((c) => c.productos).find((p) => p.id === prodFeedbackId);
      expect(prodEnMenu?.agotado).toBe(false);
    });

    it('al agotar el ingrediente a 0: tras procesar evento, producto pasa a agotado=true', async () => {
      // Consumir la última unidad
      await db.transaction(async (tx) => {
        await inventarioService.consumir(
          tx,
          [{ ingredienteId: ingFeedbackId, cantidad: 1 }],
          adminUsuarioId,
        );
      });

      // Drenar el outbox para ejecutar handlers post-commit
      await dispatcher.drenar();

      const prodDetalle = await catalogoService.obtenerProductoPorId(prodFeedbackId);
      expect(prodDetalle.agotado).toBe(true);

      const menuRes = await get('/catalogo/menu', cookieAdmin);
      const menu = (await menuRes.json()) as Array<{
        productos: Array<{ id: string; agotado: boolean }>;
      }>;
      const prodEnMenu = menu.flatMap((c) => c.productos).find((p) => p.id === prodFeedbackId);
      expect(prodEnMenu?.agotado).toBe(true);
    });

    it('al reponer el ingrediente con una ENTRADA: tras evento, producto pasa a agotado=false', async () => {
      await post(
        '/inventario/entradas',
        { items: [{ ingredienteId: ingFeedbackId, cantidad: 20 }] },
        cookieAdmin,
      );

      // Drenar el outbox
      await dispatcher.drenar();

      const prodDetalle = await catalogoService.obtenerProductoPorId(prodFeedbackId);
      expect(prodDetalle.agotado).toBe(false);

      const menuRes = await get('/catalogo/menu', cookieAdmin);
      const menu = (await menuRes.json()) as Array<{
        productos: Array<{ id: string; agotado: boolean }>;
      }>;
      const prodEnMenu = menu.flatMap((c) => c.productos).find((p) => p.id === prodFeedbackId);
      expect(prodEnMenu?.agotado).toBe(false);
    });

    it('agotado_manual tiene precedencia sobre el cálculo automático (RN-36)', async () => {
      // Forzar agotado manual = true aunque hay 20 unidades
      const resManual = await put(
        `/productos/${prodFeedbackId}/agotado`,
        { agotadoManual: true },
        cookieAdmin,
      );
      expect(resManual.status).toBe(200);

      let prodDetalle = await catalogoService.obtenerProductoPorId(prodFeedbackId);
      expect(prodDetalle.agotado).toBe(true);
      expect(prodDetalle.agotadoManual).toBe(true);

      // Aunque ocurra un evento de reposición, se respeta el manual
      await catalogoService.recalcularProductosPorIngrediente(ingFeedbackId);
      prodDetalle = await catalogoService.obtenerProductoPorId(prodFeedbackId);
      expect(prodDetalle.agotado).toBe(true);

      // Restablecer a automático (null)
      await put(
        `/productos/${prodFeedbackId}/agotado`,
        { agotadoManual: null },
        cookieAdmin,
      );
      prodDetalle = await catalogoService.obtenerProductoPorId(prodFeedbackId);
      expect(prodDetalle.agotado).toBe(false);
      expect(prodDetalle.agotadoManual).toBeNull();
    });
  });

  // --- 8. Consistencia de Kardex (RN-34) ---
  describe('RN-34: kardex coherente (stock_actual == suma de movimientos)', () => {
    it('para todos los ingredientes, el stock_actual denormalizado coincide exactamente con la suma de movimientos', async () => {
      const ingredientes = await db.select().from(ingrediente);
      expect(ingredientes.length).toBeGreaterThan(0);

      for (const ing of ingredientes) {
        const [sumaResult] = await db
          .select({
            total: sql<number>`coalesce(sum(${movimientoInventario.cantidad}), 0)::bigint`,
          })
          .from(movimientoInventario)
          .where(eq(movimientoInventario.ingredienteId, ing.id));

        const sumaMovimientos = Number(sumaResult?.total ?? 0);
        const stockActual = Number(ing.stockActual);
        expect(stockActual).toBe(sumaMovimientos);
      }
    });
  });

  // --- 9. BE-01: Control de duplicados en Catálogo e Inventario ---
  describe('BE-01: control de unicidad responde 409 NOMBRE_DUPLICADO ante nombres duplicados', () => {
    it('BE-01: nombre de categoría duplicado responde 409 NOMBRE_DUPLICADO al crear', async () => {
      // 'Hamburguesas' ya fue creada en la suite
      const res = await post('/categorias', { nombre: 'Hamburguesas' }, cookieAdmin);
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({
        codigo: 'NOMBRE_DUPLICADO',
        mensaje: 'Ya existe una categoría con ese nombre.',
      });
    });

    it('BE-01: nombre de categoría duplicado responde 409 NOMBRE_DUPLICADO al renombrar', async () => {
      const resCat = await post('/categorias', { nombre: 'Bebidas BE01' }, cookieAdmin);
      expect(resCat.status).toBe(201);
      const cat = (await resCat.json()) as { id: string };

      const resDuplicado = await patch(`/categorias/${cat.id}`, { nombre: 'Hamburguesas' }, cookieAdmin);
      expect(resDuplicado.status).toBe(409);
      expect(await resDuplicado.json()).toMatchObject({
        codigo: 'NOMBRE_DUPLICADO',
        mensaje: 'Ya existe una categoría con ese nombre.',
      });
    });

    it('BE-01: nombre de producto duplicado responde 409 NOMBRE_DUPLICADO al crear', async () => {
      // 'Monster Clásica' ya fue creada. Probamos duplicado exacto e insensible a mayúsculas
      const resExacto = await post(
        '/productos',
        {
          categoriaId: catHamburguesasId,
          nombre: 'Monster Clásica',
          precio: 26000,
        },
        cookieAdmin,
      );
      expect(resExacto.status).toBe(409);
      expect(await resExacto.json()).toMatchObject({
        codigo: 'NOMBRE_DUPLICADO',
        mensaje: 'Ya existe un producto con ese nombre.',
      });

      const resCaseInsensitive = await post(
        '/productos',
        {
          categoriaId: catHamburguesasId,
          nombre: 'monster clásica',
          precio: 26000,
        },
        cookieAdmin,
      );
      expect(resCaseInsensitive.status).toBe(409);
      expect(await resCaseInsensitive.json()).toMatchObject({
        codigo: 'NOMBRE_DUPLICADO',
        mensaje: 'Ya existe un producto con ese nombre.',
      });
    });

    it('BE-01: nombre de producto duplicado responde 409 NOMBRE_DUPLICADO al renombrar', async () => {
      const resProd = await post(
        '/productos',
        {
          categoriaId: catHamburguesasId,
          nombre: 'Producto Temporal BE01',
          precio: 20000,
        },
        cookieAdmin,
      );
      expect(resProd.status).toBe(201);
      const prod = (await resProd.json()) as { id: string };

      const resDuplicado = await patch(
        `/productos/${prod.id}`,
        { nombre: 'Monster Clásica' },
        cookieAdmin,
      );
      expect(resDuplicado.status).toBe(409);
      expect(await resDuplicado.json()).toMatchObject({
        codigo: 'NOMBRE_DUPLICADO',
        mensaje: 'Ya existe un producto con ese nombre.',
      });
    });

    it('BE-01: nombre de ingrediente duplicado responde 409 NOMBRE_DUPLICADO al crear', async () => {
      // 'Pan Hamburguesa' ya fue creado
      const res = await post(
        '/ingredientes',
        {
          nombre: 'Pan Hamburguesa',
          unidad: 'UND',
          stockMinimo: 5,
        },
        cookieAdmin,
      );
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({
        codigo: 'NOMBRE_DUPLICADO',
        mensaje: 'Ya existe un ingrediente con ese nombre.',
      });
    });

    it('BE-01: nombre de ingrediente duplicado responde 409 NOMBRE_DUPLICADO al renombrar', async () => {
      const resIng = await post(
        '/ingredientes',
        {
          nombre: 'Ingrediente Temporal BE01',
          unidad: 'G',
        },
        cookieAdmin,
      );
      expect(resIng.status).toBe(201);
      const ing = (await resIng.json()) as { id: string };

      const resDuplicado = await patch(
        `/ingredientes/${ing.id}`,
        { nombre: 'Pan Hamburguesa' },
        cookieAdmin,
      );
      expect(resDuplicado.status).toBe(409);
      expect(await resDuplicado.json()).toMatchObject({
        codigo: 'NOMBRE_DUPLICADO',
        mensaje: 'Ya existe un ingrediente con ese nombre.',
      });
    });
  });

  describe('Paginación de ingredientes por cursor keyset (nombre, id)', () => {
    it('pagina deterministicamente >100 ingredientes sin duplicados ni perdidas', async () => {
      const totalNuevos = 110;
      const lote = [];
      for (let i = 1; i <= totalNuevos; i++) {
        const sufijo = String(i).padStart(3, '0');
        lote.push({
          id: nuevoId(),
          nombre: `Z-Ingrediente-Prueba-${sufijo}`,
          unidad: 'UND' as const,
          stockActual: 10,
          stockMinimo: 5,
          costoUnitario: 1000,
          activo: true,
        });
      }
      await db.insert(ingrediente).values(lote);

      const idsRecuperados: string[] = [];
      const nombresRecuperados: string[] = [];
      let cursor: string | null = null;
      let paginas = 0;

      do {
        const query = cursor ? `?limit=40&cursor=${encodeURIComponent(cursor)}` : '?limit=40';
        const res = await get(`/ingredientes${query}`, cookieAdmin);
        expect(res.status).toBe(200);
        const data = (await res.json()) as { items: Array<{ id: string; nombre: string }>; nextCursor: string | null };
        for (const item of data.items) {
          idsRecuperados.push(item.id);
          nombresRecuperados.push(item.nombre);
        }
        cursor = data.nextCursor;
        paginas++;
      } while (cursor !== null && paginas < 10);

      const idsSet = new Set(idsRecuperados);
      expect(idsSet.size).toBe(idsRecuperados.length);
      for (const item of lote) {
        expect(idsSet.has(item.id)).toBe(true);
      }

      for (let i = 1; i < nombresRecuperados.length; i++) {
        expect(nombresRecuperados[i]!.localeCompare(nombresRecuperados[i - 1]!)).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
