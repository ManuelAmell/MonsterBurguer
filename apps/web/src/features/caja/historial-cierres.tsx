import { AlertCircle, BadgeCheck, Loader2, ReceiptText, TrendingDown, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { formatearCOP } from '@mb/shared';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { t } from '@/i18n/es';
import { formatearFechaHora } from '@/lib/format';
import { cn } from '@/lib/utils';
import { MovimientoFila } from './movimientos';
import { useSesionDetalle, useSesiones } from './queries';

/** Diferencia con icono + texto (sobrante, faltante o cuadrada). */
export function DiferenciaCompacta({ valor }: { valor: number | null | undefined }) {
  if (valor == null) return <span className="text-muted-foreground">—</span>;
  const cuadra = valor === 0;
  const Icono = cuadra ? BadgeCheck : valor > 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold',
        cuadra ? 'text-success' : valor > 0 ? 'text-info' : 'text-destructive',
      )}
    >
      <Icono aria-hidden="true" className="size-4" />
      <span className="tabular">
        {cuadra ? t.caja.cuadrada : valor > 0 ? t.caja.sobrante(formatearCOP(valor)) : t.caja.faltante(formatearCOP(-valor))}
      </span>
    </span>
  );
}

function FilaDetalle({ etiqueta, valor, fuerte }: { etiqueta: string; valor: number; fuerte?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-1.5', fuerte && 'font-bold')}>
      <span className={fuerte ? '' : 'text-muted-foreground'}>{etiqueta}</span>
      <span className="tabular">{formatearCOP(valor)}</span>
    </div>
  );
}

function DetalleSesion({ sesionId, onCerrar }: { sesionId: string | null; onCerrar: () => void }) {
  const detalle = useSesionDetalle(sesionId);
  const d = detalle.data;
  return (
    <Dialog open={sesionId !== null} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-h-[92dvh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.caja.detalleTitulo}</DialogTitle>
          <DialogDescription>
            {d ? `${d.cajero.nombre} · ${formatearFechaHora(d.abiertaAt)}` : t.caja.cargando}
          </DialogDescription>
        </DialogHeader>
        {detalle.isPending ? (
          <p role="status" className="mt-4 flex items-center gap-2 text-muted-foreground">
            <Loader2 aria-hidden="true" className="size-5 animate-spin" />
            {t.caja.cargando}
          </p>
        ) : detalle.isError || !d ? (
          <p role="alert" className="mt-4 flex items-center gap-2 text-destructive">
            <AlertCircle aria-hidden="true" className="size-5" />
            {t.caja.errorCarga}
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <div className="divide-y">
              <FilaDetalle etiqueta={t.caja.montoApertura} valor={d.montoApertura} />
              <FilaDetalle etiqueta={t.caja.ventasEfectivo} valor={d.totalesPorMetodo.efectivo} />
              <FilaDetalle etiqueta={t.caja.ingresos} valor={d.totalesMovimientos.ingresos} />
              <FilaDetalle etiqueta={t.caja.retiros} valor={d.totalesMovimientos.retiros} />
              <FilaDetalle etiqueta={t.caja.esperado} valor={d.efectivoEsperado ?? 0} fuerte />
              {d.efectivoContado != null && (
                <FilaDetalle etiqueta={t.caja.efectivoContado} valor={d.efectivoContado} fuerte />
              )}
            </div>
            <DiferenciaCompacta valor={d.diferencia} />
            <section>
              <h3 className="font-display text-base font-bold">{t.caja.totalesMetodo}</h3>
              <div className="divide-y">
                <FilaDetalle etiqueta={t.caja.ventasEfectivo} valor={d.totalesPorMetodo.efectivo} />
                <FilaDetalle etiqueta={t.caja.ventasTarjeta} valor={d.totalesPorMetodo.tarjeta} />
                <FilaDetalle etiqueta={t.caja.ventasTransferencia} valor={d.totalesPorMetodo.transferencia} />
              </div>
            </section>
            <section>
              <h3 className="font-display text-base font-bold">{t.caja.totalesMovimientosTitulo}</h3>
              {d.movimientos.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.caja.sinMovimientos}</p>
              ) : (
                <ul className="divide-y">
                  {d.movimientos.map((m) => (
                    <MovimientoFila key={m.id} m={m} />
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Historial de cierres de caja (paginado por cursor, filtro por fecha operativa). */
export function HistorialCierres() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const rangoInvalido = desde !== '' && hasta !== '' && desde > hasta;
  const q = useSesiones({
    desde: desde && !rangoInvalido ? desde : undefined,
    hasta: hasta && !rangoInvalido ? hasta : undefined,
  });
  const sesiones = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section className="flex flex-col gap-4" aria-labelledby="titulo-historial">
      <div>
        <h2 id="titulo-historial" className="font-display text-xl font-bold">
          {t.caja.historialTitulo}
        </h2>
        <p className="text-sm text-muted-foreground">{t.caja.historialDescripcion}</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="hist-desde">{t.caja.filtrarDesde}</Label>
          <Input id="hist-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="hist-hasta">{t.caja.filtrarHasta}</Label>
          <Input id="hist-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setDesde('');
            setHasta('');
          }}
        >
          {t.caja.limpiarFiltros}
        </Button>
      </div>
      {rangoInvalido && (
        <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-destructive">
          <AlertCircle aria-hidden="true" className="size-4" />
          {t.caja.rangoInvalido}
        </p>
      )}

      {q.isPending ? (
        <p role="status" className="flex items-center gap-2 text-muted-foreground">
          <Loader2 aria-hidden="true" className="size-5 animate-spin" />
          {t.caja.cargando}
        </p>
      ) : q.isError ? (
        <EmptyState
          icon={AlertCircle}
          titulo={t.caja.errorCarga}
          descripcion=""
          accion={<Button onClick={() => void q.refetch()}>{t.caja.reintentar}</Button>}
        />
      ) : sesiones.length === 0 ? (
        <EmptyState icon={ReceiptText} titulo={t.caja.sinSesiones} descripcion={t.caja.sinSesionesDesc} />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.caja.columnaFecha}</TableHead>
                <TableHead>{t.caja.columnaCajero}</TableHead>
                <TableHead className="text-right">{t.caja.columnaEsperado}</TableHead>
                <TableHead className="text-right">{t.caja.columnaContado}</TableHead>
                <TableHead>{t.caja.columnaDiferencia}</TableHead>
                <TableHead>
                  <span className="sr-only">{t.caja.columnaAcciones}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sesiones.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="tabular">{formatearFechaHora(s.abiertaAt)}</TableCell>
                  <TableCell>{s.cajero.nombre}</TableCell>
                  <TableCell className="tabular text-right">
                    {s.efectivoEsperado != null ? formatearCOP(s.efectivoEsperado) : '—'}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {s.efectivoContado != null ? formatearCOP(s.efectivoContado) : '—'}
                  </TableCell>
                  <TableCell>
                    {s.estado === 'ABIERTA' ? (
                      <span className="font-medium text-info">{t.caja.estadoAbierta}</span>
                    ) : (
                      <DiferenciaCompacta valor={s.diferencia} />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" onClick={() => setDetalleId(s.id)}>
                      {t.caja.verDetalle}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {q.hasNextPage && (
            <Button
              variant="outline"
              className="self-center"
              disabled={q.isFetchingNextPage}
              onClick={() => void q.fetchNextPage()}
            >
              {q.isFetchingNextPage ? t.caja.cargandoMas : t.caja.cargarMas}
            </Button>
          )}
        </>
      )}
      <DetalleSesion sesionId={detalleId} onCerrar={() => setDetalleId(null)} />
    </section>
  );
}
