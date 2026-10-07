import { eq } from 'drizzle-orm';
import { TASA_IMPUESTO_BP, REGIMENES_TRIBUTARIOS, type RegimenTributario } from '@mb/shared';
import type { Executor } from '../db/db';
import { configuracion } from './configuracion.schema';

/** Lee un valor de `configuracion`; devuelve `undefined` si la clave no existe. */
export async function leerConfiguracion(executor: Executor, clave: string): Promise<unknown> {
  const [fila] = await executor
    .select({ valor: configuracion.valor })
    .from(configuracion)
    .where(eq(configuracion.clave, clave))
    .limit(1);
  return fila?.valor;
}

export async function leerRegimen(executor: Executor): Promise<RegimenTributario> {
  const valor = await leerConfiguracion(executor, 'regimen_tributario');
  return REGIMENES_TRIBUTARIOS.find((r) => r === valor) ?? 'NO_RESPONSABLE';
}

/** Tasa de impuesto vigente en puntos básicos según el régimen configurado (RN-03). */
export async function leerTasaImpuestoBp(executor: Executor): Promise<number> {
  return TASA_IMPUESTO_BP[await leerRegimen(executor)];
}

/** Hora de corte de la fecha operativa (RN-16), "05:00" por defecto. */
export async function leerHoraCorte(executor: Executor): Promise<string> {
  const valor = await leerConfiguracion(executor, 'hora_corte_dia');
  return typeof valor === 'string' && /^\d{1,2}:\d{2}$/.test(valor) ? valor : '05:00';
}

/** Guarda o actualiza un parámetro en la tabla `configuracion`. */
export async function guardarConfiguracion(
  executor: Executor,
  clave: string,
  valor: unknown,
  usuarioId?: string,
): Promise<void> {
  await executor
    .insert(configuracion)
    .values({
      clave,
      valor,
      updatedAt: new Date(),
      updatedBy: usuarioId ?? null,
    })
    .onConflictDoUpdate({
      target: configuracion.clave,
      set: {
        valor,
        updatedAt: new Date(),
        updatedBy: usuarioId ?? null,
      },
    });
}
