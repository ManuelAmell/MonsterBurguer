import { CircleSlash } from 'lucide-react';
import type { ComponentProps } from 'react';
import { formatearCOP } from '@mb/shared';
import { cn } from '@/lib/utils';

export interface ProductTileProps extends Omit<ComponentProps<'button'>, 'children'> {
  nombre: string;
  precio: number;
  agotado?: boolean;
  categoria?: string;
}

/**
 * ProductTile: Botón de producto táctil (DESIGN.md §4).
 * - Altura 96–120 px (objetivo táctil ≥ 96 px).
 * - Nombre (máx 2 líneas).
 * - Precio en cifras tabulares con formatearCOP.
 * - Estado Agotado: 50 % opaco, icono CircleSlash + texto "Agotado", no interactivo.
 * - Feedback táctil con active:scale-[0.97] (DESIGN.md §3.5).
 */
export function ProductTile({
  nombre,
  precio,
  agotado = false,
  categoria,
  className,
  disabled,
  onClick,
  ...props
}: ProductTileProps) {
  const isAgotado = agotado || disabled;

  return (
    <button
      type="button"
      disabled={isAgotado}
      aria-disabled={isAgotado}
      onClick={isAgotado ? undefined : onClick}
      className={cn(
        // Tamaño mínimo de 96 px y diseño de tarjeta
        'group relative flex min-h-[96px] h-28 w-full flex-col justify-between rounded-xl border bg-card p-3.5 text-left shadow-xs outline-none select-none',
        // Transiciones y estados interactivos
        'transition-[transform,border-color,background-color,box-shadow] duration-150 ease-out',
        // Foco visible
        'focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        // Comportamiento según si está agotado
        isAgotado
          ? 'cursor-not-allowed opacity-50 border-destructive/30'
          : 'cursor-pointer hover:border-primary/50 hover:bg-muted/30 active:scale-[0.97]',
        className,
      )}
      {...props}
    >
      {/* Cabecera con nombre y categoría opcional */}
      <div className="flex flex-col gap-0.5">
        {categoria && (
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {categoria}
          </span>
        )}
        <span
          className="line-clamp-2 text-sm font-semibold leading-snug text-card-foreground group-hover:text-primary transition-colors"
          title={nombre}
        >
          {nombre}
        </span>
      </div>

      {/* Pie con precio o indicador de agotado */}
      <div className="mt-auto flex items-center justify-between pt-1">
        {isAgotado ? (
          <div className="inline-flex items-center gap-1.5 rounded-md bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
            <CircleSlash className="size-3.5 shrink-0" aria-hidden="true" />
            <span>Agotado</span>
          </div>
        ) : (
          <span className="tabular text-base font-bold text-primary">
            {formatearCOP(precio)}
          </span>
        )}
      </div>
    </button>
  );
}
