import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { t } from '@/i18n/es';

export interface NotaItemDialogProps {
  nombreProducto: string;
  notaInicial: string;
  abierto: boolean;
  guardando?: boolean;
  onGuardar: (nota: string) => void;
  onCerrar: () => void;
}

export function NotaItemDialog({
  nombreProducto,
  notaInicial,
  abierto,
  guardando = false,
  onGuardar,
  onCerrar,
}: NotaItemDialogProps) {
  const [nota, setNota] = useState(notaInicial);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!guardando && nota.length <= 140) {
        onGuardar(nota);
      }
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && onCerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.pos.notaTitulo(nombreProducto)}</DialogTitle>
          <DialogDescription>{t.pos.notaAyuda}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="nota-item-input">{t.pos.nota}</Label>
            <span
              className={`tabular text-xs font-semibold ${
                nota.length > 140 ? 'text-destructive font-bold' : 'text-muted-foreground'
              }`}
            >
              {nota.length}/140
            </span>
          </div>
          <Input
            id="nota-item-input"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={140}
            autoFocus
            className="h-12 text-base"
            placeholder={t.pos.notaAyuda}
          />
          {nota.length > 140 && (
            <p role="alert" className="text-xs text-destructive">
              {t.pos.notaErrorLargo}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="h-12 min-h-12 px-5"
            onClick={onCerrar}
            disabled={guardando}
          >
            {t.pos.cancelar}
          </Button>
          <Button
            type="button"
            className="h-12 min-h-12 px-5"
            onClick={() => onGuardar(nota)}
            disabled={guardando || nota.length > 140}
          >
            {guardando ? t.pos.guardando : t.pos.notaGuardar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
