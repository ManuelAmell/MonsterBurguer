import { AlertTriangle, Ban, Info, Loader2, PackageX, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Pedido } from '@mb/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { t } from '@/i18n/es';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAnularPedido } from './queries';

export interface AnularPedidoDialogProps {
  pedido: Pedido;
  abierto: boolean;
  onCerrar: () => void;
  onAnulado: () => void;
}

export function AnularPedidoDialog({
  pedido,
  abierto,
  onCerrar,
  onAnulado,
}: AnularPedidoDialogProps) {
  const [motivo, setMotivo] = useState('');
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const anular = useAnularPedido();

  const longitud = motivo.trim().length;
  const esValido = longitud >= 5 && longitud <= 500;

  // Determinar explicación de stock según estado de comanda
  const estadoComanda = pedido.estadoComanda;
  let infoStock: {
    icono: typeof Info;
    claseBorde: string;
    claseTexto: string;
    mensaje: string;
  };

  if (!estadoComanda || pedido.estado === 'ABIERTO') {
    infoStock = {
      icono: Info,
      claseBorde: 'border-info/30 bg-info/10 text-info',
      claseTexto: 'text-foreground',
      mensaje: t.pos.anularDialogo.stockSinComanda,
    };
  } else if (estadoComanda === 'PENDIENTE') {
    infoStock = {
      icono: RotateCcw,
      claseBorde: 'border-warning/30 bg-warning/10 text-warning',
      claseTexto: 'text-foreground',
      mensaje: t.pos.anularDialogo.stockPendiente,
    };
  } else {
    // EN_PREPARACION, LISTA o ENTREGADA
    infoStock = {
      icono: PackageX,
      claseBorde: 'border-destructive/30 bg-destructive/10 text-destructive',
      claseTexto: 'text-foreground',
      mensaje: t.pos.anularDialogo.stockEnPreparacion,
    };
  }

  const IconoStock = infoStock.icono;

  async function handleConfirmar() {
    if (!esValido) {
      setErrorLocal(t.pos.anularDialogo.motivoAyuda);
      return;
    }

    setErrorLocal(null);
    try {
      await anular.mutateAsync({
        pedidoId: pedido.id,
        motivo: motivo.trim(),
        version: pedido.version,
      });
      toast.success(t.pos.anularDialogo.exito);
      onAnulado();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.codigo === 'VERSION_CONFLICT') {
          setErrorLocal(t.pos.conflicto);
        } else {
          setErrorLocal(err.message);
        }
      } else if (err instanceof Error) {
        setErrorLocal(err.message);
      } else {
        setErrorLocal(t.pos.errorGenerico);
      }
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && onCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <Ban className="size-5 shrink-0" aria-hidden="true" />
            <DialogTitle>{t.pos.anularDialogo.titulo(pedido.numeroDia)}</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            {t.pos.anularDialogo.descripcion}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Tarjeta explicativa del impacto en inventario */}
          <div
            className={cn(
              'flex items-start gap-3 rounded-lg border p-3 text-sm leading-relaxed',
              infoStock.claseBorde,
            )}
            role="status"
          >
            <IconoStock className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <span className={infoStock.claseTexto}>{infoStock.mensaje}</span>
          </div>

          {/* Campo de motivo obligatorio */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="motivo-anulacion" className="font-semibold">
                {t.pos.anularDialogo.motivoLabel}
              </Label>
              <span
                className={cn(
                  'tabular text-xs font-medium',
                  longitud < 5
                    ? 'text-muted-foreground'
                    : longitud > 500
                      ? 'text-destructive font-bold'
                      : 'text-success',
                )}
                aria-live="polite"
              >
                {longitud} / 500
              </span>
            </div>

            <textarea
              id="motivo-anulacion"
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                if (errorLocal) setErrorLocal(null);
              }}
              placeholder={t.pos.anularDialogo.motivoPlaceholder}
              rows={3}
              maxLength={500}
              className={cn(
                'w-full rounded-md border border-input bg-background p-3 text-sm shadow-xs outline-none',
                'focus-visible:ring-3 focus-visible:ring-ring',
                errorLocal && 'border-destructive focus-visible:ring-destructive',
              )}
              disabled={anular.isPending}
            />

            <span className="text-xs text-muted-foreground">
              {t.pos.anularDialogo.motivoAyuda}
            </span>

            {errorLocal && (
              <p
                role="alert"
                className="flex items-center gap-1.5 text-sm font-semibold text-destructive"
              >
                <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                {errorLocal}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-12 min-h-12 font-medium"
            onClick={onCerrar}
            disabled={anular.isPending}
          >
            {t.pos.anularDialogo.cancelar}
          </Button>

          <Button
            type="button"
            variant="destructive"
            className="h-12 min-h-12 gap-2 font-semibold"
            onClick={handleConfirmar}
            disabled={!esValido || anular.isPending}
          >
            {anular.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                {t.pos.anularDialogo.anulando}
              </>
            ) : (
              <>
                <Ban className="size-4" aria-hidden="true" />
                {t.pos.anularDialogo.confirmar}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
