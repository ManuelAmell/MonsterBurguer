import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Parámetros del negocio editables desde Admin (docs/DATA_MODEL.md "configuracion"). */
export const configuracion = pgTable('configuracion', {
  clave: text().primaryKey(),
  valor: jsonb().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid(),
});

/** Valores iniciales (seed). Régimen actual: no responsable de INC (RN-03). */
export const CONFIGURACION_INICIAL: Record<string, unknown> = {
  regimen_tributario: 'NO_RESPONSABLE',
  propina_sugerida_bp: 1000,
  hora_corte_dia: '05:00',
  permitir_stock_negativo: false,
  kds_umbral_warning_min: 8,
  kds_umbral_grave_min: 12,
  negocio: {
    razonSocial: 'MonsterBurguer',
    documento: '',
    direccion: '',
    telefono: '',
  },
};
