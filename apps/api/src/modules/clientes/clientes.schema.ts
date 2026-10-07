import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const cliente = pgTable(
  'cliente',
  {
    id: uuid().primaryKey(),
    nombre: text().notNull(),
    telefono: text(),
    documento: text(),
    email: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('cliente_telefono_unique')
      .on(t.telefono)
      .where(sql`${t.telefono} is not null`),
  ],
);
