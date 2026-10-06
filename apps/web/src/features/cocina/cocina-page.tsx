import { ChefHat, LogOut } from 'lucide-react';
import { useEffect } from 'react';
import { Logo } from '@/components/brand/logo';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { useLogout, useSesion } from '@/features/auth/session';
import { t } from '@/i18n/es';

/** KDS: pantalla completa en tema oscuro (DESIGN.md §7.4). Comandas en vivo llegan en el Hito 3. */
export function CocinaPage() {
  const { data: usuario } = useSesion();
  const logout = useLogout();

  useEffect(() => {
    document.documentElement.classList.add('dark');
    return () => document.documentElement.classList.remove('dark');
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 border-b px-6 py-4">
        <Logo />
        <div className="flex items-center gap-4">
          <span className="hidden text-muted-foreground sm:inline">{usuario?.nombre}</span>
          <Button variant="outline" onClick={() => logout.mutate()} disabled={logout.isPending}>
            <LogOut aria-hidden="true" />
            {t.nav.cerrarSesion}
          </Button>
        </div>
      </header>
      <main id="contenido" className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={ChefHat}
          titulo={t.cocina.sinComandas}
          descripcion={t.cocina.sinComandasDescripcion}
          className="w-full max-w-xl"
        />
      </main>
    </div>
  );
}
