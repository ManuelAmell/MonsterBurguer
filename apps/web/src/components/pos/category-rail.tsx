import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

export interface CategoriaItem {
  id: string;
  nombre: string;
  icono?: LucideIcon;
  conteo?: number;
}

export interface CategoryRailProps extends Omit<ComponentProps<'nav'>, 'children'> {
  categorias: readonly CategoriaItem[];
  categoriaSeleccionada: string;
  onSeleccionar: (id: string) => void;
}

/**
 * CategoryRail: Rail vertical de navegación de categorías (DESIGN.md §4 y §7.2).
 * - Ancho aproximado de 180 px.
 * - Categoría activa resaltada con fondo primary + texto primary-foreground.
 * - Objetivos táctiles ≥ 48 px por botón (h-12 / min-h-[48px]).
 * - Navegación accesible por teclado (flechas arriba/abajo, Enter, Espacio).
 */
export function CategoryRail({
  categorias,
  categoriaSeleccionada,
  onSeleccionar,
  className,
  ...props
}: CategoryRailProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex = -1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % categorias.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + categorias.length) % categorias.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = categorias.length - 1;
    }

    if (nextIndex >= 0) {
      const nextCategory = categorias[nextIndex];
      if (nextCategory) {
        onSeleccionar(nextCategory.id);
        const nextButton = document.getElementById(`cat-rail-${nextCategory.id}`);
        nextButton?.focus();
      }
    }
  };

  return (
    <nav
      aria-label="Categorías de productos"
      className={cn(
        'flex w-44 shrink-0 flex-col gap-1.5 overflow-y-auto rounded-xl border bg-card p-2 shadow-xs select-none',
        className,
      )}
      {...props}
    >
      <div
        role="tablist"
        aria-orientation="vertical"
        className="flex flex-col gap-1.5"
      >
        {categorias.map((categoria, index) => {
          const isSelected = categoria.id === categoriaSeleccionada;
          const Icon = categoria.icono;

          return (
            <button
              key={categoria.id}
              id={`cat-rail-${categoria.id}`}
              role="tab"
              type="button"
              tabIndex={isSelected ? 0 : -1}
              aria-selected={isSelected}
              onClick={() => onSeleccionar(categoria.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={cn(
                // Dimensiones y táctil ≥ 48 px
                'group flex min-h-[48px] h-12 w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left font-medium outline-none transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.97]',
                // Foco visible
                'focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                // Selección activa
                isSelected
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                {Icon && (
                  <Icon
                    className={cn(
                      'size-5 shrink-0 transition-colors',
                      isSelected ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground',
                    )}
                    aria-hidden="true"
                  />
                )}
                <span className="truncate text-sm font-semibold">{categoria.nombre}</span>
              </div>

              {categoria.conteo !== undefined && (
                <span
                  className={cn(
                    'tabular ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
                    isSelected
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {categoria.conteo}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
