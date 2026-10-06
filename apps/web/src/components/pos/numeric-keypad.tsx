import { Delete, RotateCcw } from 'lucide-react';
import type { ComponentProps } from 'react';
import { formatearCOP } from '@mb/shared';
import { cn } from '@/lib/utils';

export interface NumericKeypadProps extends Omit<ComponentProps<'div'>, 'children'> {
  onDigito: (digito: string) => void;
  onBorrar: () => void;
  onLimpiar?: () => void;
  onAtajoMonto?: (monto: number) => void;
  onExacto?: () => void;
  totalExacto?: number;
}

const BILLETES_ATAJO = [20_000, 50_000, 100_000] as const;

/**
 * NumericKeypad: Teclado numérico táctil para cobro y caja (DESIGN.md §4 y §7.3).
 * - Matriz 3×4 de botones de 64 px (h-16).
 * - Atajos de billetes colombianos: $20.000, $50.000, $100.000 y Exacto.
 * - Tecla de retroceso con icono Delete y tecla de limpiar opcional.
 * - Feedback táctil con active:scale-[0.97] y foco accesible.
 */
export function NumericKeypad({
  onDigito,
  onBorrar,
  onLimpiar,
  onAtajoMonto,
  onExacto,
  totalExacto,
  className,
  ...props
}: NumericKeypadProps) {
  const filasDigitos = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
  ];

  return (
    <div className={cn('flex flex-col gap-3 select-none', className)} {...props}>
      {/* Atajos de billetes y monto exacto */}
      <div className="grid grid-cols-4 gap-2">
        {BILLETES_ATAJO.map((monto) => (
          <button
            key={monto}
            type="button"
            onClick={() => onAtajoMonto?.(monto)}
            className="flex h-12 items-center justify-center rounded-lg border bg-secondary font-semibold text-secondary-foreground shadow-2xs transition-[color,background-color,transform] duration-150 ease-out hover:bg-muted active:scale-[0.97] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            <span className="tabular text-sm font-bold">
              {monto === 20_000 ? '20k' : monto === 50_000 ? '50k' : '100k'}
            </span>
          </button>
        ))}

        <button
          type="button"
          onClick={onExacto}
          disabled={!onExacto}
          className="flex h-12 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 font-bold text-primary shadow-2xs transition-[color,background-color,transform] duration-150 ease-out hover:bg-primary/20 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
        >
          <span className="text-xs tracking-wider uppercase">Exacto</span>
        </button>
      </div>

      {totalExacto !== undefined && totalExacto > 0 && (
        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span>Total a pagar:</span>
          <span className="tabular font-bold text-foreground">
            {formatearCOP(totalExacto)}
          </span>
        </div>
      )}

      {/* Matriz 3×4 de botones de 64 px */}
      <div className="flex flex-col gap-2">
        {filasDigitos.map((fila, filaIdx) => (
          <div key={filaIdx} className="grid grid-cols-3 gap-2">
            {fila.map((digito) => (
              <button
                key={digito}
                type="button"
                onClick={() => onDigito(digito)}
                className="flex h-16 w-full items-center justify-center rounded-xl border bg-card text-2xl font-bold text-card-foreground shadow-xs transition-[background-color,transform,border-color] duration-150 ease-out hover:border-primary/50 hover:bg-muted/40 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 tabular"
              >
                {digito}
              </button>
            ))}
          </div>
        ))}

        {/* Última fila: 00, 0, borrar */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onDigito('00')}
            className="flex h-16 w-full items-center justify-center rounded-xl border bg-card text-xl font-bold text-card-foreground shadow-xs transition-[background-color,transform,border-color] duration-150 ease-out hover:border-primary/50 hover:bg-muted/40 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 tabular"
          >
            00
          </button>

          <button
            type="button"
            onClick={() => onDigito('0')}
            className="flex h-16 w-full items-center justify-center rounded-xl border bg-card text-2xl font-bold text-card-foreground shadow-xs transition-[background-color,transform,border-color] duration-150 ease-out hover:border-primary/50 hover:bg-muted/40 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 tabular"
          >
            0
          </button>

          <button
            type="button"
            aria-label="Borrar último dígito"
            onClick={onBorrar}
            className="flex h-16 w-full items-center justify-center rounded-xl border bg-secondary/60 text-secondary-foreground shadow-xs transition-[background-color,transform,border-color] duration-150 ease-out hover:bg-muted hover:text-destructive active:scale-[0.97] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Delete className="size-6" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Botón de limpiar opcional */}
      {onLimpiar && (
        <button
          type="button"
          onClick={onLimpiar}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.97] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          <span>Limpiar teclado</span>
        </button>
      )}
    </div>
  );
}
