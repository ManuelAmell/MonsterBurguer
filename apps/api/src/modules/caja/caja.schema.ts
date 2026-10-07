import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { ESTADOS_SESION_CAJA, METODOS_PAGO, REGIMENES_TRIBUTARIOS } from '@mb/shared';

export const reciboNumeroSeq = pgSequence('recibo_numero_seq', { startWith: 1, increment: 1 });

/** `usuario_id` apunta a identidad: la FK se agrega a mano en la migración. */
export const sesionCaja = pgTable(
  'sesion_caja',
  {
    id: uuid().primaryKey(),
    usuarioId: uuid().notNull(),
    estado: text({ enum: ESTADOS_SESION_CAJA }).notNull().default('ABIERTA'),
    montoApertura: bigint({ mode: 'number' }).notNull(),
    efectivoEsperado: bigint({ mode: 'number' }),
    efectivoContado: bigint({ mode: 'number' }),
    diferencia: bigint({ mode: 'number' }),
    abiertaAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    cerradaAt: timestamp({ withTimezone: true }),
    version: integer().notNull().default(0),
  },
  (t) => [
    // RN-40: una sola sesión abierta por cajero.
    uniqueIndex('sesion_caja_abierta_usuario_uq')
      .on(t.usuarioId)
      .where(sql`${t.estado} = 'ABIERTA'`),
    check('sesion_caja_estado_check', sql`${t.estado} in ('ABIERTA', 'CERRADA')`),
    check('sesion_caja_monto_apertura_check', sql`${t.montoApertura} >= 0`),
  ],
);

/** `pedido_id` apunta a pedidos y `usuario_id` a identidad: FKs a mano en la migración. */
export const recibo = pgTable(
  'recibo',
  {
    id: uuid().primaryKey(),
    numero: bigint({ mode: 'number' })
      .notNull()
      .unique()
      .default(sql`nextval('recibo_numero_seq')`),
    pedidoId: uuid().notNull().unique(),
    sesionCajaId: uuid()
      .notNull()
      .references(() => sesionCaja.id, { onDelete: 'restrict' }),
    usuarioId: uuid().notNull(),
    total: bigint({ mode: 'number' }).notNull(),
    base: bigint({ mode: 'number' }).notNull(),
    impuesto: bigint({ mode: 'number' }).notNull(),
    impuestoTasaBp: integer().notNull().default(0),
    regimenTributario: text({ enum: REGIMENES_TRIBUTARIOS }).notNull(),
    propina: bigint({ mode: 'number' }).notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('recibo_sesion_idx').on(t.sesionCajaId)],
);

export const pago = pgTable(
  'pago',
  {
    id: uuid().primaryKey(),
    reciboId: uuid()
      .notNull()
      .references(() => recibo.id, { onDelete: 'cascade' }),
    metodo: text({ enum: METODOS_PAGO }).notNull(),
    monto: bigint({ mode: 'number' }).notNull(),
    recibido: bigint({ mode: 'number' }),
    cambio: bigint({ mode: 'number' }),
    referencia: text(),
  },
  (t) => [
    // RN-43: un solo pago en efectivo por cobro.
    uniqueIndex('pago_efectivo_por_recibo_uq')
      .on(t.reciboId)
      .where(sql`${t.metodo} = 'EFECTIVO'`),
    check('pago_metodo_check', sql`${t.metodo} in ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA')`),
    check('pago_monto_check', sql`${t.monto} > 0`),
    check('pago_recibido_check', sql`${t.recibido} is null or ${t.recibido} >= ${t.monto}`),
  ],
);
