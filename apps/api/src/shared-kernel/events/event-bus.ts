import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DB, type Db, type Tx } from '../db/db';
import { eventoSistema } from './evento-sistema.schema';

export const CANAL_EVENTOS = 'evento_sistema';

export interface EventoDominio<T = unknown> {
  tipo: string;
  modulo: string;
  agregadoId?: string | null;
  usuarioId?: string | null;
  payload: T;
}

export interface EventoPublicado<T = unknown> extends EventoDominio<T> {
  id: number;
  createdAt: Date;
}

/** Corre dentro de la transacción que publicó el evento: si falla, se revierte todo. */
export type HandlerEnTx = (tx: Tx, evento: EventoPublicado) => Promise<void>;
/** Corre después del COMMIT (outbox). Debe ser idempotente: puede reintentarse. */
export type HandlerPostCommit = (evento: EventoPublicado) => Promise<void>;

/**
 * Bus de eventos de dominio (ARCHITECTURE.md §5). Los módulos registran sus handlers
 * explícitamente en `onModuleInit` con `alPublicarEnTx` / `despuesDeCommit`.
 */
@Injectable()
export class EventBus {
  private readonly handlersEnTx = new Map<string, HandlerEnTx[]>();
  private readonly handlersPostCommit = new Map<string, HandlerPostCommit[]>();

  constructor(@Inject(DB) private readonly db: Db) {}

  alPublicarEnTx(tipo: string, handler: HandlerEnTx): void {
    this.handlersEnTx.set(tipo, [...(this.handlersEnTx.get(tipo) ?? []), handler]);
  }

  despuesDeCommit(tipo: string, handler: HandlerPostCommit): void {
    this.handlersPostCommit.set(tipo, [...(this.handlersPostCommit.get(tipo) ?? []), handler]);
  }

  handlersPostCommitDe(tipo: string): readonly HandlerPostCommit[] {
    return this.handlersPostCommit.get(tipo) ?? [];
  }

  /**
   * Guarda el evento en `evento_sistema` y ejecuta los handlers transaccionales con el mismo `tx`.
   * El NOTIFY se entrega solo si la transacción hace COMMIT, y despierta al despachador del outbox.
   */
  async publicarEnTx<T>(tx: Tx, evento: EventoDominio<T>): Promise<EventoPublicado<T>> {
    const [fila] = await tx
      .insert(eventoSistema)
      .values({
        tipo: evento.tipo,
        modulo: evento.modulo,
        agregadoId: evento.agregadoId ?? null,
        usuarioId: evento.usuarioId ?? null,
        payload: evento.payload,
      })
      .returning({ id: eventoSistema.id, createdAt: eventoSistema.createdAt });
    if (!fila) throw new Error('No se pudo registrar el evento');

    const publicado: EventoPublicado<T> = { ...evento, id: fila.id, createdAt: fila.createdAt };
    for (const handler of this.handlersEnTx.get(evento.tipo) ?? []) {
      await handler(tx, publicado);
    }
    await tx.execute(sql`select pg_notify(${CANAL_EVENTOS}, ${String(fila.id)})`);
    return publicado;
  }

  /** Atajo para publicar un evento aislado en su propia transacción. */
  async publicar<T>(evento: EventoDominio<T>): Promise<EventoPublicado<T>> {
    return this.db.transaction((tx) => this.publicarEnTx(tx, evento));
  }
}
