import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, Rol, UsuarioSesion } from '@mb/shared';
import { api, ApiError } from '@/lib/api';

export const RUTA_INICIO_POR_ROL: Record<Rol, string> = {
  ADMIN: '/admin',
  CAJERO: '/pos',
  COCINA: '/cocina',
};

const sesionQuery = queryOptions({
  queryKey: ['sesion'],
  queryFn: async (): Promise<UsuarioSesion | null> => {
    try {
      return (await api<{ usuario: UsuarioSesion }>('/auth/me')).usuario;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    }
  },
  staleTime: 5 * 60_000,
  retry: false,
});

/** Usuario autenticado (null si no hay sesión). */
export function useSesion() {
  return useQuery(sesionQuery);
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: LoginInput) =>
      api<{ usuario: UsuarioSesion }>('/auth/login', { method: 'POST', body: datos }),
    onSuccess: ({ usuario }) => qc.setQueryData(sesionQuery.queryKey, usuario),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      qc.clear();
      qc.setQueryData(sesionQuery.queryKey, null);
    },
  });
}
