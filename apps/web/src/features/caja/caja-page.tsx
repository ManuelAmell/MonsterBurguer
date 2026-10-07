import { AlertCircle, BadgeCheck, Loader2, Lock, Printer, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useState } from 'react';
import { formatearCOP, type ResumenCierre } from '@mb/shared';
import { EmptyState } from '@/components/empty-state';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { t } from '@/i18n/es';
import { ApiError } from '@/lib/api';
import { digitosAPesos, formatearFechaHora } from '@/lib/format';
import { cn } from '@/lib/utils';
import { uuid } from '@/lib/uuid';
import '@/styles/print.css';
import { EntradaMonto } from './entrada-monto';
import { HistorialCierres } from './historial-cierres';
import { MovimientosLista } from './movimientos';
import { useAbrirCaja, useCerrarCaja, useSesionActual } from './queries';

function Diferencia({ valor }: { valor: number }) {
  const cuadra = valor === 0;
  const Icono = cuadra ? BadgeCheck : valor > 0 ? TrendingUp : TrendingDown;
  return (
    <p
      className={cn(
        'flex items-center gap-2 font-display text-3xl font-extrabold',
        cuadra ? 'text-success' : valor > 0 ? 'text-info' : 'text-destructive',
      )}
    >
      <Icono aria-hidden="true" className="size-7" />
      <span className="tabular">
        {cuadra ? t.caja.cuadrada : valor > 0 ? t.caja.sobrante(formatearCOP(valor)) : t.caja.faltante(formatearCOP(-valor))}
      </span>
    </p>
  );
}

function Fila({ etiqueta, valor, fuerte }: { etiqueta: string; valor: number; fuerte?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-1.5', fuerte && 'font-bold')}>
      <span className={fuerte ? '' : 'text-muted-foreground'}>{etiqueta}</span>
      <span className="tabular">{formatearCOP(valor)}</span>
    </div>
  );
}

