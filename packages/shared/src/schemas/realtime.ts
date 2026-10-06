import { z } from 'zod';
import { CANALES_REALTIME, type CanalRealtime, type Rol } from '../enums';

export { CANALES_REALTIME, type CanalRealtime };

/** Esquema de validación para un canal individual de tiempo real. */
export const canalRealtimeSchema = z.enum(CANALES_REALTIME);

/** Canales permitidos según rol (docs/API.md § Tiempo real — SSE). */
export const CANALES_POR_ROL: Record<Rol, readonly CanalRealtime[]> = {
  COCINA: ['cocina'],
  CAJERO: ['pos'],
  ADMIN: ['cocina', 'pos', 'admin'],
};

/** Eventos SSE definidos en docs/API.md */
export const EVENTOS_SSE = [
  'comanda.nueva',
  'comanda.estado',
  'comanda.anulada',
  'pedido.cobrado',
  'inventario.alerta',
  'catalogo.disponibilidad',
] as const;
export type EventoSse = (typeof EVENTOS_SSE)[number];
export const eventoSseSchema = z.enum(EVENTOS_SSE);

/**
 * Mapa de invalidación de queries de TanStack Query para el frontend (docs/API.md).
 */
export const MAPA_INVALIDACION_QUERIES: Record<EventoSse, readonly string[][]> = {
  'comanda.nueva': [['comandas'], ['pedidos']],
  'comanda.estado': [['comandas'], ['pedidos']],
  'comanda.anulada': [['comandas'], ['pedidos']],
  'pedido.cobrado': [['pedidos'], ['dashboard']],
  'inventario.alerta': [['alertas']],
  'catalogo.disponibilidad': [['menu']],
};

/** Estructura de mensaje transmitido por el hub de tiempo real. */
export interface MensajeRealtime<T = unknown> {
  tipo: string;
  id: number;
  datos: T;
  ts: string;
}

export const mensajeRealtimeSchema = z.object({
  tipo: z.string().min(1, 'El tipo de evento no puede estar vacío'),
  id: z.number().int().nonnegative('El id debe ser un entero no negativo'),
  datos: z.unknown(),
  ts: z.string().datetime({ message: 'El timestamp debe ser ISO 8601' }),
});

/**
 * Parsea el parámetro `canales` que puede venir como string separado por comas o array.
 */
export function parsearCanales(canalesRaw: unknown): CanalRealtime[] {
  if (typeof canalesRaw === 'string') {
    return canalesRaw
      .split(',')
      .map((c) => c.trim())
      .filter((c): c is CanalRealtime => (CANALES_REALTIME as readonly string[]).includes(c));
  }
  if (Array.isArray(canalesRaw)) {
    return canalesRaw
      .flatMap((c) => (typeof c === 'string' ? c.split(',') : []))
      .map((c) => c.trim())
      .filter((c): c is CanalRealtime => (CANALES_REALTIME as readonly string[]).includes(c));
  }
  return [];
}

/**
 * Valida si una lista de canales está permitida para el rol dado.
 */
export function validarCanalesParaRol(
  canales: readonly (string | CanalRealtime)[],
  rol: Rol,
): boolean {
  const permitidos = CANALES_POR_ROL[rol] ?? [];
  return canales.length > 0 && canales.every((c) => permitidos.includes(c as CanalRealtime));
}
