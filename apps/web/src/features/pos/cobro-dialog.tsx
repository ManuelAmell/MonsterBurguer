import { AlertCircle, BadgeCheck, Loader2, Plus, Trash2, Wallet } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  cobroSchema,
  formatearCOP,
  METODOS_PAGO,
  propinaSugerida,
  type CobroRespuesta,
  type MetodoPago,
  type Pedido,
} from '@mb/shared';
import { NumericKeypad } from '@/components/pos/numeric-keypad';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useCobrar, useSesionActual } from '@/features/caja/queries';
import { t } from '@/i18n/es';
import { ApiError } from '@/lib/api';
import { digitosAPesos } from '@/lib/format';
import { cn } from '@/lib/utils';
import { uuid } from '@/lib/uuid';

type OpcionPropina = 'NO' | 'SI' | 'OTRA';

interface LineaPago {
  id: string;
  metodo: MetodoPago;
}

export interface PagoRegistrado {
  metodo: MetodoPago;
  monto: number;
  recibido?: number;
}

export interface CobroExitoso {
  respuesta: CobroRespuesta;
  pedido: Pedido;
  pagos: PagoRegistrado[];
}

interface Props {
  pedido: Pedido;
  onCerrar: () => void;
  onCobrado: (resultado: CobroExitoso) => void;
}

const MAX_LINEAS = 1; // el backend exige exactamente 1 pago por cobro

/**
 * Cobro (DESIGN §7.3, RN-06, RN-42, RN-43). Se monta solo mientras está abierto: cada apertura
 * parte de cero y genera su propio `Idempotency-Key`.
 */