/** Caja — sesión (DESIGN §7.5, RN-40, RN-41, RN-47). */
export function CajaPage() {
  const sesion = useSesionActual();
  const abrir = useAbrirCaja();
  const cerrar = useCerrarCaja();
  const [pestana, setPestana] = useState<'turno' | 'historial'>('turno');
  const [base, setBase] = useState('');
  const [contado, setContado] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [claveAbrir, setClaveAbrir] = useState(uuid);
  const [claveCerrar, setClaveCerrar] = useState(uuid);
  const [cierre, setCierre] = useState<ResumenCierre | null>(null);
  const [error, setError] = useState<string | null>(null);

  function manejarError(err: Error) {
    setError(err instanceof ApiError && err.codigo === 'VERSION_CONFLICT' ? t.caja.conflicto : err.message);
  }

  const actual = sesion.data;
  const resumen = actual?.resumen;
  const esperado =
    actual &&
    (resumen?.efectivoEsperado ??
      actual.sesion.efectivoEsperado ??
      actual.sesion.montoApertura + (resumen?.ventasEfectivo ?? 0) + (resumen?.ingresos ?? 0) - (resumen?.retiros ?? 0));
  const montoContado = digitosAPesos(contado);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <h1 className="font-display text-3xl font-bold">{t.caja.titulo}</h1>

      <div role="tablist" aria-label={t.caja.titulo} className="flex gap-2 border-b">
        {(['turno', 'historial'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`pestana-${id}`}
            aria-selected={pestana === id}
            aria-controls="panel-caja"
            onClick={() => setPestana(id)}
            className={cn(
              'h-12 border-b-2 px-4 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring',
              pestana === id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {id === 'turno' ? t.caja.pestanaTurno : t.caja.pestanaHistorial}
          </button>
        ))}
      </div>

      <div id="panel-caja" role="tabpanel" aria-labelledby={`pestana-${pestana}`} className="flex flex-col gap-6">
      {pestana === 'historial' ? (
        <HistorialCierres />
      ) : sesion.isPending ? (
        <p role="status" className="flex items-center gap-2 text-muted-foreground">
          <Loader2 aria-hidden="true" className="size-5 animate-spin" />
          {t.caja.cargando}
        </p>
      ) : sesion.isError ? (
        <EmptyState
          icon={AlertCircle}
          titulo={t.caja.errorCarga}
          descripcion=""
          accion={<Button onClick={() => void sesion.refetch()}>{t.caja.reintentar}</Button>}
        />
      ) : cierre ? (
        <Card className="imprimible max-w-md">
          <CardContent className="flex flex-col gap-1 p-6">
            <h2 className="font-display text-xl font-bold">{t.caja.resumenCierre}</h2>
            <p className="tabular text-sm text-muted-foreground">
              {t.caja.cerradaAt}: {formatearFechaHora(cierre.cerradaAt)}
            </p>
            <div className="my-2 divide-y">
              <Fila etiqueta={t.caja.montoApertura} valor={cierre.montoApertura} />
              <Fila etiqueta={t.caja.ventasEfectivo} valor={cierre.ventasEfectivo} />
              <Fila etiqueta={t.caja.ingresos} valor={cierre.ingresos} />
              <Fila etiqueta={t.caja.retiros} valor={cierre.retiros} />
              <Fila etiqueta={t.caja.esperado} valor={cierre.efectivoEsperado} fuerte />
              <Fila etiqueta={t.caja.efectivoContado} valor={cierre.efectivoContado} fuerte />
            </div>
            <Diferencia valor={cierre.diferencia} />
            <p className="mt-3 text-xs font-semibold">{t.caja.noFiscal}</p>
            <div className="no-imprimir mt-4 flex flex-wrap gap-2">
              <Button onClick={() => window.print()}>
                <Printer aria-hidden="true" />
                {t.caja.imprimir}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setCierre(null);
                  setBase('');
                  setContado('');
                  setClaveAbrir(uuid());
                  setClaveCerrar(uuid());
                }}
              >
                {t.caja.nuevaSesion}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : !actual ? (
        <section className="flex flex-col gap-4">
          <EmptyState icon={Lock} titulo={t.caja.cerrada} descripcion={t.caja.cerradaDescripcion} />
          <h2 className="font-display text-xl font-bold">{t.caja.abrirTitulo}</h2>
          <EntradaMonto etiqueta={t.caja.montoBase} digitos={base} onCambio={setBase} />
          <p className="text-sm text-muted-foreground">{t.caja.montoBaseAyuda}</p>
          {error && (
            <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-destructive">
              <AlertCircle aria-hidden="true" className="size-4" />
              {error}
            </p>
          )}
          <Button
            size="lg"
            className="max-w-sm"
            disabled={abrir.isPending}
            onClick={() => {
              setError(null);
              abrir.mutate({ datos: { montoApertura: digitosAPesos(base) }, clave: claveAbrir }, { onError: manejarError });
            }}
          >
            {abrir.isPending ? (
              <>
                <Loader2 aria-hidden="true" className="animate-spin" />
                {t.caja.abriendo}
              </>
            ) : (
              <>
                <Wallet aria-hidden="true" />
                {t.caja.abrir}
              </>
            )}
          </Button>
        </section>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardContent className="flex flex-col gap-1 p-6">
              <p className="flex items-center gap-2 font-semibold text-success">
                <BadgeCheck aria-hidden="true" className="size-5" />
                {t.caja.abierta}
              </p>
              <p className="tabular text-sm text-muted-foreground">
                {t.caja.abiertaDesde} {formatearFechaHora(actual.sesion.abiertaAt)}
              </p>
              <h2 className="mt-3 font-display text-lg font-bold">{t.caja.resumen}</h2>
              <div className="divide-y">
                <Fila etiqueta={t.caja.montoApertura} valor={actual.sesion.montoApertura} />
                {resumen?.ventasEfectivo !== undefined && <Fila etiqueta={t.caja.ventasEfectivo} valor={resumen.ventasEfectivo} />}
                {resumen?.ventasTarjeta !== undefined && <Fila etiqueta={t.caja.ventasTarjeta} valor={resumen.ventasTarjeta} />}
                {resumen?.ventasTransferencia !== undefined && (
                  <Fila etiqueta={t.caja.ventasTransferencia} valor={resumen.ventasTransferencia} />
                )}
                {resumen?.ingresos !== undefined && <Fila etiqueta={t.caja.ingresos} valor={resumen.ingresos} />}
                {resumen?.retiros !== undefined && <Fila etiqueta={t.caja.retiros} valor={resumen.retiros} />}
                <Fila etiqueta={t.caja.efectivoEsperado} valor={esperado ?? 0} fuerte />
              </div>
            </CardContent>
          </Card>
          <div className="md:col-span-2">
            <MovimientosLista sesionId={actual.sesion.id} />
          </div>

          <section className="flex flex-col gap-4">
            <h2 className="font-display text-xl font-bold">{t.caja.cerrarTitulo}</h2>
            <p className="text-sm text-muted-foreground">{t.caja.cerrarDescripcion}</p>
            <EntradaMonto etiqueta={t.caja.efectivoContado} digitos={contado} onCambio={setContado} />
            {contado !== '' && esperado != null && <Diferencia valor={montoContado - (esperado ?? 0)} />}
            {error && (
              <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                <AlertCircle aria-hidden="true" className="size-4" />
                {error}
              </p>
            )}
            <Button size="lg" className="max-w-sm" disabled={contado === '' || cerrar.isPending} onClick={() => setConfirmando(true)}>
              <Lock aria-hidden="true" />
              {cerrar.isPending ? t.caja.cerrando : t.caja.cerrar}
            </Button>
          </section>
        </div>
      )}
      </div>

      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.caja.confirmarTitulo}</AlertDialogTitle>
            <AlertDialogDescription>{t.caja.confirmarDescripcion}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.caja.cancelar}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!actual) return;
                setError(null);
                cerrar.mutate(
                  {
                    sesionId: actual.sesion.id,
                    efectivoContado: montoContado,
                    version: actual.sesion.version,
                    clave: claveCerrar,
                  },
                  { onSuccess: setCierre, onError: manejarError },
                );
              }}
            >
              {t.caja.confirmarCerrar}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
