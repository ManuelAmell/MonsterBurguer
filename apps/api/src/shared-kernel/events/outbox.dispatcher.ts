import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { and, asc, eq, isNull, lt, sql } from 'drizzle-orm';
import type { Pool, PoolClient } from 'pg';
import { DB, PG_POOL, type Db } from '../db/db';
import { CANAL_EVENTOS, EventBus, type EventoPublicado } from './event-bus';
import { eventoSistema } from './evento-sistema.schema';

const LOTE = 50;
const MAX_INTENTOS = 10;
const SONDEO_MS = 5_000;
const RECONEXION_MS = 2_000;

/**
 * Ejecuta los handlers post-commit leyendo `evento_sistema` pendiente.
 * Se despierta con LISTEN/NOTIFY al instante y además sondea cada 5 s por si se perdió una notificación.
 */
@Injectable()
export class OutboxDispatcher implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxDispatcher.name);
  private listener: PoolClient | null = null;
  private timer: NodeJS.Timeout | null = null;
  private drenando: Promise<void> | null = null;
  private pendiente = false;
  private detenido = false;
  private reconexion: NodeJS.Timeout | null = null;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly bus: EventBus,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.conectarListener();
    this.timer = setInterval(() => this.despertar(), SONDEO_MS);
    this.despertar();
  }

  async onApplicationShutdown(): Promise<void> {
    this.detenido = true;
    if (this.timer) clearInterval(this.timer);
    if (this.reconexion) clearTimeout(this.reconexion);
    await this.drenando;
    if (this.listener) {
      await this.listener.query(`UNLISTEN ${CANAL_EVENTOS}`).catch(() => undefined);
      this.listener.release();
      this.listener = null;
    }
  }

  /** Abre el cliente LISTEN. Si la conexión cae, se descarta y se reintenta sin tumbar el proceso. */
  private async conectarListener(): Promise<void> {
    if (this.detenido) return;
    let cliente: PoolClient | null = null;
    try {
      cliente = await this.pool.connect();
      const actual = cliente;
      actual.on('notification', () => this.despertar());
      actual.on('error', (err: Error) => {
        this.logger.warn(`Conexión LISTEN caída: ${err.message}`);
        this.descartarListener(actual, err);
      });
      await actual.query(`LISTEN ${CANAL_EVENTOS}`);
      this.listener = actual;
    } catch (err) {
      this.logger.warn(`No se pudo abrir LISTEN: ${String(err)}`);
      if (cliente) this.descartarListener(cliente, err instanceof Error ? err : new Error(String(err)));
      else this.programarReconexion();
    }
  }

  private descartarListener(cliente: PoolClient, err: Error): void {
    if (this.listener === cliente) this.listener = null;
    cliente.removeAllListeners('notification');
    try {
      cliente.release(err); // destruye la conexión en vez de devolverla al pool
    } catch {
      // ya liberada
    }
    this.programarReconexion();
  }

  private programarReconexion(): void {
    if (this.detenido || this.reconexion) return;
    this.reconexion = setTimeout(() => {
      this.reconexion = null;
      void this.conectarListener();
    }, RECONEXION_MS);
  }

  /** Espera a que no quede nada pendiente (útil en tests). */
  async drenar(): Promise<void> {
    this.despertar();
    while (this.drenando) await this.drenando;
  }

  private despertar(): void {
    if (this.detenido) return;
    if (this.drenando) {
      this.pendiente = true;
      return;
    }
    this.drenando = this.procesarHastaVaciar()
      .catch((err: unknown) => this.logger.error(err))
      .finally(() => {
        this.drenando = null;
        if (this.pendiente) {
          this.pendiente = false;
          this.despertar();
        }
      });
  }

  private async procesarHastaVaciar(): Promise<void> {
    while (!this.detenido && (await this.procesarLote()) === LOTE) {
      // seguir mientras haya lotes completos
    }
  }

  private async procesarLote(): Promise<number> {
    return this.db.transaction(async (tx) => {
      const filas = await tx
        .select()
        .from(eventoSistema)
        .where(and(isNull(eventoSistema.procesadoAt), lt(eventoSistema.intentos, MAX_INTENTOS)))
        .orderBy(asc(eventoSistema.id))
        .limit(LOTE)
        .for('update', { skipLocked: true });

      for (const fila of filas) {
        const evento: EventoPublicado = {
          id: fila.id,
          tipo: fila.tipo,
          modulo: fila.modulo,
          agregadoId: fila.agregadoId,
          usuarioId: fila.usuarioId,
          payload: fila.payload,
          createdAt: fila.createdAt,
        };
        try {
          for (const handler of this.bus.handlersPostCommitDe(fila.tipo)) await handler(evento);
          await tx
            .update(eventoSistema)
            .set({ procesadoAt: sql`now()` })
            .where(eq(eventoSistema.id, fila.id));
        } catch (err) {
          this.logger.warn(`Handler post-commit falló para evento ${fila.id} (${fila.tipo}): ${String(err)}`);
          await tx
            .update(eventoSistema)
            .set({ intentos: sql`${eventoSistema.intentos} + 1`, ultimoError: String(err) })
            .where(eq(eventoSistema.id, fila.id));
        }
      }
      return filas.length;
    });
  }
}
