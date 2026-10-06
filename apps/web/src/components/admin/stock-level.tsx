import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface StockLevelProps extends Omit<ComponentProps<'div'>, 'children'> {
  actual: number;
  minimo: number;
  unidad: string;
  nombre?: string;
  mostrarEtiquetaEstado?: boolean;
}

function formatearCantidad(cantidad: number, unidad: string): string {
  const formateador = new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 2,
  });
  return `${formateador.format(cantidad)} ${unidad.toLowerCase()}`;
}

/**
 * StockLevel: Barra de nivel de existencias de inventario (DESIGN.md §4).
 * - Componente Progress + texto con formato tabular "1.200 g / mín 2.000 g".
 * - Indicador visual y accesible de stock bajo / adecuado.
 * - Icono y texto para cumplir con la regla "el color nunca va solo".
 */
export function StockLevel({
  actual,
  minimo,
  unidad,
  nombre,
  mostrarEtiquetaEstado = true,
  className,
  ...props
}: StockLevelProps) {
  const esStockBajo = actual <= minimo;
  const esAgotado = actual <= 0;

  // Si el mínimo es 0, usamos actual como referencia
  const maximoReferencia = Math.max(minimo * 2, actual, 1);
  const porcentaje = Math.min(100, Math.max(0, (actual / maximoReferencia) * 100));

  const colorIndicador = esAgotado
    ? 'bg-destructive'
    : esStockBajo
      ? 'bg-warning'
      : 'bg-success';

  return (
    <div className={cn('flex flex-col gap-1.5 w-full', className)} {...props}>
      {/* Cabecera con nombre opcional y cantidades */}
      <div className="flex items-center justify-between text-xs font-medium">
        {nombre && <span className="font-semibold text-foreground">{nombre}</span>}
        <div className="flex items-center gap-1.5 tabular ml-auto">
          <span
            className={cn(
              'font-bold',
              esStockBajo ? 'text-warning' : 'text-foreground',
            )}
          >
            {formatearCantidad(actual, unidad)}
          </span>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground">
            mín {formatearCantidad(minimo, unidad)}
          </span>
        </div>
      </div>

      {/* Barra de progreso */}
      <Progress
        value={porcentaje}
        max={100}
        indicatorClassName={colorIndicador}
        className="h-2.5"
      />

      {/* Estado con icono + texto si está activado */}
      {mostrarEtiquetaEstado && (
        <div className="flex items-center gap-1 text-[11px] font-semibold">
          {esAgotado ? (
            <span className="inline-flex items-center gap-1 text-destructive">
              <AlertTriangle className="size-3" aria-hidden="true" />
              Agotado
            </span>
          ) : esStockBajo ? (
            <span className="inline-flex items-center gap-1 text-warning">
              <AlertTriangle className="size-3" aria-hidden="true" />
              Stock bajo
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-success">
              <CheckCircle2 className="size-3" aria-hidden="true" />
              Stock adecuado
            </span>
          )}
        </div>
      )}
    </div>
  );
}
