import { Minus, Plus, StickyNote, Trash2 } from 'lucide-react';
import type { ComponentProps } from 'react';
import { formatearCOP } from '@mb/shared';
import { t } from '@/i18n/es';
import { cn } from '@/lib/utils';

export interface TicketLineProps extends Omit<ComponentProps<'div'>, 'children'> {
  id: string;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  nota?: string;
  onIncrementar: () => void;
  onDecrementar: () => void;
  onEliminar: () => void;
  onEditarNota?: () => void;
}

/**
 * TicketLine: Fila de ítem en el ticket de venta (DESIGN.md §4).
 * - Nombre, nota visible y total de línea en cifras tabulares con formatearCOP.
 * - Stepper `− cantidad +` con botones de 44 px (DESIGN.md §4).
 * - Botón papelera visible (deslizar nunca es la única forma de borrar).
 * - Botón para agregar o editar nota.
 */
export function TicketLine({
  id,
  nombre,
  precioUnitario,
  cantidad,
  nota,
  onIncrementar,
  onDecrementar,
  onEliminar,
  onEditarNota,
  className,
  ...props
}: TicketLineProps) {
  const total = precioUnitario * cantidad;

  return (
    <div
      data-line-id={id}
      className={cn(
        'group flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-2xs transition-colors hover:border-primary/30',
        className,
      )}
      {...props}
    >
      {/* Fila superior: Nombre, precio unitario y total */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-bold text-foreground leading-snug">{nombre}</span>
          <span className="tabular text-xs text-muted-foreground">
            {t.pos.ticketPrecioUnitario(formatearCOP(precioUnitario))}
          </span>
        </div>
        <span className="tabular text-base font-bold text-foreground">
          {formatearCOP(total)}
        </span>
      </div>

      {/* Nota opcional visible */}
      {nota && (
        <div className="flex items-center gap-1.5 rounded-md bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent-foreground">
          <StickyNote className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
          <span className="italic">{nota}</span>
        </div>
      )}

      {/* Fila inferior: Stepper (botones 44 px), botón nota y botón papelera */}
      <div className="flex items-center justify-between pt-1">
        {/* Stepper de cantidad */}
        <div className="inline-flex items-center rounded-lg border bg-secondary/50 p-0.5">
          <button
            type="button"
            aria-label={t.pos.ticketDisminuir(nombre)}
            disabled={cantidad <= 1}
            onClick={onDecrementar}
            className="flex size-11 items-center justify-center rounded-md text-foreground transition-[color,transform] hover:bg-card hover:text-primary active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>

          <span
            aria-live="polite"
            className="tabular flex min-w-9 items-center justify-center text-sm font-bold text-foreground"
          >
            {cantidad}
          </span>

          <button
            type="button"
            aria-label={t.pos.ticketAumentar(nombre)}
            onClick={onIncrementar}
            className="flex size-11 items-center justify-center rounded-md text-foreground transition-[color,transform] hover:bg-card hover:text-primary active:scale-[0.97] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* Acciones: Editar nota y eliminar */}
        <div className="flex items-center gap-1.5">
          {onEditarNota && (
            <button
              type="button"
              aria-label={nota ? t.pos.ticketAriaEditar(nombre) : t.pos.ticketAriaAgregar(nombre)}
              onClick={onEditarNota}
              className={cn(
                'flex h-11 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-[color,background-color,transform] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring',
                nota
                  ? 'bg-accent/15 text-accent-foreground hover:bg-accent/25'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <StickyNote className="size-4" aria-hidden="true" />
              <span>{nota ? t.pos.ticketEditarNota : t.pos.ticketNota}</span>
            </button>
          )}

          <button
            type="button"
            aria-label={t.pos.ticketEliminar(nombre)}
            onClick={onEliminar}
            className="flex size-11 items-center justify-center rounded-lg text-destructive transition-[color,background-color,transform] hover:bg-destructive/15 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
