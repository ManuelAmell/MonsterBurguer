import type { RouteObject } from 'react-router';
import { RequiereRol } from '@/features/auth/guards';
import { CajaPage } from './caja-page';

export const cajaRoutes: RouteObject[] = [
  {
    path: 'caja',
    element: (
      <RequiereRol roles={['ADMIN', 'CAJERO']}>
        <CajaPage />
      </RequiereRol>
    ),
  },
];
