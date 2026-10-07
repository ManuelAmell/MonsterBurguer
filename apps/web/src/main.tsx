import '@fontsource-variable/inter';
import '@fontsource-variable/bricolage-grotesque';
import './styles/globals.css';

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { router } from './app/router';
import { ApiError } from './lib/api';

function manejar401Global(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    queryClient.clear();
    queryClient.setQueryData(['sesion'], null);
    const rutaActual = window.location.pathname + window.location.search;
    if (window.location.pathname !== '/login') {
      void router.navigate('/login', {
        replace: true,
        state: { desde: rutaActual },
      });
    }
  }
}

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      manejar401Global(error);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      manejar401Global(error);
    },
  }),
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('Falta el elemento #root');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors duration={4000} />
    </QueryClientProvider>
  </StrictMode>,
);
