import { SearchX } from 'lucide-react';
import { createBrowserRouter, Link } from 'react-router';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { rutaAdmin } from '@/features/admin/routes';
import { RedirigirPorRol, RequiereSesion } from '@/features/auth/guards';
import { LoginPage } from '@/features/auth/login-page';
import { cajaRoutes } from '@/features/caja/routes';
import { cocinaRoutes } from '@/features/cocina/routes';
import { posRoutes } from '@/features/pos/routes';
import { t } from '@/i18n/es';
import { AppShell } from './app-shell';

function NoEncontrado() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl items-center p-6">
      <EmptyState
        icon={SearchX}
        titulo={t.errores.noEncontrado}
        descripcion=""
        className="w-full"
        accion={
          <Button asChild variant="outline">
            <Link to="/">{t.errores.volverAlInicio}</Link>
          </Button>
        }
      />
    </main>
  );
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequiereSesion />,
    children: [
      { index: true, element: <RedirigirPorRol /> },
      ...cocinaRoutes,
      {
        element: <AppShell />,
        children: [
          ...posRoutes,
          ...cajaRoutes,
          rutaAdmin,
        ],
      },
    ],
  },
  { path: '*', element: <NoEncontrado /> },
]);
