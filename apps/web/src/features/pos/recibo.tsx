import { Printer } from 'lucide-react';
import { formatearCOP } from '@mb/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRecibo } from '@/features/caja/queries';
import { t } from '@/i18n/es';
import { formatearFechaHora } from '@/lib/format';
import '@/styles/print.css';
import type { CobroExitoso } from './cobro-dialog';

/**
 * Recibo POS tras el cobro. Usa GET /recibos/:id y, si faltan campos (el contrato no tiene
 * esquema), completa con los datos del pedido y de la respuesta del cobro.
 */
export function ReciboDialog({ exito, onCerrar }: { exito: CobroExitoso; onCerrar: () => void }) {
  const { respuesta, pedido, pagos } = exito;
  const recibo = useRecibo(respuesta.reciboId).data;

  const items = recibo?.items ?? pedido.items;
  const lineasPago =
    recibo?.pagos?.map((p) => ({ metodo: p.metodo, monto: p.monto, recibido: p.recibido ?? undefined })) ?? pagos;
  const mesa =
    typeof recibo?.mesa === 'string' ? recibo.mesa : (recibo?.mesa?.nombre ?? recibo?.mesaNombre ?? pedido.mesa?.nombre);
  const impuesto = recibo?.impuesto ?? pedido.impuesto;
  const noResponsable = (recibo?.regimenTributario ?? 'NO_RESPONSABLE') === 'NO_RESPONSABLE';
  const nombreMetodo = (m: string) => t.pos.cobro.metodos[m as keyof typeof t.pos.cobro.metodos] ?? m;

  return (
    <Dialog open onOpenChange={(a) => !a && onCerrar()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-md overflow-y-auto">
        <DialogHeader className="no-imprimir pr-14">
          <DialogTitle>{t.pos.cobro.cobrado(respuesta.numero)}</DialogTitle>
          <DialogDescription>{t.pos.recibo.titulo}</DialogDescription>
        </DialogHeader>

        <article className="imprimible mt-4 rounded-lg border bg-card p-4 text-sm">
          <p className="text-center font-display text-lg font-extrabold">
            {recibo?.negocio?.nombre ?? t.app.nombre}
          </p>
          {recibo?.negocio?.documento && <p className="text-center">{recibo.negocio.documento}</p>}
          <p className="mt-1 text-center font-semibold">
            {t.pos.recibo.titulo} {respuesta.numero}
          </p>
          <p className="tabular text-center text-muted-foreground">
            {formatearFechaHora(recibo?.createdAt ?? new Date().toISOString())}
          </p>
          <p className="text-center">
            {t.pos.recibo.pedido} #{pedido.numeroDia} · {mesa ? `${t.pos.recibo.mesa} ${mesa}` : t.pos.recibo.llevar}
          </p>
          {(recibo?.cajeroNombre ?? recibo?.cajero) && (
            <p className="text-center">
              {t.pos.recibo.cajero}: {recibo?.cajeroNombre ?? recibo?.cajero}
            </p>
          )}

          <ul className="my-3 flex flex-col gap-1 border-y border-dashed py-2">
            {items.map((i, idx) => (
              <li key={idx} className="flex justify-between gap-2">
                <span>
                  <span className="tabular">{i.cantidad}</span> × {i.nombre}
                </span>
                <span className="tabular">{formatearCOP(i.totalLinea)}</span>
              </li>
            ))}
          </ul>

          {impuesto > 0 && (
            <>
              <p className="flex justify-between">
                <span>{t.pos.recibo.base}</span>
                <span className="tabular">{formatearCOP(recibo?.base ?? pedido.base)}</span>
              </p>
              <p className="flex justify-between">
                <span>{t.pos.recibo.impuesto}</span>
                <span className="tabular">{formatearCOP(impuesto)}</span>
              </p>
            </>
          )}
          <p className="flex justify-between text-base font-bold">
            <span>{t.pos.recibo.total}</span>
            <span className="tabular">{formatearCOP(respuesta.total)}</span>
          </p>
          {respuesta.propina > 0 && (
            <>
              <p className="flex justify-between">
                <span>{t.pos.recibo.propina}</span>
                <span className="tabular">{formatearCOP(respuesta.propina)}</span>
              </p>
              <p className="flex justify-between font-semibold">
                <span>{t.pos.recibo.totalPagado}</span>
                <span className="tabular">{formatearCOP(respuesta.total + respuesta.propina)}</span>
              </p>
            </>
          )}

          <ul className="mt-2 border-t border-dashed pt-2">
            {lineasPago.map((p, idx) => (
              <li key={idx} className="flex justify-between">
                <span>
                  {nombreMetodo(p.metodo)}
                  {p.recibido ? ` (${t.pos.recibo.recibido} ${formatearCOP(p.recibido)})` : ''}
                </span>
                <span className="tabular">{formatearCOP(p.monto)}</span>
              </li>
            ))}
          </ul>
          {respuesta.cambio > 0 && (
            <p className="flex justify-between font-semibold">
              <span>{t.pos.recibo.cambio}</span>
              <span className="tabular">{formatearCOP(respuesta.cambio)}</span>
            </p>
          )}

          <p className="mt-3 text-center">{t.pos.recibo.gracias}</p>
          {recibo?.leyendas?.length ? (
            recibo.leyendas.map((l) => (
              <p key={l} className="mt-1 text-center text-xs font-semibold">
                {l}
              </p>
            ))
          ) : (
            <>
              <p className="mt-2 text-center text-xs font-semibold">{t.pos.recibo.noFiscal}</p>
              {noResponsable && <p className="text-center text-xs font-semibold">{t.pos.recibo.noResponsable}</p>}
            </>
          )}
        </article>

        <DialogFooter className="no-imprimir mt-4">
          <Button variant="outline" onClick={onCerrar}>
            {t.pos.recibo.cerrar}
          </Button>
          <Button onClick={() => window.print()}>
            <Printer aria-hidden="true" />
            {t.pos.recibo.imprimir}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
