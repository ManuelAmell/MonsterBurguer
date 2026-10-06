import { Loader2, ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router';
import type { Rol } from '@mb/shared';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n/es';
import { RUTA_INICIO_POR_ROL, useSesion } from './session';

function PantallaCargando() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-live="polite">
      <Loader2 aria-hidden="true" className="size-8 animate-spin text-primary" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

/** Rutas privadas: sin sesión redirige al login recordando a dónde se quería ir. */
export function RequiereSesion() {
  const { data: usuario, isPending } = useSesion();
  const location = useLocation();
  if (isPending) return <PantallaCargando />;
  if (!usuario) return <Navigate to="/login" replace state={{ desde: location.pathname }} />;
  return <Outlet />;
}

/** Restringe una pantalla a ciertos roles y explica por qué si no hay acceso. */
export function RequiereRol({ roles, children }: { roles: Rol[]; children: ReactNode }) {
  const { data: usuario } = useSesion();
  if (!usuario) return null;
  if (!roles.includes(usuario.rol)) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <EmptyState
          icon={ShieldAlert}
          titulo={t.errores.sinPermiso}
          descripcion={`${t.roles[usuario.rol]}: ${t.errores.sinPermiso}`}
          accion={
            <Button asChild variant="outline">
              <Link to={RUTA_INICIO_POR_ROL[usuario.rol]}>{t.errores.volverAlInicio}</Link>
            </Button>
          }
        />
      </main>
    );
  }
  return children;
}

/** "/" lleva a la pantalla principal del rol (DESIGN.md §6). */
export function RedirigirPorRol() {
  const { data: usuario } = useSesion();
  if (!usuario) return <Navigate to="/login" replace />;
  return <Navigate to={RUTA_INICIO_POR_ROL[usuario.rol]} replace />;
}
