import type { RouteObject } from 'react-router';
import { RequiereRol } from '@/features/auth/guards';
import { CocinaPage } from './cocina-page';

export const cocinaRoutes: RouteObject[] = [
  {
    path: 'cocina',
    element: (
      <RequiereRol roles={['ADMIN', 'COCINA']}>
        <CocinaPage />
      </RequiereRol>
    ),
  },
];
