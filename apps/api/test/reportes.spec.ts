import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type AlertasRespuesta,
  type ReporteVentasRespuesta,
} from '@mb/shared';
import { crearApp } from '../src/app.factory';
import { cargarEnv } from '../src/config/env';
import { DB, type Db } from '../src/shared-kernel/db/db';
import { nuevoId } from '../src/shared-kernel/ids';
import { crearUsuario, DATABASE_URL_TEST, prepararBaseDeTest } from './helpers/test-db';
import { categoria, producto } from '../src/modules/catalogo/catalogo.schema';
import { ingrediente } from '../src/modules/inventario/inventario.schema';
import { mesa, pedido, pedidoItem } from '../src/modules/pedidos/pedidos.schema';
import { pago, recibo, sesionCaja } from '../src/modules/caja/caja.schema';

const ORIGEN = 'http://localhost:5212';

describe.skipIf(!DATABASE_URL_TEST)('Reportes de Ventas y Alertas (ADMIN)', () => {
  let app: INestApplication;
  let db: Db;
  let base: string;
  let cookieAdmin: string;
  let cookieCajero: string;

  let _idAdmin: string;
  let idCajero1: string;
  let idCajero2: string;

  let prodClasicaId: string;
  let prodDobleId: string;
  let prodVeggieId: string;

  let ingPanId: string;
  let ingTocinetaId: string;

  let mesa1Id: string;
  let pedidoOlvidadoId: string;

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

    // 1. Usuarios
    _idAdmin = await crearUsuario(db, { username: 'admin', password: 'admin123', rol: 'ADMIN' });
    idCajero1 = await crearUsuario(db, { username: 'caja1', password: 'caja1234', rol: 'CAJERO' });
    idCajero2 = await crearUsuario(db, { username: 'caja2', password: 'caja1234', rol: 'CAJERO' });

    // Login
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

    // 2. Sembrar Catálogo e Inventario
    const catId = nuevoId();
    await db.insert(categoria).values({
      id: catId,
      nombre: 'Hamburguesas',
      orden: 1,
      activa: true,
    });

    prodClasicaId = nuevoId();
    prodDobleId = nuevoId();
    prodVeggieId = nuevoId();

    await db.insert(producto).values([
      {
        id: prodClasicaId,
        categoriaId: catId,
        nombre: 'Monster Clásica',
        precio: 24900,
        orden: 1,
        activo: true,
        agotado: false,
      },
      {
        id: prodDobleId,
        categoriaId: catId,
        nombre: 'Monster Doble',
        precio: 34900,
        orden: 2,
        activo: true,
        agotado: false,
      },
      {
        id: prodVeggieId,
        categoriaId: catId,
        nombre: 'Monster Veggie',
        precio: 21900,
        orden: 3,
        activo: true,
        agotado: true,
        agotadoManual: true,
      },
    ]);

    // Ingredientes para alertas
    ingPanId = nuevoId();
    ingTocinetaId = nuevoId();

    await db.insert(ingrediente).values([
      {
        id: ingPanId,
        nombre: 'Pan Brioche',
        unidad: 'UND',
        stockActual: 5,
        stockMinimo: 20,
        costoUnitario: 1200000,
        activo: true,
      },
      {
        id: ingTocinetaId,
        nombre: 'Tocineta',
        unidad: 'G',
        stockActual: 0,
        stockMinimo: 1000,
        costoUnitario: 35000,
        activo: true,
      },
    ]);

    // 3. Mesas
    mesa1Id = nuevoId();
    await db.insert(mesa).values({
      id: mesa1Id,
      nombre: 'Mesa 1',
      capacidad: 4,
      activa: true,
    });

    // 4. Pedido Olvidado (>12 h de inactividad, estado ABIERTO)
    pedidoOlvidadoId = nuevoId();
    const hace13Horas = new Date(Date.now() - 13 * 3600 * 1000);
    await db.insert(pedido).values({
      id: pedidoOlvidadoId,
      fechaOperativa: '2026-10-06',
      numeroDia: 1,
      tipo: 'MESA',
      mesaId: mesa1Id,
      usuarioId: idCajero1,
      estado: 'ABIERTO',
      total: 24900,
      base: 24900,
      impuesto: 0,
      createdAt: hace13Horas,
      updatedAt: hace13Horas,
    });

    // 5. Sesiones de caja para pagos
    const sesion1Id = nuevoId();
    const sesion2Id = nuevoId();
    await db.insert(sesionCaja).values([
      {
        id: sesion1Id,
        usuarioId: idCajero1,
        estado: 'ABIERTA',
        montoApertura: 50000,
      },
      {
        id: sesion2Id,
        usuarioId: idCajero2,
        estado: 'ABIERTA',
        montoApertura: 50000,
      },
    ]);

    // 6. Ventas del día 2026-10-06 (cajero1)
    // Pedido 1: 2 x Monster Clásica = $49.800, propina $5.000, pago EFECTIVO $54.800
    const ped1Id = nuevoId();
    await db.insert(pedido).values({
      id: ped1Id,
      fechaOperativa: '2026-10-06',
      numeroDia: 2,
      tipo: 'LLEVAR',
      usuarioId: idCajero1,
      estado: 'CERRADO',
      total: 49800,
      base: 49800,
      impuesto: 0,
      cerradoAt: new Date(),
    });
    await db.insert(pedidoItem).values({
      id: nuevoId(),
      pedidoId: ped1Id,
      productoId: prodClasicaId,
      nombreProducto: 'Monster Clásica',
      precioUnitario: 24900,
      cantidad: 2,
      totalLinea: 49800,
    });
    const rec1Id = nuevoId();
    await db.insert(recibo).values({
      id: rec1Id,
      pedidoId: ped1Id,
      sesionCajaId: sesion1Id,
      usuarioId: idCajero1,
      total: 49800,
      base: 49800,
      impuesto: 0,
      regimenTributario: 'NO_RESPONSABLE',
      propina: 5000,
    });
    await db.insert(pago).values({
      id: nuevoId(),
      reciboId: rec1Id,
      metodo: 'EFECTIVO',
      monto: 54800,
      recibido: 60000,
      cambio: 5200,
    });

    // Pedido 2: 1 x Monster Doble = $34.900, propina $0, pago TARJETA $34.900
    const ped2Id = nuevoId();
    await db.insert(pedido).values({
      id: ped2Id,
      fechaOperativa: '2026-10-06',
      numeroDia: 3,
      tipo: 'LLEVAR',
      usuarioId: idCajero1,
      estado: 'CERRADO',
      total: 34900,
      base: 34900,
      impuesto: 0,
      cerradoAt: new Date(),
    });
    await db.insert(pedidoItem).values({
      id: nuevoId(),
      pedidoId: ped2Id,
      productoId: prodDobleId,
      nombreProducto: 'Monster Doble',
      precioUnitario: 34900,
      cantidad: 1,
      totalLinea: 34900,
    });
    const rec2Id = nuevoId();
    await db.insert(recibo).values({
      id: rec2Id,
      pedidoId: ped2Id,
      sesionCajaId: sesion1Id,
      usuarioId: idCajero1,
      total: 34900,
      base: 34900,
      impuesto: 0,
      regimenTributario: 'NO_RESPONSABLE',
      propina: 0,
    });
    await db.insert(pago).values({
      id: nuevoId(),
      reciboId: rec2Id,
      metodo: 'TARJETA',
      monto: 34900,
    });

    // 7. Ventas del día 2026-10-07 (cajero2)
    // Pedido 3: 1 x Clásica ($24.900) + 1 x Doble ($34.900) = $59.800, propina $6.000, pago TRANSFERENCIA $65.800
    const ped3Id = nuevoId();
    await db.insert(pedido).values({
      id: ped3Id,
      fechaOperativa: '2026-10-07',
      numeroDia: 1,
      tipo: 'LLEVAR',
      usuarioId: idCajero2,
      estado: 'CERRADO',
      total: 59800,
      base: 59800,
      impuesto: 0,
      cerradoAt: new Date(),
    });
    await db.insert(pedidoItem).values([
      {
        id: nuevoId(),
        pedidoId: ped3Id,
        productoId: prodClasicaId,
        nombreProducto: 'Monster Clásica',
        precioUnitario: 24900,
        cantidad: 1,
        totalLinea: 24900,
      },
      {
        id: nuevoId(),
        pedidoId: ped3Id,
        productoId: prodDobleId,
        nombreProducto: 'Monster Doble',
        precioUnitario: 34900,
        cantidad: 1,
        totalLinea: 34900,
      },
    ]);
    const rec3Id = nuevoId();
    await db.insert(recibo).values({
      id: rec3Id,
      pedidoId: ped3Id,
      sesionCajaId: sesion2Id,
      usuarioId: idCajero2,
      total: 59800,
      base: 59800,
      impuesto: 0,
      regimenTributario: 'NO_RESPONSABLE',
      propina: 6000,
    });
    await db.insert(pago).values({
      id: nuevoId(),
      reciboId: rec3Id,
      metodo: 'TRANSFERENCIA',
      monto: 65800,
    });

    // 8. Pedido Anulado del día 2026-10-07 (monto $20.000)
    const pedAnuladoId = nuevoId();
    await db.insert(pedido).values({
      id: pedAnuladoId,
      fechaOperativa: '2026-10-07',
      numeroDia: 2,
      tipo: 'LLEVAR',
      usuarioId: idCajero2,
      estado: 'ANULADO',
      total: 20000,
      base: 20000,
      impuesto: 0,
      anuladoAt: new Date(),
      motivoAnulacion: 'Cliente desistió',
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  const get = (ruta: string, cookie?: string) =>
    fetch(`${base}${ruta}`, {
      headers: { origin: ORIGEN, ...(cookie ? { cookie } : {}) },
    });

  describe('Control de acceso RBAC (RN-51)', () => {
    it('CAJERO → 403 en GET /admin/reportes/ventas', async () => {
      const res = await get('/admin/reportes/ventas?desde=2026-10-06&hasta=2026-10-07', cookieCajero);
      expect(res.status).toBe(403);
    });

    it('CAJERO → 403 en GET /admin/reportes/ventas.csv', async () => {
      const res = await get('/admin/reportes/ventas.csv?desde=2026-10-06&hasta=2026-10-07', cookieCajero);
      expect(res.status).toBe(403);
    });

    it('CAJERO → 403 en GET /admin/alertas', async () => {
      const res = await get('/admin/alertas', cookieCajero);
      expect(res.status).toBe(403);
    });
  });

  describe('Validación de parámetros (RN-16)', () => {
    it('RN-16: rechaza rango > 92 días con 400 VALIDACION', async () => {
      const res = await get('/admin/reportes/ventas?desde=2026-01-01&hasta=2026-05-01', cookieAdmin);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { codigo: string };
      expect(json.codigo).toBe('VALIDACION');
    });

    it('RN-16: rechaza desde > hasta con 400 VALIDACION', async () => {
      const res = await get('/admin/reportes/ventas?desde=2026-10-08&hasta=2026-10-07', cookieAdmin);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { codigo: string };
      expect(json.codigo).toBe('VALIDACION');
    });

    it('RN-16: rechaza formato de fecha inválido con 400 VALIDACION', async () => {
      const res = await get('/admin/reportes/ventas?desde=invalido&hasta=2026-10-07', cookieAdmin);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { codigo: string };
      expect(json.codigo).toBe('VALIDACION');
    });
  });

  describe('Reportes de Ventas por Agrupación (RN-16)', () => {
    it('RN-16: agrupa por DÍA y los totales cuadran con los pedidos cerrados', async () => {
      const res = await get('/admin/reportes/ventas?desde=2026-10-06&hasta=2026-10-07&agrupar=dia', cookieAdmin);
      expect(res.status).toBe(200);
      const data = (await res.json()) as ReporteVentasRespuesta;

      expect(data.desde).toBe('2026-10-06');
      expect(data.hasta).toBe('2026-10-07');
      expect(data.agrupar).toBe('dia');

      // Dos días con ventas
      expect(data.items).toHaveLength(2);

      const dia1 = data.items.find((i) => i.clave === '2026-10-06');
      expect(dia1).toBeDefined();
      expect(dia1?.pedidos).toBe(2);
      expect(dia1?.ventas).toBe(84700); // 49800 + 34900
      expect(dia1?.propinas).toBe(5000);
      expect(dia1?.ticketPromedio).toBe(Math.round(84700 / 2));

      const dia2 = data.items.find((i) => i.clave === '2026-10-07');
      expect(dia2).toBeDefined();
      expect(dia2?.pedidos).toBe(1);
      expect(dia2?.ventas).toBe(59800);
      expect(dia2?.propinas).toBe(6000);
      expect(dia2?.ticketPromedio).toBe(59800);

      // Totales del rango
      expect(data.totales.pedidos).toBe(3);
      expect(data.totales.ventas).toBe(144500); // 84700 + 59800
      expect(data.totales.propinas).toBe(11000);
      expect(data.totales.ticketPromedio).toBe(Math.round(144500 / 3));

      // Los pedidos anulados NO cuentan como ventas y se reportan aparte
      expect(data.totales.anulados.cantidad).toBe(1);
      expect(data.totales.anulados.monto).toBe(20000);
    });

    it('agrupa por PRODUCTO y reporta unidades y ventas correctas', async () => {
      const res = await get('/admin/reportes/ventas?desde=2026-10-06&hasta=2026-10-07&agrupar=producto', cookieAdmin);
      expect(res.status).toBe(200);
      const data = (await res.json()) as ReporteVentasRespuesta;

      expect(data.agrupar).toBe('producto');
      expect(data.items).toHaveLength(2);

      const clasica = data.items.find((i) => i.etiqueta === 'Monster Clásica');
      expect(clasica).toBeDefined();
      expect(clasica?.unidades).toBe(3); // 2 en ped1 + 1 en ped3
      expect(clasica?.ventas).toBe(74700); // 3 * 24900
      expect(clasica?.propinas).toBe(0);

      const doble = data.items.find((i) => i.etiqueta === 'Monster Doble');
      expect(doble).toBeDefined();
      expect(doble?.unidades).toBe(2); // 1 en ped2 + 1 en ped3
      expect(doble?.ventas).toBe(69800); // 2 * 34900
      expect(doble?.propinas).toBe(0);

      // Total unidades y total ventas
      expect(data.totales.unidades).toBe(5);
      expect(data.totales.ventas).toBe(144500); // 74700 + 69800 = 144500
    });

    it('agrupa por MÉTODO y las ventas más propinas cuadran con los pagos', async () => {
      const res = await get('/admin/reportes/ventas?desde=2026-10-06&hasta=2026-10-07&agrupar=metodo', cookieAdmin);
      expect(res.status).toBe(200);
      const data = (await res.json()) as ReporteVentasRespuesta;

      expect(data.agrupar).toBe('metodo');
      expect(data.items).toHaveLength(3);

      const ef = data.items.find((i) => i.clave === 'EFECTIVO');
      expect(ef?.ventas).toBe(49800);
      expect(ef?.propinas).toBe(5000);
      expect(ef?.pedidos).toBe(1);

      const tj = data.items.find((i) => i.clave === 'TARJETA');
      expect(tj?.ventas).toBe(34900);
      expect(tj?.propinas).toBe(0);
      expect(tj?.pedidos).toBe(1);

      const tr = data.items.find((i) => i.clave === 'TRANSFERENCIA');
      expect(tr?.ventas).toBe(59800);
      expect(tr?.propinas).toBe(6000);
      expect(tr?.pedidos).toBe(1);

      // Suma por método cuadra con totales
      const sumaVentas = data.items.reduce((acc, i) => acc + i.ventas, 0);
      const sumaPropinas = data.items.reduce((acc, i) => acc + i.propinas, 0);
      expect(sumaVentas).toBe(144500);
      expect(sumaPropinas).toBe(11000);
      expect(sumaVentas + sumaPropinas).toBe(155500); // Total de pagos registrados
    });

    it('agrupa por CAJERO y cuadra con los pedidos cobrados', async () => {
      const res = await get('/admin/reportes/ventas?desde=2026-10-06&hasta=2026-10-07&agrupar=cajero', cookieAdmin);
      expect(res.status).toBe(200);
      const data = (await res.json()) as ReporteVentasRespuesta;

      expect(data.agrupar).toBe('cajero');
      expect(data.items).toHaveLength(2);

      const c1 = data.items.find((i) => i.etiqueta === 'caja1');
      expect(c1?.pedidos).toBe(2);
      expect(c1?.ventas).toBe(84700);
      expect(c1?.propinas).toBe(5000);

      const c2 = data.items.find((i) => i.etiqueta === 'caja2');
      expect(c2?.pedidos).toBe(1);
      expect(c2?.ventas).toBe(59800);
      expect(c2?.propinas).toBe(6000);

      expect(data.totales.ventas).toBe(144500);
    });
  });

  describe('Exportación CSV (GET /admin/reportes/ventas.csv)', () => {
    it('genera archivo CSV con separador ";", BOM UTF-8 y encabezados correctos', async () => {
      const res = await get('/admin/reportes/ventas.csv?desde=2026-10-06&hasta=2026-10-07&agrupar=dia', cookieAdmin);
      expect(res.status).toBe(200);

      expect(res.headers.get('content-type')).toContain('text/csv');
      expect(res.headers.get('content-disposition')).toBe(
        'attachment; filename="reporte-ventas-2026-10-06-a-2026-10-07.csv"',
      );

      const buf = Buffer.from(await res.arrayBuffer());
      // BOM UTF-8 (EF BB BF) presente
      expect(buf[0]).toBe(0xef);
      expect(buf[1]).toBe(0xbb);
      expect(buf[2]).toBe(0xbf);

      const text = buf.toString('utf-8');
      expect(text.charCodeAt(0)).toBe(0xfeff);

      // Separador punto y coma
      expect(text).toContain('Fecha;Pedidos;Ventas;Propinas;Ticket Promedio');
      expect(text).toContain('2026-10-06;2;84700;5000;42350');
      expect(text).toContain('2026-10-07;1;59800;6000;59800');
      expect(text).toContain('TOTAL;3;144500;11000;48167');
      expect(text).toContain('Pedidos Anulados;1');
      expect(text).toContain('Monto Anulado;20000');
    });
  });

  describe('Alertas del Sistema (RN-17, RN-36, RN-61)', () => {
    it('RN-17, RN-36: detecta pedido olvidado (>12h), ingredientes bajos/agotados y productos agotados', async () => {
      const res = await get('/admin/alertas', cookieAdmin);
      expect(res.status).toBe(200);
      const data = (await res.json()) as AlertasRespuesta;

      expect(data.items.length).toBeGreaterThanOrEqual(4);

      // 1. Pedido olvidado (RN-17)
      const alertaPedido = data.items.find((a) => a.tipo === 'PEDIDO_OLVIDADO');
      expect(alertaPedido).toBeDefined();
      expect(alertaPedido?.severidad).toBe('ADVERTENCIA');
      expect(alertaPedido?.entidadId).toBe(pedidoOlvidadoId);
      if (alertaPedido && alertaPedido.tipo === 'PEDIDO_OLVIDADO') {
        expect(alertaPedido.datos.numeroDia).toBe(1);
        expect(alertaPedido.datos.mesaNombre).toBe('Mesa 1');
      }

      // 2. Ingrediente bajo mínimo (RN-36)
      const alertaBajo = data.items.find((a) => a.tipo === 'INGREDIENTE_BAJO_MINIMO');
      expect(alertaBajo).toBeDefined();
      expect(alertaBajo?.severidad).toBe('ADVERTENCIA');
      expect(alertaBajo?.entidadId).toBe(ingPanId);
      if (alertaBajo && alertaBajo.tipo === 'INGREDIENTE_BAJO_MINIMO') {
        expect(alertaBajo.datos.nombre).toBe('Pan Brioche');
        expect(alertaBajo.datos.stockActual).toBe(5);
        expect(alertaBajo.datos.stockMinimo).toBe(20);
        expect(alertaBajo.datos.unidad).toBe('UND');
      }

      // 3. Ingrediente agotado (RN-36)
      const alertaAgotado = data.items.find((a) => a.tipo === 'INGREDIENTE_AGOTADO');
      expect(alertaAgotado).toBeDefined();
      expect(alertaAgotado?.severidad).toBe('CRITICA');
      expect(alertaAgotado?.entidadId).toBe(ingTocinetaId);
      if (alertaAgotado && alertaAgotado.tipo === 'INGREDIENTE_AGOTADO') {
        expect(alertaAgotado.datos.nombre).toBe('Tocineta');
        expect(alertaAgotado.datos.unidad).toBe('G');
      }

      // 4. Producto agotado
      const alertaProd = data.items.find((a) => a.tipo === 'PRODUCTO_AGOTADO');
      expect(alertaProd).toBeDefined();
      expect(alertaProd?.severidad).toBe('CRITICA');
      expect(alertaProd?.entidadId).toBe(prodVeggieId);
      if (alertaProd && alertaProd.tipo === 'PRODUCTO_AGOTADO') {
        expect(alertaProd.datos.nombre).toBe('Monster Veggie');
      }
    });
  });
});
