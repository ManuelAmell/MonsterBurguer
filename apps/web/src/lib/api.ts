import { apiErrorSchema } from '@mb/shared';
import { t } from '@/i18n/es';

/** Error de la API con el formato único `{ codigo, mensaje, detalles? }` (docs/API.md). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensaje: string,
    readonly detalles?: unknown,
  ) {
    super(mensaje);
    this.name = 'ApiError';
  }
}

interface Opciones {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

/** Cliente HTTP de la app: misma origen (proxy de Vite / nginx), cookie de sesión automática. */
export async function api<T>(ruta: string, { method = 'GET', body, signal }: Opciones = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${ruta}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'SIN_CONEXION', t.errores.sinConexion);
  }

  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = apiErrorSchema.safeParse(data);
    if (error.success) {
      throw new ApiError(res.status, error.data.codigo, error.data.mensaje, error.data.detalles);
    }
    throw new ApiError(res.status, 'ERROR_INESPERADO', t.errores.inesperado);
  }
  return data as T;
}
