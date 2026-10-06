import { sql } from 'drizzle-orm';
import { bigint, boolean, check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { TIPOS_MOVIMIENTO_INVENTARIO, UNIDADES } from '@mb/shared';

export const ingrediente = pgTable(
  'ingrediente',
  {
    id: uuid().primaryKey(),
    nombre: text().notNull().unique(),
    unidad: text({ enum: UNIDADES }).notNull(),
    stockActual: bigint({ mode: 'number' }).notNull().default(0),
    stockMinimo: bigint({ mode: 'number' }).notNull().default(0),
    costoUnitario: bigint({ mode: 'number' }).notNull().default(0),
    activo: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('ingrediente_unidad_check', sql`${t.unidad} in ('G', 'ML', 'UND')`),
    check('ingrediente_stock_minimo_check', sql`${t.stockMinimo} >= 0`),
    check('ingrediente_costo_unitario_check', sql`${t.costoUnitario} >= 0`),
  ],
);

export const movimientoInventario = pgTable(
  'movimiento_inventario',
  {
    id: uuid().primaryKey(),
    ingredienteId: uuid()
      .notNull()
      .references(() => ingrediente.id, { onDelete: 'restrict' }),
    tipo: text({ enum: TIPOS_MOVIMIENTO_INVENTARIO }).notNull(),
    cantidad: bigint({ mode: 'number' }).notNull(),
    stockResultante: bigint({ mode: 'number' }).notNull(),
    referenciaTipo: text(),
    referenciaId: uuid(),
    usuarioId: uuid().notNull(),
    motivo: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('movimiento_inventario_ingrediente_created_idx').on(t.ingredienteId, t.createdAt),
    check(
      'movimiento_inventario_tipo_check',
      sql`${t.tipo} in ('CONSUMO', 'ENTRADA', 'AJUSTE', 'MERMA', 'REVERSION')`,
    ),
    check('movimiento_inventario_cantidad_no_cero_check', sql`${t.cantidad} != 0`),
  ],
);
