import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const mesa = pgTable('mesa', {
  id: uuid().primaryKey(),
  nombre: text().notNull().unique(),
  capacidad: integer().notNull().default(4),
  activa: boolean().notNull().default(true),
  orden: integer().notNull().default(0),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
