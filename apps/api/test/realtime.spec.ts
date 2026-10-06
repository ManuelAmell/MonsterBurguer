import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../src/app.factory';
import { cargarEnv } from '../src/config/env';
import { RealtimeHub } from '../src/modules/realtime/realtime.hub';
import { RealtimeService } from '../src/modules/realtime/realtime.service';
import { DB, type Db } from '../src/shared-kernel/db/db';
import { EventBus } from '../src/shared-kernel/events/event-bus';
import { OutboxDispatcher } from '../src/shared-kernel/events/outbox.dispatcher';
import { crearUsuario, DATABASE_URL_TEST, prepararBaseDeTest } from './helpers/test-db';

const ORIGEN = 'http://localhost:5175';

describe.skipIf(!DATABASE_URL_TEST)('realtime: stream SSE, hub y reconexión (Hito 3)', () => {
  let app: INestApplication;
  let db: Db;
  let eventBus: EventBus;
  let outbox: OutboxDispatcher;
  let hub: RealtimeHub;
  let realtimeService: RealtimeService;
  let base: string;

  let cookieAdmin: string;
  let cookieCocina: string;
  let cookieCajero: string;

  beforeAll(async () => {
    const url = DATABASE_URL_TEST as string;
    await prepararBaseDeTest(url);

    app = await crearApp(
      cargarEnv({
        NODE_ENV: 'test',
        APP_ORIGIN: ORIGEN,
        DATABASE_URL: url,
        LOG_LEVEL: 'silent',
      }),
    );
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    base = `http://127.0.0.1:${port}/api/v1`;

    db = app.get<Db>(DB);
    eventBus = app.get(EventBus);
    outbox = app.get(OutboxDispatcher);
    hub = app.get(RealtimeHub);
    realtimeService = app.get(RealtimeService);

    await crearUsuario(db, { username: 'admin_rt', password: 'password123', rol: 'ADMIN' });
    await crearUsuario(db, { username: 'cocina_rt', password: 'password123', rol: 'COCINA' });
    await crearUsuario(db, { username: 'cajero_rt', password: 'password123', rol: 'CAJERO' });

    const login = async (username: string) => {
      const res = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGEN },
        body: JSON.stringify({ username, password: 'password123' }),
      });
      return res.headers.get('set-cookie')?.split(';')[0] ?? '';
    };

    cookieAdmin = await login('admin_rt');
    cookieCocina = await login('cocina_rt');
    cookieCajero = await login('cajero_rt');
  });

  afterAll(async () => {
    hub.destruir();
    await app?.close();
  });

  const decoder = new TextDecoder();

  async function leerChunk(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    filtro: string,
    timeoutMs = 4000,
  ): Promise<string> {
    let acumulado = '';
    const inicio = Date.now();

    while (Date.now() - inicio < timeoutMs) {
      const raceResult = await Promise.race([
        reader.read(),
        new Promise<{ value: undefined; done: true }>((resolve) =>
          setTimeout(() => resolve({ value: undefined, done: true }), 300),
        ),
      ]);

      if (raceResult.value) {
        acumulado += decoder.decode(raceResult.value, { stream: true });
        if (acumulado.includes(filtro)) {
          return acumulado;
        }
      }
      if (raceResult.done && !raceResult.value) {
        // pequeño delay antes de reintentar si no ha terminado el tiempo
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    return acumulado;
  }

  it('stream requiere sesión (401 NO_AUTENTICADO)', async () => {
    const res = await fetch(`${base}/stream?canales=cocina`);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { codigo: string };
    expect(body.codigo).toBe('NO_AUTENTICADO');
  });

  it('rechaza canal no permitido según rol con 403 (COCINA no puede pedir pos)', async () => {
    const res = await fetch(`${base}/stream?canales=pos`, {
      headers: { cookie: cookieCocina },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { codigo: string };
    expect(body.codigo).toBe('SIN_PERMISO');
  });

  it('rechaza canal no permitido según rol con 403 (CAJERO no puede pedir cocina)', async () => {
    const res = await fetch(`${base}/stream?canales=cocina`, {
      headers: { cookie: cookieCajero },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { codigo: string };
    expect(body.codigo).toBe('SIN_PERMISO');
  });

  it('rechaza canales inválidos o desconocidos con 403 para cualquier rol', async () => {
    const res = await fetch(`${base}/stream?canales=canal_inexistente`, {
      headers: { cookie: cookieAdmin },
    });
    expect(res.status).toBe(403);
  });

  it('permite canales válidos y entrega cabeceras SSE correctas', async () => {
    const ac = new AbortController();
    const res = await fetch(`${base}/stream?canales=cocina,pos,admin`, {
      headers: { cookie: cookieAdmin },
      signal: ac.signal,
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(res.headers.get('connection')).toBe('keep-alive');
    expect(res.headers.get('x-accel-buffering')).toBe('no');

    ac.abort();
  });

  it('recibe evento publicado post-commit', async () => {
    const ac = new AbortController();
    const res = await fetch(`${base}/stream?canales=cocina`, {
      headers: { cookie: cookieCocina },
      signal: ac.signal,
    });
    expect(res.status).toBe(200);
    const reader = res.body!.getReader();

    // Publicar evento en transacción que hace commit
    await db.transaction(async (tx) => {
      await eventBus.publicarEnTx(tx, {
        tipo: 'PedidoConfirmado',
        modulo: 'pedidos',
        payload: { comandaId: 'cmd-1', pedidoId: 'ped-1', numeroDia: 10 },
      });
    });

    // Despachar el outbox
    await outbox.drenar();

    // Leer del stream SSE
    const contenido = await leerChunk(reader, 'event: comanda.nueva');
    expect(contenido).toContain('event: comanda.nueva');
    expect(contenido).toContain('"comandaId":"cmd-1"');
    expect(contenido).toContain('"numeroDia":10');
    expect(contenido).toMatch(/id: \d+/);

    ac.abort();
  });

  it('NO recibe eventos de transacciones con rollback', async () => {
    const ac = new AbortController();
    const res = await fetch(`${base}/stream?canales=cocina`, {
      headers: { cookie: cookieCocina },
      signal: ac.signal,
    });
    const reader = res.body!.getReader();

    // Transacción que falla y hace rollback
    try {
      await db.transaction(async (tx) => {
        await eventBus.publicarEnTx(tx, {
          tipo: 'PedidoConfirmado',
          modulo: 'pedidos',
          payload: { comandaId: 'rollback-comanda' },
        });
        throw new Error('Forzar ROLLBACK');
      });
    } catch {
      // Ignorar error provocado intencionalmente
    }

    await outbox.drenar();

    // Esperar a leer y verificar que NO llega rollback-comanda
    const contenido = await leerChunk(reader, 'rollback-comanda', 800);
    expect(contenido).not.toContain('rollback-comanda');

    ac.abort();
  });

  it('Last-Event-ID reenvía lo perdido desde el búfer o base de datos', async () => {
    // Publicar dos eventos post-commit
    let id1 = 0;
    let id2 = 0;

    await db.transaction(async (tx) => {
      const ev1 = await eventBus.publicarEnTx(tx, {
        tipo: 'PedidoConfirmado',
        modulo: 'pedidos',
        payload: { comandaId: 'recon-1', numeroDia: 21 },
      });
      id1 = ev1.id;
    });

    await db.transaction(async (tx) => {
      const ev2 = await eventBus.publicarEnTx(tx, {
        tipo: 'PedidoConfirmado',
        modulo: 'pedidos',
        payload: { comandaId: 'recon-2', numeroDia: 22 },
      });
      id2 = ev2.id;
    });

    await outbox.drenar();

    // Conectar nuevo cliente simulando reconexión con Last-Event-ID = id1
    const ac = new AbortController();
    const res = await fetch(`${base}/stream?canales=cocina`, {
      headers: {
        cookie: cookieCocina,
        'last-event-id': String(id1),
      },
      signal: ac.signal,
    });
    expect(res.status).toBe(200);
    const reader = res.body!.getReader();

    // Debe recibir el evento id2 perdido
    const contenido = await leerChunk(reader, `id: ${id2}`);
    expect(contenido).toContain(`id: ${id2}`);
    expect(contenido).toContain('event: comanda.nueva');
    expect(contenido).toContain('"comandaId":"recon-2"');

    ac.abort();
  });

  it('reconexión masiva de múltiples clientes (12 dispositivos) a la vez con Last-Event-ID (ALTA-02)', async () => {
    let ultimoId = 0;
    await db.transaction(async (tx) => {
      const ev = await eventBus.publicarEnTx(tx, {
        tipo: 'PedidoConfirmado',
        modulo: 'pedidos',
        payload: { comandaId: 'masivo-1', numeroDia: 99 },
      });
      ultimoId = ev.id;
    });
    await outbox.drenar();

    const CANTIDAD_DISPOSITIVOS = 12;
    const controladores: AbortController[] = [];

    // Lanzar 12 conexiones concurrentes solicitando reconexión desde ultimoId - 1
    const promesas = Array.from({ length: CANTIDAD_DISPOSITIVOS }, async () => {
      const ac = new AbortController();
      controladores.push(ac);
      const res = await fetch(`${base}/stream?canales=cocina`, {
        headers: {
          cookie: cookieCocina,
          'last-event-id': String(ultimoId - 1),
        },
        signal: ac.signal,
      });
      expect(res.status).toBe(200);
      const reader = res.body!.getReader();
      const chunk = await leerChunk(reader, `id: ${ultimoId}`);
      expect(chunk).toContain(`id: ${ultimoId}`);
      expect(chunk).toContain('event: comanda.nueva');
      return true;
    });

    const resultados = await Promise.all(promesas);
    expect(resultados).toHaveLength(CANTIDAD_DISPOSITIVOS);
    expect(resultados.every(Boolean)).toBe(true);

    for (const ac of controladores) ac.abort();
  });

  it('fallback a base de datos si Last-Event-ID es más antiguo que el búfer circular', async () => {
    // Configurar búfer con capacidad reducida de 2 para probar fallback a BD
    realtimeService.configurarCapacidadBufer(2);

    let idAntiguo = 0;
    await db.transaction(async (tx) => {
      const ev = await eventBus.publicarEnTx(tx, {
        tipo: 'PedidoConfirmado',
        modulo: 'pedidos',
        payload: { comandaId: 'viejo-0' },
      });
      idAntiguo = ev.id;
    });

    // Publicar 3 eventos más para desbordar el búfer de capacidad 2
    for (let i = 1; i <= 3; i++) {
      await db.transaction(async (tx) => {
        await eventBus.publicarEnTx(tx, {
          tipo: 'PedidoConfirmado',
          modulo: 'pedidos',
          payload: { comandaId: `viejo-${i}` },
        });
      });
    }
    await outbox.drenar();

    // Reconectar con Last-Event-ID del evento antiguo que ya no cabe en el búfer
    const ac = new AbortController();
    const res = await fetch(`${base}/stream?canales=cocina`, {
      headers: {
        cookie: cookieCocina,
        'last-event-id': String(idAntiguo),
      },
      signal: ac.signal,
    });
    expect(res.status).toBe(200);
    const reader = res.body!.getReader();

    // Debe recuperar vía fallback a evento_sistema en BD
    const contenido = await leerChunk(reader, 'viejo-3');
    expect(contenido).toContain('viejo-1');
    expect(contenido).toContain('viejo-2');
    expect(contenido).toContain('viejo-3');

    // Restaurar capacidad normal del búfer
    realtimeService.configurarCapacidadBufer(500);
    ac.abort();
  });

  it('envía heartbeat correctamente', async () => {
    const ac = new AbortController();
    const res = await fetch(`${base}/stream?canales=cocina`, {
      headers: { cookie: cookieCocina },
      signal: ac.signal,
    });
    const reader = res.body!.getReader();

    // Disparar heartbeat explícitamente en el hub
    hub.enviarHeartbeatATodos();

    const chunk = await leerChunk(reader, ': heartbeat');
    expect(chunk).toContain(': heartbeat');

    ac.abort();
  });

  it('cierra limpio la conexión al desconectarse el cliente sin fugas de listeners', async () => {
    // Esperar a que cualquier conexión anterior termine de cerrarse
    let esperaInicial = 0;
    while (hub.numeroClientes() > 0 && esperaInicial < 20) {
      await new Promise((r) => setTimeout(r, 50));
      esperaInicial++;
    }

    const totalInicial = hub.numeroClientes();

    const ac = new AbortController();
    const res = await fetch(`${base}/stream?canales=pos`, {
      headers: { cookie: cookieCajero },
      signal: ac.signal,
    });
    expect(res.status).toBe(200);

    const reader = res.body!.getReader();

    // Esperar a que el servidor registre el nuevo cliente en el hub
    let registrado = false;
    for (let i = 0; i < 20; i++) {
      if (hub.numeroClientes() === totalInicial + 1) {
        registrado = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 30));
    }
    expect(registrado).toBe(true);

    // Abortar y cancelar reader
    ac.abort();
    await reader.cancel().catch(() => undefined);

    // Esperar a que el evento close sea procesado por el servidor
    let cerrado = false;
    for (let i = 0; i < 30; i++) {
      if (hub.numeroClientes() === totalInicial) {
        cerrado = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }

    expect(cerrado).toBe(true);
  });
});
