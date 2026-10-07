import { SearchX, ShoppingCart, Wallet } from 'lucide-react';
import { createBrowserRouter, Link } from 'react-router';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { rutaAdmin } from '@/features/admin/routes';
import { RedirigirPorRol, RequiereRol, RequiereSesion } from '@/features/auth/guards';
import { LoginPage } from '@/features/auth/login-page';
import { CocinaPage } from '@/features/cocina/cocina-page';
import { t } from '@/i18n/es';
import { AppShell } from './app-shell';
import { PantallaPendiente } from './pantalla-pendiente';

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
      {
        path: 'cocina',
        element: (
          <RequiereRol roles={['ADMIN', 'COCINA']}>
            <CocinaPage />
          </RequiereRol>
        ),
      },
      {
        element: <AppShell />,
        children: [
          {
            path: 'pos',
            element: (
              <RequiereRol roles={['ADMIN', 'CAJERO']}>
                <PantallaPendiente titulo={t.nav.pos} icon={ShoppingCart} hito={2} />
              </RequiereRol>
            ),
          },
          {
            path: 'caja',
            element: (
              <RequiereRol roles={['ADMIN', 'CAJERO']}>
                <PantallaPendiente titulo={t.nav.caja} icon={Wallet} hito={4} />
              </RequiereRol>
            ),
          },
          rutaAdmin,
        ],
      },
    ],
  },
  { path: '*', element: <NoEncontrado /> },
]);
