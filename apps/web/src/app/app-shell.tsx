import { Boxes, ChefHat, LayoutDashboard, Package, LogOut, ShoppingCart, Wallet, type LucideIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import type { Rol } from '@mb/shared';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { useLogout, useSesion } from '@/features/auth/session';
import { t } from '@/i18n/es';
import { cn } from '@/lib/utils';

interface ItemNav {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: Rol[];
  end?: boolean;
}

// Matriz de permisos RN-51: cada rol solo ve lo que puede usar.
export const NAV: ItemNav[] = [
  { to: '/pos', label: t.nav.pos, icon: ShoppingCart, roles: ['ADMIN', 'CAJERO'] },
  { to: '/caja', label: t.nav.caja, icon: Wallet, roles: ['ADMIN', 'CAJERO'] },
  { to: '/cocina', label: t.nav.cocina, icon: ChefHat, roles: ['ADMIN', 'COCINA'] },
  { to: '/admin', label: t.admin.nav.dashboard, icon: LayoutDashboard, roles: ['ADMIN'], end: true },
  { to: '/admin/productos', label: t.admin.nav.productos, icon: Package, roles: ['ADMIN'] },
  { to: '/admin/inventario', label: t.admin.nav.inventario, icon: Boxes, roles: ['ADMIN'] },
];

/** Layout con barra lateral (≥ 1024 px) o barra superior (< 1024 px). DESIGN.md §6. */
export function AppShell() {
  const { data: usuario } = useSesion();
  const logout = useLogout();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Tras cambiar de ruta, el foco va al contenido principal (lectores de pantalla).
  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  if (!usuario) return null;
  const items = NAV.filter((i) => i.roles.includes(usuario.rol));

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <a
        href="#contenido"
        className="sr-only z-100 rounded-md bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t.app.saltarAlContenido}
      </a>

      <aside className="sticky top-0 z-10 flex shrink-0 flex-col border-b bg-card lg:h-dvh lg:w-60 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-4 p-4 lg:p-5">
          <Logo />
        </div>
        <nav aria-label={t.nav.principal} className="flex-1 overflow-x-auto px-3 pb-3 lg:overflow-visible">
          <ul className="flex gap-2 lg:flex-col">
            {items.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'flex h-12 items-center gap-3 rounded-md px-4 font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-muted',
                    )
                  }
                >
                  <Icon aria-hidden="true" className="size-5" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="hidden border-t p-4 lg:block">
          <p className="truncate font-semibold">{usuario.nombre}</p>
          <p className="mb-3 text-sm text-muted-foreground">{t.roles[usuario.rol]}</p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            <LogOut aria-hidden="true" />
            {t.nav.cerrarSesion}
          </Button>
        </div>
      </aside>

      <main id="contenido" ref={mainRef} tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
        <div className="border-t p-4 lg:hidden">
          <Button variant="outline" onClick={() => logout.mutate()} disabled={logout.isPending}>
            <LogOut aria-hidden="true" />
            {t.nav.cerrarSesion} ({usuario.nombre})
          </Button>
        </div>
      </main>
    </div>
  );
}
