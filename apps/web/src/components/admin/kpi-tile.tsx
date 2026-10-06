import {
  Minus,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentProps } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface KpiTileProps extends Omit<ComponentProps<'div'>, 'children'> {
  titulo: string;
  valor: string | number;
  variacionPorcentaje?: number;
  textoComparacion?: string;
  icono?: LucideIcon;
}

/**
 * KpiTile: Mosaico de métricas clave para el panel de administración (DESIGN.md §4 y §7.6).
 * - Valor grande tabular (font-display text-2xl o text-3xl).
 * - Variación porcentual con icono (TrendingUp, TrendingDown, Minus) y texto explícito.
 * - Soporte para icono de categoría y texto de comparación contextual (ej: "vs. ayer").
 */
export function KpiTile({
  titulo,
  valor,
  variacionPorcentaje,
  textoComparacion = 'vs. ayer',
  icono: Icono,
  className,
  ...props
}: KpiTileProps) {
  const tieneVariacion = variacionPorcentaje !== undefined;
  const esPositivo = tieneVariacion && variacionPorcentaje > 0;
  const esNegativo = tieneVariacion && variacionPorcentaje < 0;
  const esNeutro = tieneVariacion && variacionPorcentaje === 0;

  return (
    <Card className={cn('p-4 shadow-xs select-none', className)} {...props}>
      <CardContent className="flex flex-col gap-2 p-0">
        {/* Cabecera del KPI: Título e icono */}
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-semibold uppercase tracking-wider">{titulo}</span>
          {Icono && (
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-foreground">
              <Icono className="size-4" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* Valor grande tabular */}
        <div className="tabular font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {valor}
        </div>

        {/* Variación con icono + texto */}
        {tieneVariacion && (
          <div className="flex items-center gap-1.5 pt-0.5 text-xs font-semibold">
            {esPositivo && (
              <span className="inline-flex items-center gap-1 text-success">
                <TrendingUp className="size-3.5" aria-hidden="true" />
                <span className="tabular">+{variacionPorcentaje} %</span>
              </span>
            )}

            {esNegativo && (
              <span className="inline-flex items-center gap-1 text-destructive">
                <TrendingDown className="size-3.5" aria-hidden="true" />
                <span className="tabular">{variacionPorcentaje} %</span>
              </span>
            )}

            {esNeutro && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Minus className="size-3.5" aria-hidden="true" />
                <span className="tabular">0 %</span>
              </span>
            )}

            <span className="text-muted-foreground font-normal">{textoComparacion}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
