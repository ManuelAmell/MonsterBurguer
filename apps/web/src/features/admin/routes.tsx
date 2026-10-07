import { Outlet, type RouteObject } from 'react-router';
import { RequiereRol } from '@/features/auth/guards';
import { VitrinaPage } from '@/features/vitrina/vitrina-page';
import { CategoriasPage } from './categorias-page';
import { ConfiguracionPage } from './configuracion-page';
import { DashboardPage } from './dashboard-page';
import { InventarioPage } from './inventario-page';
import { ProductosPage } from './productos-page';
import { UsuariosPage } from './usuarios-page';

/** Rutas de administración (solo ADMIN, RN-51). Se monta dentro de AppShell. */
export const rutaAdmin: RouteObject = {
  path: 'admin',
  element: (
    <RequiereRol roles={['ADMIN']}>
      <Outlet />
    </RequiereRol>
  ),
  children: [
    { index: true, element: <DashboardPage /> },
    { path: 'productos', element: <ProductosPage /> },
    { path: 'categorias', element: <CategoriasPage /> },
    { path: 'inventario', element: <InventarioPage /> },
    { path: 'usuarios', element: <UsuariosPage /> },
    { path: 'configuracion', element: <ConfiguracionPage /> },
    ...(import.meta.env.DEV ? [{ path: 'vitrina', element: <VitrinaPage /> }] : []),
  ],
};
