import { AlertCircle, ArrowDownToLine, ArrowUpFromLine, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { formatearCOP, type MovimientoCaja } from '@mb/shared';
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
import { ApiError } from '@/lib/api';
import { digitosAPesos, formatearFechaHora } from '@/lib/format';
import { cn } from '@/lib/utils';
import { uuid } from '@/lib/uuid';
import { EntradaMonto } from './entrada-monto';
import { useMovimientos, useRegistrarMovimiento } from './queries';

type Tipo = 'INGRESO' | 'RETIRO';

/** Diálogo para registrar un ingreso o retiro manual (RN-46). */
export function MovimientoDialog({
  sesionId,
  tipo,
  abierto,
  onCerrar,
}: {
  sesionId: string;
  tipo: Tipo;
  abierto: boolean;
  onCerrar: () => void;
}) {
  const registrar = useRegistrarMovimiento();
  const [digitos, setDigitos] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [clave, setClave] = useState(uuid);
  const monto = digitosAPesos(digitos);
  const motivoLimpio = motivo.trim();
  const valido = monto > 0 && motivoLimpio.length >= 3 && motivoLimpio.length <= 140;

  function cerrar() {
    setDigitos('');
    setMotivo('');
    setError(null);
    setClave(uuid());
    onCerrar();
  }

  function enviar() {
    setError(null);
    registrar.mutate(
      { sesionId, datos: { tipo, monto, motivo: motivoLimpio }, clave },
      {
        onSuccess: cerrar,
        onError: (err) =>
          setError(
            err instanceof ApiError && err.codigo === 'EFECTIVO_INSUFICIENTE'
              ? t.caja.efectivoInsuficiente
              : err.message,
          ),
      },
    );
  }

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && cerrar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tipo === 'INGRESO' ? t.caja.ingresoTitulo : t.caja.retiroTitulo}</DialogTitle>
          <DialogDescription>{t.caja.motivoAyuda}</DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex flex-col gap-4">
          <EntradaMonto etiqueta={t.caja.montoMovimiento} digitos={digitos} onCambio={setDigitos} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="motivo-movimiento">{t.caja.motivo}</Label>
            <Input
              id="motivo-movimiento"
              value={motivo}
              maxLength={140}
              placeholder={t.caja.motivoPlaceholder}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-destructive">
              <AlertCircle aria-hidden="true" className="size-4" />
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" size="lg" onClick={cerrar}>
            {t.caja.cancelar}
          </Button>
          <Button size="lg" disabled={!valido || registrar.isPending} onClick={enviar}>
            {registrar.isPending ? (
              <>
                <Loader2 aria-hidden="true" className="animate-spin" />
                {t.caja.guardandoMovimiento}
              </>
            ) : (
              t.caja.guardarMovimiento
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MovimientoFila({ m }: { m: MovimientoCaja }) {
  const ingreso = m.tipo === 'INGRESO';
  const Icono = ingreso ? ArrowDownToLine : ArrowUpFromLine;
  return (
    <li className="flex items-center gap-3 py-2">
      <Icono aria-hidden="true" className={cn('size-5 shrink-0', ingreso ? 'text-success' : 'text-destructive')} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{m.motivo}</p>
        <p className="tabular text-xs text-muted-foreground">
          {ingreso ? t.caja.tipoIngreso : t.caja.tipoRetiro} · {formatearFechaHora(m.createdAt)}
        </p>
      </div>
      <span className={cn('tabular font-semibold', ingreso ? 'text-success' : 'text-destructive')}>
        {ingreso ? '+' : '−'}
        {formatearCOP(m.monto)}
      </span>
    </li>
  );
}

/** Botones de registro + lista de movimientos de la sesión abierta. */
export function MovimientosLista({ sesionId }: { sesionId: string }) {
  const movimientos = useMovimientos(sesionId);
  const [tipo, setTipo] = useState<Tipo | null>(null);
  return (
    <section className="flex flex-col gap-3" aria-labelledby="titulo-movimientos">
      <h2 id="titulo-movimientos" className="font-display text-lg font-bold">
        {t.caja.movimientosTitulo}
      </h2>
      <div className="flex flex-wrap gap-2">
        <Button size="lg" variant="outline" onClick={() => setTipo('INGRESO')}>
          <ArrowDownToLine aria-hidden="true" />
          {t.caja.registrarIngreso}
        </Button>
        <Button size="lg" variant="outline" onClick={() => setTipo('RETIRO')}>
          <ArrowUpFromLine aria-hidden="true" />
          {t.caja.registrarRetiro}
        </Button>
      </div>
      {movimientos.data && movimientos.data.length > 0 ? (
        <ul className="divide-y">
          {movimientos.data.map((m) => (
            <MovimientoFila key={m.id} m={m} />
          ))}
        </ul>
      ) : (
        <div>
          <p className="font-medium">{t.caja.sinMovimientos}</p>
          <p className="text-sm text-muted-foreground">{t.caja.sinMovimientosDesc}</p>
        </div>
      )}
      <MovimientoDialog
        sesionId={sesionId}
        tipo={tipo ?? 'INGRESO'}
        abierto={tipo !== null}
        onCerrar={() => setTipo(null)}
      />
    </section>
  );
}
