import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  MAPA_INVALIDACION_QUERIES,
  type CanalRealtime,
  type EventoSse,
} from '@mb/shared';

export type EstadoConexionSse = 'conectando' | 'conectado' | 'reconectando' | 'desconectado';

export interface UseEventStreamOpciones {
  habilitado?: boolean;
  onEvento?: (tipo: string, datos: unknown) => void;
}

export interface UseEventStreamResultado {
  estado: EstadoConexionSse;
  conectado: boolean;
  reconectando: boolean;
  error: Event | null;
}

/**
 * Hook para conectarse al flujo SSE del backend (`/api/v1/stream?canales=...`).
 * - Invalida queries de TanStack Query según el mapa de docs/API.md.
 * - Expone el estado de conexión (`conectado`, `reconectando`).
 * - Se limpia al desmontar cerrando limpio el EventSource.
 */
export function useEventStream(
  canales: CanalRealtime | readonly CanalRealtime[] | string | string[],
  opciones?: UseEventStreamOpciones,
): UseEventStreamResultado {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<EstadoConexionSse>('desconectado');
  const [error, setError] = useState<Event | null>(null);

  const habilitado = opciones?.habilitado ?? true;
  const onEvento = opciones?.onEvento;
  const onEventoRef = useRef(onEvento);

  useEffect(() => {
    onEventoRef.current = onEvento;
  }, [onEvento]);

  // Normalizar canales para evitar re-ejecuciones innecesarias de useEffect
  const canalesTokens = (
    Array.isArray(canales)
      ? canales.flatMap((c) => (typeof c === 'string' ? c.split(',') : []))
      : typeof canales === 'string'
        ? canales.split(',')
        : []
  )
    .map((c) => c.trim())
    .filter(Boolean)
    .sort();

  const canalesKey = canalesTokens.join(',');

  useEffect(() => {
    if (!habilitado || !canalesKey) {
      return;
    }

    const timerConexion = setTimeout(() => {
      setEstado('conectando');
      setError(null);
    }, 0);

    const url = `/api/v1/stream?canales=${encodeURIComponent(canalesKey)}`;
    const es = new EventSource(url, { withCredentials: true });

    es.onopen = () => {
      setEstado('conectado');
      setError(null);
    };

    es.onerror = (evt) => {
      setError(evt);
      if (es.readyState === EventSource.CONNECTING) {
        setEstado('reconectando');
      } else {
        setEstado('desconectado');
      }
    };

    const eventosMapeados = Object.keys(MAPA_INVALIDACION_QUERIES) as EventoSse[];
    const listeners: Array<{ tipo: string; handler: (e: MessageEvent) => void }> = [];

    for (const tipo of eventosMapeados) {
      const handler = (e: MessageEvent) => {
        let datos: unknown;
        try {
          datos = JSON.parse(e.data);
        } catch {
          datos = e.data;
        }

        // Invalidar queries de TanStack correspondientes
        const queryKeys = MAPA_INVALIDACION_QUERIES[tipo];
        if (queryKeys) {
          for (const key of queryKeys) {
            void queryClient.invalidateQueries({ queryKey: key });
          }
        }

        // Acciones secundarias en el front según docs/API.md
        if (tipo === 'comanda.estado') {
          const payload = datos as { estado?: string; numeroDia?: number } | null;
          if (payload?.estado === 'LISTA') {
            toast.info(payload.numeroDia ? `Pedido #${payload.numeroDia} listo` : 'Pedido listo');
          }
        } else if (tipo === 'inventario.alerta') {
          const payload = datos as { mensaje?: string } | null;
          toast.warning(payload?.mensaje ?? 'Alerta de inventario');
        }

        onEventoRef.current?.(tipo, datos);
      };

      es.addEventListener(tipo, handler);
      listeners.push({ tipo, handler });
    }

    return () => {
      clearTimeout(timerConexion);
      for (const { tipo, handler } of listeners) {
        es.removeEventListener(tipo, handler);
      }
      es.close();
      setEstado('desconectado');
    };
  }, [canalesKey, habilitado, queryClient]);

  const estadoEfectivo: EstadoConexionSse =
    !habilitado || !canalesKey ? 'desconectado' : estado;

  return {
    estado: estadoEfectivo,
    conectado: estadoEfectivo === 'conectado',
    reconectando: estadoEfectivo === 'reconectando',
    error,
  };
}
