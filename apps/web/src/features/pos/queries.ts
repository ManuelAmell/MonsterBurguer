import { queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  pedidoSchema,
  type AgregarPedidoItemInput,
  type CrearPedidoInput,
  type EditarPedidoItemInput,
  type EstadoPedido,
  type MenuPos,
  type MesaConEstado,
  type Pedido,
} from '@mb/shared';
import { api } from '@/lib/api';
import { uuid } from '@/lib/uuid';

/** Claves de TanStack Query. Todo cuenta de `['pedidos']` para que SSE las invalide (docs/API.md). */
export const claves = {
  menu: ['menu'] as const,
  mesas: ['pedidos', 'mesas'] as const,
  activos: ['pedidos', 'activos'] as const,
  detalle: (id: string) => ['pedidos', 'detalle', id] as const,
};

export const menuQuery = queryOptions({
  queryKey: claves.menu,
  queryFn: () => api<MenuPos>('/catalogo/menu'),
  staleTime: 60_000,
});

export function useMenu() {
  return useQuery(menuQuery);
}

export function useMesas() {
  return useQuery({
    queryKey: claves.mesas,
    queryFn: () => api<MesaConEstado[]>('/mesas'),
  });
}

/** Listas del contrato: `{ items, nextCursor }` (convención) o arreglo plano; se aceptan ambas. */
function extraerLista(data: unknown): Pedido[] {
  if (Array.isArray(data)) return data as Pedido[];
  if (data !== null && typeof data === 'object' && 'items' in data && Array.isArray(data.items)) {
    return data.items as Pedido[];
  }
  return [];
}

const ESTADOS_ACTIVOS: readonly EstadoPedido[] = ['ABIERTO', 'CONFIRMADO'];

export function usePedidosActivos() {
  return useQuery({
    queryKey: claves.activos,
    queryFn: async () => {
      const listas = await Promise.all(
        ESTADOS_ACTIVOS.map((estado) => api<unknown>(`/pedidos?estado=${estado}`)),
      );
      return listas
        .flatMap(extraerLista)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
  });
}

export function usePedido(id: string | null) {
  return useQuery({
    queryKey: claves.detalle(id ?? 'ninguno'),
    queryFn: () => api<Pedido>(`/pedidos/${id}`),
    enabled: id !== null,
  });
}

/**
 * Cada mutación devuelve el pedido actualizado (se asume; docs/API.md no lo explicita).
 * Si la respuesta valida como `Pedido` se escribe en caché al instante; en todo caso se refresca.
 */
function aplicarRespuesta(qc: QueryClient, pedidoId: string, data: unknown): void {
  const pedido = pedidoSchema.safeParse(data);
  if (pedido.success) qc.setQueryData(claves.detalle(pedidoId), pedido.data);
  void qc.invalidateQueries({ queryKey: ['pedidos'] });
}

export function useCrearPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: CrearPedidoInput) => api<Pedido>('/pedidos', { method: 'POST', body: datos }),
    onSuccess: (pedido) => aplicarRespuesta(qc, pedido.id, pedido),
  });
}

export function useAgregarItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pedidoId, ...datos }: AgregarPedidoItemInput & { pedidoId: string }) =>
      api<unknown>(`/pedidos/${pedidoId}/items`, { method: 'POST', body: datos }),
    onSuccess: (data, { pedidoId }) => aplicarRespuesta(qc, pedidoId, data),
  });
}

export function useEditarItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      pedidoId,
      itemId,
      ...datos
    }: EditarPedidoItemInput & { pedidoId: string; itemId: string }) =>
      api<unknown>(`/pedidos/${pedidoId}/items/${itemId}`, { method: 'PATCH', body: datos }),
    onSuccess: (data, { pedidoId }) => aplicarRespuesta(qc, pedidoId, data),
  });
}

export function useQuitarItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pedidoId, itemId }: { pedidoId: string; itemId: string }) =>
      api<unknown>(`/pedidos/${pedidoId}/items/${itemId}`, { method: 'DELETE' }),
    onSuccess: (data, { pedidoId }) => aplicarRespuesta(qc, pedidoId, data),
  });
}

export function useConfirmarPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pedidoId, version }: { pedidoId: string; version: number }) =>
      api<unknown>(`/pedidos/${pedidoId}/confirmar`, {
        method: 'POST',
        body: { version },
        headers: { 'Idempotency-Key': uuid() },
      }),
    onSuccess: (data, { pedidoId }) => {
      aplicarRespuesta(qc, pedidoId, data);
      void qc.invalidateQueries({ queryKey: ['comandas'] });
    },
  });
}

export function useAnularPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pedidoId, motivo, version }: { pedidoId: string; motivo: string; version: number }) =>
      api<Pedido>(`/pedidos/${pedidoId}/anular`, {
        method: 'POST',
        body: { motivo, version },
      }),
    onSuccess: (data, { pedidoId }) => {
      aplicarRespuesta(qc, pedidoId, data);
      void qc.invalidateQueries({ queryKey: ['pedidos'] });
      void qc.invalidateQueries({ queryKey: ['comandas'] });
      void qc.invalidateQueries({ queryKey: claves.mesas });
      void qc.invalidateQueries({ queryKey: claves.activos });
    },
  });
}

/** Faltantes de un 409 STOCK_INSUFICIENTE (`detalles.faltantes`, docs/API.md § Formato de error). */
export interface FaltanteStock {
  ingredienteId?: string;
  nombre: string;
  requerido: number;
  disponible: number;
  unidad: string;
}

export function extraerFaltantes(detalles: unknown): FaltanteStock[] {
  if (detalles === null || typeof detalles !== 'object' || !('faltantes' in detalles)) return [];
  const { faltantes } = detalles;
  if (!Array.isArray(faltantes)) return [];
  return faltantes.filter(
    (f): f is FaltanteStock =>
      f !== null &&
      typeof f === 'object' &&
      typeof (f as FaltanteStock).nombre === 'string' &&
      typeof (f as FaltanteStock).requerido === 'number' &&
      typeof (f as FaltanteStock).disponible === 'number',
  );
}
