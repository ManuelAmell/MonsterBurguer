import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const categoria = pgTable('categoria', {
  id: uuid().primaryKey(),
  nombre: text().notNull().unique(),
  orden: integer().notNull().default(0),
  activa: boolean().notNull().default(true),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const producto = pgTable(
  'producto',
  {
    id: uuid().primaryKey(),
    categoriaId: uuid()
      .notNull()
      .references(() => categoria.id, { onDelete: 'restrict' }),
    nombre: text().notNull(),
    descripcion: text(),
    precio: bigint({ mode: 'number' }).notNull(),
    imagenUrl: text(),
    activo: boolean().notNull().default(true),
    agotado: boolean().notNull().default(false),
    agotadoManual: boolean(),
    orden: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('producto_precio_positivo_check', sql`${t.precio} > 0`),
    uniqueIndex('producto_nombre_lower_idx').on(sql`lower(${t.nombre})`),
  ],
);

export const recetaItem = pgTable(
  'receta_item',
  {
    productoId: uuid()
      .notNull()
      .references(() => producto.id, { onDelete: 'cascade' }),
    ingredienteId: uuid().notNull(),
    cantidad: integer().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.productoId, t.ingredienteId] }),
    check('receta_item_cantidad_positiva_check', sql`${t.cantidad} > 0`),
  ],
);
