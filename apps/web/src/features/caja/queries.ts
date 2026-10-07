import { queryOptions, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  sesionCajaSchema,
  type AbrirSesionCajaInput,
  type CobroInput,
  type CobroRespuesta,
  type MovimientoCaja,
  type MovimientoCajaInput,
  type ResumenCierre,
  type SesionCaja,
  type SesionCajaDetalle,
  type SesionesPaginadasRespuesta,
} from '@mb/shared';
import { z } from 'zod';
import { api } from '@/lib/api';

/**
 * Resumen en vivo de la sesión (docs/API.md: "con resumen"). El contrato no tipa estos campos:
 * todos son opcionales y la UI muestra solo los que el servidor informa.
 */
const resumenSesionSchema = z
  .object({
    ventasEfectivo: z.number().int(),
    ventasTarjeta: z.number().int(),
    ventasTransferencia: z.number().int(),
    ingresos: z.number().int(),
    retiros: z.number().int(),
    efectivoEsperado: z.number().int(),
  })
  .partial();
export type ResumenSesion = z.infer<typeof resumenSesionSchema>;

export interface SesionActual {
  sesion: SesionCaja;
  resumen: ResumenSesion | null;
}

/** Acepta `{ ...sesion, resumen }` o `{ sesion, resumen }`; `null` si no hay sesión abierta. */
function normalizarSesion(raw: unknown): SesionActual | null {
  if (raw === null || typeof raw !== 'object') return null;
  const registro = raw as Record<string, unknown>;
  const sesion = sesionCajaSchema.safeParse(registro.sesion ?? raw);
  if (!sesion.success) return null;
  const resumen = resumenSesionSchema.safeParse(registro.resumen ?? registro);
  return { sesion: sesion.data, resumen: resumen.success ? resumen.data : null };
}

export const sesionActualQuery = queryOptions({
  queryKey: ['caja', 'sesion-actual'],
  queryFn: async (): Promise<SesionActual | null> =>
    normalizarSesion(await api<unknown>('/caja/sesion-actual')),
});

export function useSesionActual() {
  return useQuery({ ...sesionActualQuery, refetchOnMount: 'always' });
}

export function useAbrirCaja() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ datos, clave }: { datos: AbrirSesionCajaInput; clave: string }) =>
      api<SesionCaja>('/caja/sesiones', {
        method: 'POST',
        body: datos,
        headers: { 'Idempotency-Key': clave },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['caja'] }),
  });
}

export function useCerrarCaja() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sesionId,
      efectivoContado,
      version,
      clave,
    }: {
      sesionId: string;
      efectivoContado: number;
      version: number;
      clave: string;
    }) =>
      api<ResumenCierre>(`/caja/sesiones/${sesionId}/cerrar`, {
        method: 'POST',
        body: { efectivoContado, version },
        headers: { 'Idempotency-Key': clave },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['caja'] }),
  });
}

/** El `Idempotency-Key` lo fija el diálogo: un reintento tras fallo de red reusa la misma clave. */
export function useCobrar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cuerpo, clave }: { cuerpo: CobroInput; clave: string }) =>
      api<CobroRespuesta>('/caja/cobros', {
        method: 'POST',
        body: cuerpo,
        headers: { 'Idempotency-Key': clave },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pedidos'] });
      void qc.invalidateQueries({ queryKey: ['caja'] });
    },
  });
}

/** Datos del recibo (GET /recibos/:id). Sin esquema en @mb/shared: todos los campos son opcionales. */
export interface ReciboDatos {
  id?: string;
  numero?: string;
  createdAt?: string;
  cajero?: string | null;
  cajeroNombre?: string | null;
  numeroDia?: number;
  pedidoNumeroDia?: number;
  tipo?: 'MESA' | 'LLEVAR';
  mesa?: string | { nombre: string } | null;
  mesaNombre?: string | null;
  items?: {
    nombre: string;
    cantidad: number;
    precioUnitario: number;
    totalLinea: number;
    nota?: string | null;
  }[];
  total?: number;
  base?: number;
  impuesto?: number;
  impuestoTasaBp?: number;
  regimenTributario?: string;
  propina?: number;
  pagos?: {
    metodo: string;
    monto: number;
    recibido?: number | null;
    cambio?: number | null;
    referencia?: string | null;
  }[];
  leyendas?: string[];
  negocio?: { nombre?: string; documento?: string | null; direccion?: string | null };
}

export function useRecibo(reciboId: string | null) {
  return useQuery({
    queryKey: ['recibos', reciboId],
    queryFn: () => api<ReciboDatos>(`/recibos/${reciboId}`),
    enabled: reciboId !== null,
    retry: 0,
  });
}

export function useMovimientos(sesionId?: string) {
  return useQuery({
    queryKey: ['caja', 'sesiones', sesionId, 'movimientos'],
    queryFn: () => api<MovimientoCaja[]>(`/caja/sesiones/${sesionId}/movimientos`),
    enabled: Boolean(sesionId),
  });
}

export function useRegistrarMovimiento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sesionId,
      datos,
      clave,
    }: {
      sesionId: string;
      datos: MovimientoCajaInput;
      clave?: string;
    }) =>
      api<MovimientoCaja>(`/caja/sesiones/${sesionId}/movimientos`, {
        method: 'POST',
        body: datos,
        headers: clave ? { 'Idempotency-Key': clave } : undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['caja'] });
    },
  });
}

export function useSesiones(filtros: { desde?: string; hasta?: string }) {
  return useInfiniteQuery({
    queryKey: ['caja', 'sesiones', 'historial', filtros],
    initialPageParam: '',
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20' });
      if (filtros.desde) params.set('desde', filtros.desde);
      if (filtros.hasta) params.set('hasta', filtros.hasta);
      if (pageParam) params.set('cursor', pageParam);
      return api<SesionesPaginadasRespuesta>(`/caja/sesiones?${params.toString()}`);
    },
    getNextPageParam: (ultima) => ultima.nextCursor ?? undefined,
  });
}

export function useSesionDetalle(sesionId: string | null) {
  return useQuery({
    queryKey: ['caja', 'sesiones', sesionId, 'detalle'],
    queryFn: () => api<SesionCajaDetalle>(`/caja/sesiones/${sesionId}`),
    enabled: Boolean(sesionId),
  });
}

