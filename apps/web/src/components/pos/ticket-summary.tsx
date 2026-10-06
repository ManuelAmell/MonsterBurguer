import type { ComponentProps } from 'react';
import { formatearCOP } from '@mb/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface TicketSummaryProps extends Omit<ComponentProps<'div'>, 'children'> {
  cantidadProductos: number;
  total: number;
  base?: number;
  impuesto?: number;
  tasaBp?: number;
  nombreImpuesto?: string | null;
  textoAccionPrincipal?: string;
  onAccionPrincipal?: () => void;
  textoAccionSecundaria?: string;
  onAccionSecundaria?: () => void;
  deshabilitado?: boolean;
}

/**
 * TicketSummary: Resumen del ticket de venta (DESIGN.md §4 y §7.2).
 * - Cantidad de productos.
 * - Total en grande (32 px, cifras tabulares).
 * - Líneas de Base e Impuesto SOLO si la tasa de impuesto es > 0 (RN-02 / RN-03).
 * - Botón de acción primaria de 56 px (h-14).
 * - Botón de acción secundaria opcional.
 */
export function TicketSummary({
  cantidadProductos,
  total,
  base,
  impuesto,
  tasaBp = 0,
  nombreImpuesto,
  textoAccionPrincipal = 'Cobrar',
  onAccionPrincipal,
  textoAccionSecundaria,
  onAccionSecundaria,
  deshabilitado = false,
  className,
  ...props
}: TicketSummaryProps) {
  const tieneImpuesto = tasaBp > 0 && base !== undefined && impuesto !== undefined;

  const textoConteo =
    cantidadProductos === 1
      ? '1 producto'
      : `${cantidadProductos} productos`;

  return (
    <Card className={cn('border-t-2 border-primary/20 shadow-sm', className)} {...props}>
      <CardContent className="flex flex-col gap-4 p-4">
        {/* Conteo de productos */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Artículos</span>
          <span className="tabular font-medium text-foreground">{textoConteo}</span>
        </div>

        {/* Desglose tributario condicional (RN-03: solo si tasa > 0) */}
        {tieneImpuesto && (
          <div className="flex flex-col gap-1 rounded-md border border-dashed bg-muted/30 p-2.5 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Base gravable</span>
              <span className="tabular font-semibold text-foreground">
                {formatearCOP(base)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>
                {nombreImpuesto ? `${nombreImpuesto} (${tasaBp / 100} %)` : `Impuesto (${tasaBp / 100} %)`}
              </span>
              <span className="tabular font-semibold text-foreground">
                {formatearCOP(impuesto)}
              </span>
            </div>
          </div>
        )}

        {/* Total grande (32 px) */}
        <div className="flex items-baseline justify-between border-t pt-3">
          <span className="text-base font-bold text-foreground">TOTAL</span>
          <span className="tabular font-display text-3xl font-extrabold tracking-tight text-primary">
            {formatearCOP(total)}
          </span>
        </div>

        {/* Acciones principales */}
        <div className="flex flex-col gap-2 pt-1">
          {onAccionPrincipal && (
            <Button
              type="button"
              size="lg"
              disabled={deshabilitado || cantidadProductos === 0}
              onClick={onAccionPrincipal}
              className="h-14 w-full text-lg font-bold shadow-md cursor-pointer"
            >
              {textoAccionPrincipal}
            </Button>
          )}

          {textoAccionSecundaria && onAccionSecundaria && (
            <Button
              type="button"
              variant="outline"
              size="default"
              disabled={deshabilitado || cantidadProductos === 0}
              onClick={onAccionSecundaria}
              className="h-12 w-full font-semibold cursor-pointer"
            >
              {textoAccionSecundaria}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
