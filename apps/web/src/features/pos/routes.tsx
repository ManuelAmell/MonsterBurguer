import type { RouteObject } from 'react-router';
import { RequiereRol } from '@/features/auth/guards';
import { PosPage } from './pos-page';

export const posRoutes: RouteObject[] = [
  {
    path: 'pos',
    element: (
      <RequiereRol roles={['ADMIN', 'CAJERO']}>
        <PosPage />
      </RequiereRol>
    ),
  },
];
