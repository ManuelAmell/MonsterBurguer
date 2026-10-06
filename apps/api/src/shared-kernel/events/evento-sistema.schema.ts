import { sql } from 'drizzle-orm';
import { bigint, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Outbox + bitácora de interacciones entre subsistemas (RN-60). Solo inserción salvo `procesado_at`. */
export const eventoSistema = pgTable(
  'evento_sistema',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    tipo: text().notNull(),
    modulo: text().notNull(),
    agregadoId: uuid(),
    usuarioId: uuid(),
    payload: jsonb().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    procesadoAt: timestamp({ withTimezone: true }),
    intentos: integer().notNull().default(0),
    ultimoError: text(),
  },
  (t) => [
    index('evento_sistema_pendiente_idx')
      .on(t.id)
      .where(sql`${t.procesadoAt} is null`),
    index('evento_sistema_created_at_idx').on(t.createdAt),
    index('evento_sistema_tipo_idx').on(t.tipo, t.createdAt),
  ],
);
