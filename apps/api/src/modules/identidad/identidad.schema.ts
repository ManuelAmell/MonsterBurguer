import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { ROLES } from '@mb/shared';

export const usuario = pgTable(
  'usuario',
  {
    id: uuid().primaryKey(),
    nombre: text().notNull(),
    /** Siempre en minúsculas (se normaliza en la app y lo garantiza el CHECK). */
    username: text().notNull().unique(),
    passwordHash: text().notNull(),
    rol: text({ enum: ROLES }).notNull(),
    activo: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('usuario_rol_check', sql`${t.rol} in ('ADMIN', 'CAJERO', 'COCINA')`),
    check('usuario_username_minusculas_check', sql`${t.username} = lower(${t.username})`),
  ],
);

export const sesionUsuario = pgTable(
  'sesion_usuario',
  {
    id: uuid().primaryKey(),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id, { onDelete: 'cascade' }),
    /** SHA-256 (hex) del token de la cookie; el token en claro nunca se guarda. */
    tokenHash: text().notNull().unique(),
    expiraAt: timestamp({ withTimezone: true }).notNull(),
    ultimoUsoAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    userAgent: text(),
    ip: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('sesion_usuario_usuario_idx').on(t.usuarioId),
    index('sesion_usuario_expira_idx').on(t.expiraAt),
  ],
);
