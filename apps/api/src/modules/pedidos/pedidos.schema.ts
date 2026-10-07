import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { ESTADOS_PEDIDO, TIPOS_PEDIDO } from '@mb/shared';

export const mesa = pgTable('mesa', {
  id: uuid().primaryKey(),
  nombre: text().notNull().unique(),
  capacidad: integer().notNull().default(4),
  activa: boolean().notNull().default(true),
  orden: integer().notNull().default(0),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/**
 * FK hacia otros módulos (cliente_id, usuario_id, anulado_por, producto_id) son columnas uuid simples aquí;
 * la restricción se agrega a mano en la migración (fronteras de módulo).
 */
export const pedido = pgTable(
  'pedido',
  {
    id: uuid().primaryKey(),
    fechaOperativa: date({ mode: 'string' }).notNull(),
    numeroDia: integer().notNull(),
    tipo: text({ enum: TIPOS_PEDIDO }).notNull(),
    mesaId: uuid().references(() => mesa.id, { onDelete: 'restrict' }),
    clienteId: uuid(),
    usuarioId: uuid().notNull(),
    estado: text({ enum: ESTADOS_PEDIDO }).notNull().default('ABIERTO'),
    total: bigint({ mode: 'number' }).notNull().default(0),
    base: bigint({ mode: 'number' }).notNull().default(0),
    impuesto: bigint({ mode: 'number' }).notNull().default(0),
    nota: text(),
    confirmadoAt: timestamp({ withTimezone: true }),
    cerradoAt: timestamp({ withTimezone: true }),
    anuladoAt: timestamp({ withTimezone: true }),
    anuladoPor: uuid(),
    motivoAnulacion: text(),
    version: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('pedido_fecha_numero_uq').on(t.fechaOperativa, t.numeroDia),
    // RN-11: una mesa, un pedido activo.
    uniqueIndex('pedido_mesa_activa_uq')
      .on(t.mesaId)
      .where(sql`${t.estado} in ('ABIERTO', 'CONFIRMADO')`),
    index('pedido_estado_fecha_idx').on(t.estado, t.fechaOperativa),
    check('pedido_tipo_check', sql`${t.tipo} in ('MESA', 'LLEVAR')`),
    check(
      'pedido_estado_check',
      sql`${t.estado} in ('ABIERTO', 'CONFIRMADO', 'CERRADO', 'ANULADO')`,
    ),
    check('pedido_total_check', sql`${t.total} >= 0`),
    check('pedido_mesa_tipo_check', sql`(${t.tipo} = 'MESA') = (${t.mesaId} is not null)`),
  ],
);

export const pedidoItem = pgTable(
  'pedido_item',
  {
    id: uuid().primaryKey(),
    pedidoId: uuid()
      .notNull()
      .references(() => pedido.id, { onDelete: 'cascade' }),
    productoId: uuid().notNull(),
    nombreProducto: text().notNull(),
    precioUnitario: bigint({ mode: 'number' }).notNull(),
    cantidad: integer().notNull(),
    nota: text(),
    totalLinea: bigint({ mode: 'number' }).notNull(),
    orden: integer().notNull().default(0),
  },
  (t) => [
    index('pedido_item_pedido_idx').on(t.pedidoId),
    check('pedido_item_cantidad_check', sql`${t.cantidad} between 1 and 99`),
    check('pedido_item_nota_check', sql`${t.nota} is null or length(${t.nota}) <= 140`),
  ],
);

export const contadorDia = pgTable('contador_dia', {
  fechaOperativa: date({ mode: 'string' }).primaryKey(),
  ultimoNumero: integer().notNull().default(0),
});