export function CobroDialog({ pedido, onCerrar, onCobrado }: Props) {
  const sesion = useSesionActual();
  const cobrar = useCobrar();
  const esMesa = pedido.tipo === 'MESA';

  const [propinaOpcion, setPropinaOpcion] = useState<OpcionPropina | null>(null);
  const [lineas, setLineas] = useState<LineaPago[]>([{ id: uuid(), metodo: 'EFECTIVO' }]);
  // Valores digitados (solo dígitos) por campo: 'propina' | '<lineaId>:monto' | '<lineaId>:recibido' | '<lineaId>:ref'.
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [activo, setActivo] = useState<string | null>(null);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [sinCaja, setSinCaja] = useState(false);
  const clave = useRef<{ firma: string; valor: string }>({ firma: '', valor: uuid() });

  const propinaSug = useMemo(() => propinaSugerida(pedido.base), [pedido.base]);
  const propina = !esMesa
    ? 0
    : propinaOpcion === 'SI'
      ? propinaSug
      : propinaOpcion === 'OTRA'
        ? digitosAPesos(campos.propina ?? '')
        : 0;
  const propinaElegida = !esMesa || propinaOpcion !== null;
  const aPagar = pedido.total + propina;

  // Montos por línea: con varias líneas, la última toma el saldo restante.
  const montos = useMemo(() => {
    if (lineas.length === 1) return [aPagar];
    const resultado: number[] = [];
    let acumulado = 0;
    lineas.forEach((linea, i) => {
      if (i === lineas.length - 1) {
        resultado.push(Math.max(aPagar - acumulado, 0));
      } else {
        const m = digitosAPesos(campos[`${linea.id}:monto`] ?? '');
        resultado.push(m);
        acumulado += m;
      }
    });
    return resultado;
  }, [lineas, campos, aPagar]);

  const sumaPagos = montos.reduce((a, b) => a + b, 0);
  const restante = aPagar - sumaPagos;

  const detalle = lineas.map((linea, i) => {
    const monto = montos[i] ?? 0;
    const recibido = digitosAPesos(campos[`${linea.id}:recibido`] ?? '');
    return { linea, monto, recibido, cambio: linea.metodo === 'EFECTIVO' ? Math.max(recibido - monto, 0) : 0 };
  });
  const efectivo = detalle.find((d) => d.linea.metodo === 'EFECTIVO');

  const claveActiva =
    activo ??
    (efectivo ? `${efectivo.linea.id}:recibido` : lineas.length > 1 ? `${lineas[0]?.id}:monto` : null);

  function editarCampo(fn: (actual: string) => string) {
    if (!claveActiva) return;
    setCampos((prev) => {
      const siguiente = fn(prev[claveActiva] ?? '').replace(/^0+(?=\d)/, '');
      return { ...prev, [claveActiva]: siguiente.slice(0, 9) };
    });
  }

  function cambiarMetodo(id: string, metodo: MetodoPago) {
    setLineas((prev) => prev.map((l) => (l.id === id ? { ...l, metodo } : l)));
    setActivo(null);
  }

  function agregarLinea() {
    const usados = new Set(lineas.map((l) => l.metodo));
    const libre = METODOS_PAGO.find((m) => !usados.has(m)) ?? 'TARJETA';
    setLineas((prev) => [...prev, { id: uuid(), metodo: libre }]);
    setActivo(null);
  }

  function quitarLinea(id: string) {
    setLineas((prev) => prev.filter((l) => l.id !== id));
    setActivo(null);
  }

  const pagos = detalle.map(({ linea, monto, recibido }) => {
    const referencia = (campos[`${linea.id}:ref`] ?? '').trim();
    return {
      metodo: linea.metodo,
      monto,
      ...(linea.metodo === 'EFECTIVO' ? { recibido: recibido > 0 ? recibido : undefined } : {}),
      ...(referencia && linea.metodo !== 'EFECTIVO' ? { referencia } : {}),
    };
  });
  const cuerpo = { pedidoId: pedido.id, pedidoVersion: pedido.version, propina, pagos };
  const validacion = cobroSchema.safeParse(cuerpo);
  const efectivoInsuficiente = efectivo !== undefined && efectivo.recibido < efectivo.monto;
  const cuadra = restante === 0 && montos.every((m) => m > 0);
  const puedeConfirmar = propinaElegida && validacion.success && cuadra && !efectivoInsuficiente;

  function mensajeBloqueo(): string | null {
    if (!propinaElegida) return t.pos.cobro.propinaSinElegir;
    if (!cuadra) return t.pos.cobro.errorNoCuadra;
    if (efectivoInsuficiente) return t.pos.cobro.errorRecibidoMenor;
    return null;
  }

  function confirmar() {
    if (!puedeConfirmar || !validacion.success || cobrar.isPending) return;
    setErrorServidor(null);
    const firma = JSON.stringify(validacion.data);
    if (clave.current.firma !== firma) clave.current = { firma, valor: uuid() };
    cobrar.mutate(
      { cuerpo: validacion.data, clave: clave.current.valor },
      {
        onSuccess: (respuesta) =>
          onCobrado({
            respuesta,
            pedido,
            pagos: detalle.map(({ linea, monto, recibido }) => ({
              metodo: linea.metodo,
              monto,
              ...(linea.metodo === 'EFECTIVO' ? { recibido } : {}),
            })),
          }),
        onError: (err) => {
          if (err instanceof ApiError && err.codigo === 'CAJA_NO_ABIERTA') setSinCaja(true);
          else setErrorServidor(err instanceof Error ? err.message : t.errores.inesperado);
        },
      },
    );
  }

  const bloqueo = mensajeBloqueo();
  const cargandoCaja = sesion.isPending;
  const hayCaja = sesion.data != null && !sinCaja;

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-4xl overflow-y-auto">
        <DialogHeader className="pr-14">
          <DialogTitle>{t.pos.cobro.titulo(pedido.numeroDia)}</DialogTitle>
          <DialogDescription>{t.pos.cobro.descripcion}</DialogDescription>
        </DialogHeader>

        {cargandoCaja ? (
          <p role="status" className="flex items-center gap-2 py-10 text-muted-foreground">
            <Loader2 aria-hidden="true" className="size-5 animate-spin" />
            {t.pos.cobro.verificandoCaja}
          </p>
        ) : !hayCaja ? (
          <div role="alert" className="mt-4 flex flex-col items-start gap-4 rounded-lg border border-warning/40 bg-warning/10 p-5">
            <div className="flex items-start gap-3">
              <Wallet aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-warning" />
              <div>
                <p className="font-semibold text-foreground">{t.pos.cobro.sinCaja}</p>
                <p className="text-sm text-muted-foreground">{t.pos.cobro.sinCajaDescripcion}</p>
              </div>
            </div>
            <Button asChild>
              <Link to="/caja">{t.pos.cobro.irACaja}</Link>
            </Button>
          </div>
        ) : (
          <form
            className="mt-4 grid gap-6 lg:grid-cols-[1fr_20rem]"
            onSubmit={(e) => {
              e.preventDefault();
              confirmar();
            }}
          >
            <div className="flex flex-col gap-5">
              <div className="flex items-baseline justify-between rounded-lg bg-muted/50 px-4 py-3">
                <span className="font-medium">{t.pos.cobro.total}</span>
                <span className="tabular font-display text-3xl font-extrabold text-foreground">
                  {formatearCOP(pedido.total)}
                </span>
              </div>

              {esMesa && (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-sm font-semibold">{t.pos.cobro.propinaPregunta}</legend>
                  <ToggleGroup
                    aria-label={t.pos.cobro.propinaPregunta}
                    variant="outline"
                    value={propinaOpcion ?? ''}
                    onValueChange={(v) => {
                      if (v === 'NO' || v === 'SI' || v === 'OTRA') {
                        setPropinaOpcion(v);
                        setActivo(v === 'OTRA' ? 'propina' : null);
                      }
                    }}
                    className="gap-2"
                  >
                    <ToggleGroupItem value="NO" className="flex-1">
                      {t.pos.cobro.propinaNo}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="SI" className="tabular flex-1">
                      {t.pos.cobro.propinaSi(formatearCOP(propinaSug))}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="OTRA" className="flex-1">
                      {t.pos.cobro.propinaOtra}
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <p className="text-sm text-muted-foreground">{t.pos.cobro.propinaAyuda}</p>
                  {propinaOpcion === 'OTRA' && (
                    <CampoMonto
                      etiqueta={t.pos.cobro.propinaOtraLabel}
                      valor={propina}
                      activo={claveActiva === 'propina'}
                      onActivar={() => setActivo('propina')}
                    />
                  )}
                  {propinaOpcion === null && (
                    <p className="flex items-center gap-1.5 text-sm font-medium text-warning">
                      <AlertCircle aria-hidden="true" className="size-4" />
                      {t.pos.cobro.propinaSinElegir}
                    </p>
                  )}
                </fieldset>
              )}

              {propinaElegida && propina > 0 && (
                <div className="flex items-baseline justify-between px-1 text-sm">
                  <span className="text-muted-foreground">{t.pos.cobro.aPagar}</span>
                  <span className="tabular text-lg font-bold">{formatearCOP(aPagar)}</span>
                </div>
              )}

              <div className="flex flex-col gap-4">
                {detalle.map(({ linea, monto, recibido }, i) => {
                  const esUltima = i === lineas.length - 1;
                  const montoEditable = lineas.length > 1 && !esUltima;
                  return (
                    <fieldset key={linea.id} className="flex flex-col gap-3 rounded-lg border p-3">
                      <legend className="px-1 text-sm font-semibold">
                        {lineas.length > 1 ? `${t.pos.cobro.metodo} ${i + 1}` : t.pos.cobro.metodo}
                      </legend>
                      <div className="flex items-center gap-2">
                        <ToggleGroup
                          aria-label={t.pos.cobro.metodo}
                          variant="outline"
                          value={linea.metodo}
                          onValueChange={(v) => {
                            const metodo = METODOS_PAGO.find((m) => m === v);
                            if (metodo) cambiarMetodo(linea.id, metodo);
                          }}
                          className="flex-1 gap-2"
                        >
                          {METODOS_PAGO.map((m) => (
                            <ToggleGroupItem
                              key={m}
                              value={m}
                              disabled={m === 'EFECTIVO' && lineas.some((l) => l.id !== linea.id && l.metodo === 'EFECTIVO')}
                              className="flex-1"
                            >
                              {t.pos.cobro.metodos[m]}
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                        {lineas.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={t.pos.cobro.quitarMetodo}
                            onClick={() => quitarLinea(linea.id)}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        )}
                      </div>

                      {lineas.length > 1 &&
                        (montoEditable ? (
                          <CampoMonto
                            etiqueta={t.pos.cobro.monto}
                            valor={monto}
                            activo={claveActiva === `${linea.id}:monto`}
                            onActivar={() => setActivo(`${linea.id}:monto`)}
                          />
                        ) : (
                          <div className="flex items-baseline justify-between text-sm">
                            <span className="text-muted-foreground">{t.pos.cobro.monto}</span>
                            <span className="tabular text-lg font-bold">{formatearCOP(monto)}</span>
                          </div>
                        ))}

                      {linea.metodo === 'EFECTIVO' ? (
                        <CampoMonto
                          etiqueta={t.pos.cobro.recibido}
                          valor={recibido}
                          activo={claveActiva === `${linea.id}:recibido`}
                          onActivar={() => setActivo(`${linea.id}:recibido`)}
                        />
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`ref-${linea.id}`}>{t.pos.cobro.referencia}</Label>
                          <Input
                            id={`ref-${linea.id}`}
                            maxLength={100}
                            value={campos[`${linea.id}:ref`] ?? ''}
                            onChange={(e) => {
                              const valor = e.target.value;
                              setCampos((prev) => ({ ...prev, [`${linea.id}:ref`]: valor }));
                            }}
                          />
                        </div>
                      )}
                    </fieldset>
                  );
                })}

                {lineas.length < MAX_LINEAS && (
                  <Button type="button" variant="outline" onClick={agregarLinea} className="self-start">
                    <Plus aria-hidden="true" />
                    {t.pos.cobro.agregarMetodo}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {claveActiva !== null && (
                <NumericKeypad
                  onDigito={(d) => editarCampo((a) => a + d)}
                  onBorrar={() => editarCampo((a) => a.slice(0, -1))}
                  onLimpiar={() => editarCampo(() => '')}
                  onAtajoMonto={(m) => editarCampo(() => String(m))}
                  onExacto={() => {
                    if (!efectivo) return;
                    setCampos((prev) => ({ ...prev, [`${efectivo.linea.id}:recibido`]: String(efectivo.monto) }));
                    setActivo(`${efectivo.linea.id}:recibido`);
                  }}
                  totalExacto={efectivo?.monto}
                />
              )}

              {efectivo && (
                <div
                  className={cn(
                    'rounded-lg border p-4',
                    efectivo.recibido >= efectivo.monto && efectivo.recibido > 0
                      ? 'border-success/40 bg-success/10'
                      : 'bg-muted/40',
                  )}
                >
                  <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {t.pos.cobro.cambio}
                  </p>
                  <p
                    aria-live="polite"
                    className={cn(
                      'tabular font-display text-5xl font-extrabold',
                      efectivo.recibido >= efectivo.monto && efectivo.recibido > 0
                        ? 'text-success'
                        : 'text-muted-foreground',
                    )}
                  >
                    {formatearCOP(efectivo.cambio)}
                  </p>
                </div>
              )}

              {lineas.length > 1 && (
                <p
                  className={cn(
                    'flex items-center gap-1.5 text-sm font-medium',
                    restante === 0 ? 'text-success' : 'text-destructive',
                  )}
                >
                  {restante === 0 ? (
                    <BadgeCheck aria-hidden="true" className="size-4" />
                  ) : (
                    <AlertCircle aria-hidden="true" className="size-4" />
                  )}
                  {restante === 0
                    ? t.pos.cobro.cuadra
                    : `${restante > 0 ? t.pos.cobro.pendiente : t.pos.cobro.sobra}: ${formatearCOP(Math.abs(restante))}`}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 lg:col-span-2">
              {(errorServidor ?? (propinaElegida ? bloqueo : null)) && (
                <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                  <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
                  {errorServidor ?? bloqueo}
                </p>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onCerrar}>
                  {t.pos.cobro.cancelar}
                </Button>
                <Button type="submit" size="lg" disabled={!puedeConfirmar || cobrar.isPending}>
                  {cobrar.isPending ? (
                    <>
                      <Loader2 aria-hidden="true" className="animate-spin" />
                      {t.pos.cobro.cobrando}
                    </>
                  ) : (
                    <>
                      {t.pos.cobro.confirmar} · <span className="tabular">{formatearCOP(aPagar)}</span>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Campo numérico que se edita con el teclado en pantalla (botón con etiqueta visible). */
function CampoMonto({
  etiqueta,
  valor,
  activo,
  onActivar,
}: {
  etiqueta: string;
  valor: number;
  activo: boolean;
  onActivar: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onActivar}
      className={cn(
        'flex min-h-14 w-full items-center justify-between rounded-lg border bg-card px-4 text-left outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring',
        activo ? 'border-primary ring-2 ring-primary/30' : 'hover:bg-muted/40',
      )}
    >
      <span className="text-sm font-medium text-muted-foreground">{etiqueta}</span>
      <span className="tabular text-2xl font-bold">{formatearCOP(valor)}</span>
    </button>
  );
}
