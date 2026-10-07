import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { ESTADOS_COMANDA, TIPOS_PEDIDO } from '@mb/shared';

/** `pedido_id` es una FK entre módulos: se agrega a mano en la migración. */
export const comanda = pgTable(
  'comanda',
  {
    id: uuid().primaryKey(),
    pedidoId: uuid().notNull().unique(),
    numeroDia: integer().notNull(),
    tipoPedido: text({ enum: TIPOS_PEDIDO }).notNull(),
    mesaNombre: text(),
    estado: text({ enum: ESTADOS_COMANDA }).notNull().default('PENDIENTE'),
    iniciadaAt: timestamp({ withTimezone: true }),
    listaAt: timestamp({ withTimezone: true }),
    entregadaAt: timestamp({ withTimezone: true }),
    anuladaAt: timestamp({ withTimezone: true }),
    version: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('comanda_activas_idx')
      .on(t.estado, t.createdAt)
      .where(sql`${t.estado} in ('PENDIENTE', 'EN_PREPARACION', 'LISTA')`),
    check('comanda_tipo_pedido_check', sql`${t.tipoPedido} in ('MESA', 'LLEVAR')`),
    check(
      'comanda_estado_check',
      sql`${t.estado} in ('PENDIENTE', 'EN_PREPARACION', 'LISTA', 'ENTREGADA', 'ANULADA')`,
    ),
  ],
);

export const comandaItem = pgTable(
  'comanda_item',
  {
    id: uuid().primaryKey(),
    comandaId: uuid()
      .notNull()
      .references(() => comanda.id, { onDelete: 'cascade' }),
    nombre: text().notNull(),
    cantidad: integer().notNull(),
    nota: text(),
    orden: integer().notNull().default(0),
  },
  (t) => [index('comanda_item_comanda_idx').on(t.comandaId)],
);
