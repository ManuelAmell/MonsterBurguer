import {
  AlertOctagon,
  AlertTriangle,
  Clock,
  MapPin,
  Package,
} from 'lucide-react';
import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface KdsItem {
  cantidad: number;
  nombre: string;
  nota?: string;
}

export type KdsEstado = 'PENDIENTE' | 'EN_PREPARACION' | 'LISTA' | 'ENTREGADA';

export interface KdsTicketCardProps extends Omit<ComponentProps<'div'>, 'children'> {
  numeroPedido: string | number;
  tipo: 'MESA' | 'LLEVAR';
  mesa?: string | number;
  tiempoSegundos: number;
  items: readonly KdsItem[];
  estado: KdsEstado;
  onAvanzar?: () => void;
  textoAvanzar?: string;
  deshabilitado?: boolean;
}

function formatearTiempo(segundos: number): string {
  const mins = Math.floor(segundos / 60);
  const secs = segundos % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * KdsTicketCard: Tarjeta de comanda para la pantalla de cocina (DESIGN.md §4 y §7.4).
 * - Legible a 2 metros: número de pedido display grande (24-32 px).
 * - Temporizador tabular con umbrales visuales de atraso:
 *     - < 8 min: neutral (Clock)
 *     - ≥ 8 min: warning (+8 min, AlertTriangle)
 *     - ≥ 12 min: destructive (+12 min, AlertOctagon)
 * - Ítems con notas resaltadas en caja de alto contraste.
 * - Botón de avance de ancho completo y 56 px de alto (h-14).
 */
export function KdsTicketCard({
  numeroPedido,
  tipo,
  mesa,
  tiempoSegundos,
  items,
  estado,
  onAvanzar,
  textoAvanzar,
  deshabilitado = false,
  className,
  ...props
}: KdsTicketCardProps) {
  const minutos = Math.floor(tiempoSegundos / 60);
  const atrasoGrave = minutos >= 12;
  const atrasoLeve = minutos >= 8 && minutos < 12;

  const textoBotonPorDefecto =
    estado === 'PENDIENTE'
      ? 'Iniciar preparación'
      : estado === 'EN_PREPARACION'
        ? 'Marcar LISTA'
        : 'Marcar entregada';

  const textoAccion = textoAvanzar ?? textoBotonPorDefecto;

  return (
    <Card
      className={cn(
        'flex flex-col justify-between overflow-hidden rounded-xl border-2 bg-card text-card-foreground shadow-md transition-[border-color,box-shadow] duration-150',
        atrasoGrave
          ? 'border-destructive ring-2 ring-destructive/30'
          : atrasoLeve
            ? 'border-warning ring-2 ring-warning/30'
            : 'border-border',
        className,
      )}
      {...props}
    >
      {/* Cabecera del ticket: Número, tipo y temporizador */}
      <div className="flex items-center justify-between border-b bg-muted/40 p-3.5">
        <div className="flex items-center gap-2.5">
          <span className="font-display text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            #{numeroPedido}
          </span>

          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wider',
              tipo === 'MESA'
                ? 'bg-primary/15 text-primary'
                : 'bg-info/15 text-info',
            )}
          >
            {tipo === 'MESA' ? (
              <>
                <MapPin className="size-3.5" aria-hidden="true" />
                <span>{mesa ? `Mesa ${mesa}` : 'Mesa'}</span>
              </>
            ) : (
              <>
                <Package className="size-3.5" aria-hidden="true" />
                <span>Llevar</span>
              </>
            )}
          </span>
        </div>

        {/* Temporizador con umbrales */}
        <div
          className={cn(
            'tabular inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-bold select-none',
            atrasoGrave
              ? 'bg-destructive/15 text-destructive'
              : atrasoLeve
                ? 'bg-warning/15 text-warning'
                : 'bg-secondary text-secondary-foreground',
          )}
          title={`Tiempo transcurrido: ${formatearTiempo(tiempoSegundos)}`}
        >
          {atrasoGrave ? (
            <>
              <AlertOctagon className="size-4 shrink-0 text-destructive" aria-hidden="true" />
              <span>+12 min</span>
            </>
          ) : atrasoLeve ? (
            <>
              <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden="true" />
              <span>+8 min</span>
            </>
          ) : (
            <>
              <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>{formatearTiempo(tiempoSegundos)}</span>
            </>
          )}
        </div>
      </div>

      {/* Lista de ítems con notas resaltadas */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {items.map((item, idx) => (
          <div key={idx} className="flex flex-col gap-1 border-b pb-2.5 last:border-0 last:pb-0">
            <div className="flex items-baseline gap-2.5">
              <span className="tabular font-display text-lg font-extrabold text-primary">
                {item.cantidad}×
              </span>
              <span className="text-base font-bold text-foreground leading-snug">
                {item.nombre}
              </span>
            </div>

            {/* Nota resaltada (DESIGN §7.4: SIN CEBOLLA resaltado) */}
            {item.nota && (
              <div className="ml-7 rounded-md border border-accent/40 bg-accent/20 px-2.5 py-1 text-xs font-bold text-accent-foreground uppercase tracking-wide">
                <span>• {item.nota}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Botón de avance de ancho completo y 56 px de alto */}
      <div className="p-3 pt-0">
        <Button
          type="button"
          disabled={deshabilitado}
          onClick={onAvanzar}
          className={cn(
            'h-14 w-full text-base font-bold uppercase tracking-wider shadow-sm cursor-pointer active:scale-[0.97]',
            estado === 'LISTA'
              ? 'bg-success text-white hover:bg-success/90'
              : 'bg-primary text-primary-foreground hover:bg-primary/90',
          )}
        >
          {textoAccion}
        </Button>
      </div>
    </Card>
  );
}
