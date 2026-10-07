import { AlertCircle, RefreshCw, type LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { t } from '@/i18n/es';
import { cn } from '@/lib/utils';

/** Etiqueta visible + control + ayuda + error con role="alert" (DESIGN.md §8). */
export function Campo({
  id,
  etiqueta,
  ayuda,
  error,
  children,
  className,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      {ayuda && !error && (
        <p id={`${id}-ayuda`} className="text-sm text-muted-foreground">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Atributos aria de un control según tenga ayuda o error. */
export function ariaCampo(id: string, error?: string, ayuda?: string) {
  return {
    id,
    'aria-invalid': error ? (true as const) : undefined,
    'aria-describedby': error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined,
  };
}

const claseControl =
  'flex w-full min-w-0 rounded-md border border-input bg-card px-4 text-base text-foreground outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20';

/** `<select>` nativo (accesible por teclado y táctil), con el estilo de Input. */
export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select className={cn(claseControl, 'h-12', className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(claseControl, 'min-h-24 py-3', className)} {...props} />;
}

/** Casilla con etiqueta visible y área táctil ≥ 48 px. */
export function CasillaCampo({
  id,
  etiqueta,
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type'> & { id: string; etiqueta: string }) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-1 text-base font-medium select-none',
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="size-6 shrink-0 cursor-pointer rounded-sm border border-input accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        {...props}
      />
      {etiqueta}
    </label>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-muted motion-reduce:animate-none', className)}
    />
  );
}

/** Cabecera de página: título (h1), descripción y acciones. */
export function CabeceraPagina({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight lg:text-3xl">{titulo}</h1>
        {descripcion && <p className="text-muted-foreground">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-3">{acciones}</div>}
    </header>
  );
}

/** Contenedor de página del panel de administración (1280–1440 px objetivo). */
export function PaginaAdmin({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-7xl space-y-6 p-4 lg:p-8">{children}</div>;
}

/** Skeleton de tabla mientras carga (role=status para lectores de pantalla). */
export function TablaSkeleton({ filas = 6 }: { filas?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3 rounded-lg border bg-card p-4">
      <span className="sr-only">{t.admin.comun.cargando}</span>
      {Array.from({ length: filas }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

/** Estado de error con acción de reintento (role=alert, icono + texto). */
export function EstadoError({
  titulo = t.admin.comun.errorCarga,
  descripcion = t.admin.comun.errorCargaDescripcion,
  icon = AlertCircle,
  onReintentar,
  reintentando,
}: {
  titulo?: string;
  descripcion?: string;
  icon?: LucideIcon;
  onReintentar: () => void;
  reintentando?: boolean;
}) {
  return (
    <div role="alert">
      <EmptyState
        icon={icon}
        titulo={titulo}
        descripcion={descripcion}
        accion={
          <Button variant="outline" onClick={onReintentar} disabled={reintentando}>
            <RefreshCw aria-hidden="true" className={reintentando ? 'animate-spin' : undefined} />
            {t.admin.comun.reintentar}
          </Button>
        }
      />
    </div>
  );
}
