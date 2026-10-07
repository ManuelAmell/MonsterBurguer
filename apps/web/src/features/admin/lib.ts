import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';
import type { Unidad } from '@mb/shared';
import { t } from '@/i18n/es';
import { ApiError } from '@/lib/api';

const ZONA = 'America/Bogota';

const fmtFechaHora = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const fmtHora = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const fmtNumero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** "06 oct 2026, 14:32" en hora de Colombia. */
export function formatearFechaHora(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : fmtFechaHora.format(d);
}

/** "14:32:05" en hora de Colombia. */
export function formatearSoloHora(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : fmtHora.format(d);
}

export function formatearNumero(n: number): string {
  return fmtNumero.format(n);
}

/** Cantidad en unidad base con separador es-CO: 1200, 'G' → "1.200 g". */
export function formatearCantidad(cantidad: number, unidad: Unidad | string): string {
  return `${fmtNumero.format(cantidad)} ${unidad.toLowerCase()}`;
}

/** Cantidad con signo explícito para el kardex: "+500 g" / "−120 g". */
export function formatearCantidadConSigno(cantidad: number, unidad: Unidad | string): string {
  const signo = cantidad > 0 ? '+' : cantidad < 0 ? '−' : '';
  return `${signo}${fmtNumero.format(Math.abs(cantidad))} ${unidad.toLowerCase()}`;
}

/** 580 s → "9:40". */
export function formatearDuracion(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = Math.round(segundos % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** "12" → "12:00". */
export function formatearHoraDelDia(hora: number): string {
  return `${String(hora).padStart(2, '0')}:00`;
}

interface DetalleCampo {
  campo: string;
  mensaje: string;
}

function esDetalleCampo(x: unknown): x is DetalleCampo {
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof (x as Record<string, unknown>).campo === 'string' &&
    typeof (x as Record<string, unknown>).mensaje === 'string'
  );
}

/**
 * Traduce un error de mutación: VALIDACION → error junto al campo (si existe en el formulario);
 * cualquier otro (409, red, etc.) → toast claro con el mensaje de la API.
 */
export function manejarErrorMutacion<T extends FieldValues>(
  error: unknown,
  setError?: UseFormSetError<T>,
  campos?: readonly string[],
): void {
  if (error instanceof ApiError && error.codigo === 'VALIDACION' && Array.isArray(error.detalles)) {
    let alguno = false;
    for (const d of error.detalles) {
      if (esDetalleCampo(d) && setError && (!campos || campos.includes(d.campo))) {
        setError(d.campo as Path<T>, { type: 'server', message: d.mensaje });
        alguno = true;
      }
    }
    if (alguno) return;
  }
  const mensaje = error instanceof ApiError ? error.message : t.errores.inesperado;
  toast.error(error instanceof ApiError && error.status === 409 ? t.admin.comun.conflicto : mensaje, {
    description: error instanceof ApiError && error.status === 409 ? mensaje : undefined,
  });
}

/** Convierte el texto de un input numérico entero en número (NaN → undefined). */
export function aEntero(valor: unknown): number | undefined {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : undefined;
  if (typeof valor !== 'string' || valor.trim() === '') return undefined;
  const n = Number(valor);
  return Number.isFinite(n) ? n : undefined;
}
