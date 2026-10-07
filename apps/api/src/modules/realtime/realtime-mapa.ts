import type { CanalRealtime, EventoSse } from '@mb/shared';

export interface ReglaMapeoEvento {
  /** Nombre del evento del dominio tal como se guarda en `evento_sistema.tipo`. */
  eventoOrigen: string;
  /** Nombre del evento SSE enviado al cliente (`event:`). */
  eventoSse: EventoSse | string;
  /** Canales por los que se difunde este evento. */
  canales: readonly CanalRealtime[];
  /** Transformación opcional de payload a datos SSE. Si no se especifica, se usa payload tal cual. */
  transformar?: (payload: unknown) => unknown;
}

/**
 * Tabla configurable de mapeo de eventos según docs/API.md § Tiempo real — SSE.
 */
export const MAPA_EVENTOS_SSE_DEFECTO: readonly ReglaMapeoEvento[] = [
  {
    eventoOrigen: 'PedidoConfirmado',
    eventoSse: 'comanda.nueva',
    canales: ['cocina', 'pos'],
  },
  {
    eventoOrigen: 'ComandaIniciada',
    eventoSse: 'comanda.estado',
    canales: ['cocina', 'pos'],
  },
  {
    eventoOrigen: 'ComandaLista',
    eventoSse: 'comanda.estado',
    canales: ['cocina', 'pos'],
  },
  {
    eventoOrigen: 'ComandaEntregada',
    eventoSse: 'comanda.estado',
    canales: ['cocina', 'pos'],
  },
  {
    eventoOrigen: 'PedidoAnulado',
    eventoSse: 'comanda.anulada',
    canales: ['cocina', 'pos'],
  },
  {
    eventoOrigen: 'PedidoCobrado',
    eventoSse: 'pedido.cobrado',
    canales: ['pos', 'admin'],
  },
  {
    eventoOrigen: 'StockBajoMinimo',
    eventoSse: 'inventario.alerta',
    canales: ['admin'],
  },
  {
    eventoOrigen: 'IngredienteAgotado',
    eventoSse: 'inventario.alerta',
    canales: ['admin'],
  },
  {
    eventoOrigen: 'IngredienteRepuesto',
    eventoSse: 'catalogo.disponibilidad',
    canales: ['pos', 'admin'],
  },
  {
    eventoOrigen: 'CatalogoDisponibilidadCambiado',
    eventoSse: 'catalogo.disponibilidad',
    canales: ['pos', 'admin'],
  },
  {
    eventoOrigen: 'SesionIniciada',
    eventoSse: 'sesion.iniciada',
    canales: ['admin'],
  },
  {
    eventoOrigen: 'SesionCerrada',
    eventoSse: 'sesion.cerrada',
    canales: ['admin'],
  },
  {
    eventoOrigen: 'PruebaRealtime',
    eventoSse: 'prueba.evento',
    canales: ['cocina', 'pos', 'admin'],
  },
];
