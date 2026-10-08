import { AlertCircle, Ban, Loader2, Plus, ReceiptText, ShoppingCart, StickyNote, UtensilsCrossed } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatearCOP, type Pedido, type TipoPedido } from '@mb/shared';
import { EmptyState } from '@/components/empty-state';
import { CategoryRail } from '@/components/pos/category-rail';
import { ProductTile } from '@/components/pos/product-tile';
import { TicketLine } from '@/components/pos/ticket-line';
import { TicketSummary } from '@/components/pos/ticket-summary';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useSesion } from '@/features/auth/session';
import { useEventStream } from '@/hooks/use-event-stream';
import { t } from '@/i18n/es';
import { ApiError } from '@/lib/api';
import { AnularPedidoDialog } from './anular-pedido-dialog';
import { CobroDialog, type CobroExitoso } from './cobro-dialog';
import { NotaItemDialog } from './nota-item-dialog';
import { PedidosActivosDialog } from './pedidos-activos-dialog';
import {
  claves,
  extraerFaltantes,
  useAgregarItem,
  useConfirmarPedido,
  useCrearPedido,
  useEditarItem,
  useMenu,
  useMesas,
  usePedido,
  usePedidosActivos,
  useQuitarItem,
  type FaltanteStock,
} from './queries';
import { ReciboDialog } from './recibo';

/** POS — venta (DESIGN §7.2). El pedido vive en el servidor; su id deriva de la URL (/pos/pedido/:id). */
export function PosPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const pedidoId = id ?? null;

  useEventStream(['pos']);

  const menu = useMenu();
  const mesas = useMesas();
  const pedidosActivosQ = usePedidosActivos();

  const [tipoLocal, setTipoLocal] = useState<TipoPedido>('MESA');
  const [mesaIdLocal, setMesaIdLocal] = useState('');
  const [categoriaSel, setCategoriaSel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [faltantes, setFaltantes] = useState<FaltanteStock[] | null>(null);
  const [cobrando, setCobrando] = useState(false);
  const [exito, setExito] = useState<CobroExitoso | null>(null);
  const { data: usuario } = useSesion();
  const esAdmin = usuario?.rol === 'ADMIN';
  const [mostrarActivos, setMostrarActivos] = useState(false);
  const [mostrarAnular, setMostrarAnular] = useState(false);
  const [itemParaNota, setItemParaNota] = useState<{ id: string; nombre: string; nota: string } | null>(null);

  const pedidoQ = usePedido(pedidoId);
  const pedido = pedidoId ? pedidoQ.data : undefined;
  const crear = useCrearPedido();
  const agregar = useAgregarItem();
  const editar = useEditarItem();
  const quitar = useQuitarItem();
  const confirmar = useConfirmarPedido();

  const tipo = pedido ? pedido.tipo : tipoLocal;
  const mesaId = pedido ? (pedido.mesa?.id ?? '') : mesaIdLocal;

  // Validación y redirección si el pedido no existe o ya está cerrado
  useEffect(() => {
    if (!pedidoId) return;

    if (pedidoQ.isError) {
      toast.error(t.pos.pedidoNoEncontrado);
      navigate('/pos', { replace: true });
      return;
    }

    if (pedido && pedido.estado === 'CERRADO') {
      toast.info(t.pos.pedidoYaCerrado);
      navigate('/pos', { replace: true });
    }
  }, [pedidoId, pedidoQ.isError, pedido, navigate]);

  // Serializa las operaciones para que toques rápidos no pisen versiones ni creen dos pedidos.
  const cola = useRef<Promise<unknown>>(Promise.resolve());
  function encolar(op: () => Promise<unknown>) {
    cola.current = cola.current.then(op).catch((err: unknown) => {
      if (err instanceof ApiError && err.codigo === 'MESA_OCUPADA') void qc.invalidateQueries({ queryKey: claves.mesas });
      setError(err instanceof Error ? err.message : t.pos.errorGenerico);
    });
  }

  const categorias = menu.data ?? [];
  const categoriaActiva = categorias.find((c) => c.id === categoriaSel) ?? categorias[0];
  const mesasLibres = (mesas.data ?? []).filter((m) => !m.ocupada);
  const pedidosActivos = pedidosActivosQ.data ?? [];
  const enEdicion = !pedido || pedido.estado === 'ABIERTO';

  function agregarProducto(productoId: string) {
    setError(null);
    if (!enEdicion) return;
    if (!pedidoId && tipo === 'MESA' && !mesaId) {
      setError(t.pos.elegirMesaPrimero);
      return;
    }
    encolar(async () => {
      let currentId = pedidoId;
      if (!currentId) {
        const nuevo = await crear.mutateAsync({ tipo, mesaId: tipo === 'MESA' ? mesaId : null });
        currentId = nuevo.id;
        navigate(`/pos/pedido/${currentId}`);
      }
      const actual = qc.getQueryData<Pedido>(claves.detalle(currentId));
      const linea = actual?.items.find((i) => i.productoId === productoId && !i.nota);
      if (linea && linea.cantidad < 99) {
        await editar.mutateAsync({ pedidoId: currentId, itemId: linea.id, cantidad: linea.cantidad + 1 });
      } else {
        await agregar.mutateAsync({ pedidoId: currentId, productoId, cantidad: 1 });
      }
    });
  }

  function cambiarCantidad(itemId: string, cantidad: number) {
    if (!pedidoId || cantidad < 1 || cantidad > 99) return;
    setError(null);
    const idItem = pedidoId;
    encolar(() => editar.mutateAsync({ pedidoId: idItem, itemId, cantidad }));
  }

  function quitarItem(itemId: string) {
    if (!pedidoId) return;
    setError(null);
    const idItem = pedidoId;
    encolar(() => quitar.mutateAsync({ pedidoId: idItem, itemId }));
  }

  function guardarNota(nuevaNota: string) {
    if (!pedidoId || !itemParaNota) return;
    const itemId = itemParaNota.id;
    const currentPedidoId = pedidoId;
    setItemParaNota(null);
    encolar(() =>
      editar.mutateAsync({
        pedidoId: currentPedidoId,
        itemId,
        nota: nuevaNota.trim() || null,
      }),
    );
  }

  function reiniciar() {
    setMesaIdLocal('');
    setError(null);
    navigate('/pos');
  }

  function enviarACocina() {
    if (!pedido) return;
    setError(null);
    confirmar.mutate(
      { pedidoId: pedido.id, version: pedido.version },
      {
        onSuccess: () => {
          toast.success(t.pos.enviadoACocina(pedido.numeroDia));
          reiniciar();
        },
        onError: (err) => {
          if (err instanceof ApiError && err.codigo === 'STOCK_INSUFICIENTE') {
            setFaltantes(extraerFaltantes(err.detalles));
          } else if (err instanceof ApiError && err.codigo === 'VERSION_CONFLICT') {
            setError(t.pos.conflicto);
            void qc.invalidateQueries({ queryKey: ['pedidos'] });
          } else {
            setError(err.message);
          }
        },
      },
    );
  }

  const items = pedido?.items ?? [];
  const cantidadProductos = items.reduce((a, i) => a + i.cantidad, 0);
  const total = items.reduce((a, i) => a + i.totalLinea, 0);
  const ocupado = confirmar.isPending || crear.isPending || agregar.isPending || editar.isPending || quitar.isPending;
  const esLlevar = (pedido?.tipo ?? tipo) === 'LLEVAR';
  const confirmado = pedido?.estado === 'CONFIRMADO';

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4 lg:h-dvh lg:min-h-0">
      <header className="flex flex-wrap items-end gap-4">
        <h1 className="font-display text-2xl font-bold">{t.pos.titulo}</h1>

        <div className="flex flex-col gap-1.5">
          <span id="tipo-lbl" className="text-sm font-medium">
            {t.pos.tipoPedido}
          </span>
          <ToggleGroup
            aria-labelledby="tipo-lbl"
            variant="outline"
            value={tipo}
            onValueChange={(v) => {
              if (!pedidoId && (v === 'MESA' || v === 'LLEVAR')) setTipoLocal(v);
            }}
          >
            <ToggleGroupItem value="MESA" disabled={!!pedidoId}>
              {t.pos.tipoMesa}
            </ToggleGroupItem>
            <ToggleGroupItem value="LLEVAR" disabled={!!pedidoId}>
              {t.pos.tipoLlevar}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {tipo === 'MESA' && !pedidoId && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mesa-sel">{t.pos.mesaLabel}</Label>
            <select
              id="mesa-sel"
              value={mesaId}
              onChange={(e) => {
                const val = e.target.value;
                const targetMesa = (mesas.data ?? []).find((m) => m.id === val);
                if (targetMesa?.ocupada && targetMesa.pedidoId) {
                  navigate(`/pos/pedido/${targetMesa.pedidoId}`);
                } else {
                  setMesaIdLocal(val);
                }
              }}
              className="h-12 min-w-56 rounded-md border border-input bg-card px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring"
            >
              <option value="">{mesasLibres.length ? t.pos.mesaPlaceholder : t.pos.sinMesasLibres}</option>
              {(mesas.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre} {m.ocupada ? `• ${t.pos.mesaOcupada}` : `(${t.pos.mesaLibre})`}
                </option>
              ))}
            </select>
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          className="h-12 min-h-12 gap-2 font-semibold"
          onClick={() => setMostrarActivos(true)}
        >
          <ReceiptText className="size-4" aria-hidden="true" />
          {t.pos.activos}
          {pedidosActivos.length > 0 && (
            <span className="tabular rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">
              {pedidosActivos.length}
            </span>
          )}
        </Button>

        {pedido && esAdmin && (pedido.estado === 'ABIERTO' || pedido.estado === 'CONFIRMADO') && (
          <Button
            type="button"
            variant="outline"
            className="h-12 min-h-12 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => setMostrarAnular(true)}
          >
            <Ban className="size-4" aria-hidden="true" />
            {t.pos.anular}
          </Button>
        )}

        {pedidoId && (
          <Button type="button" variant="outline" className="h-12 min-h-12 gap-1.5" onClick={reiniciar}>
            <Plus className="size-4" aria-hidden="true" />
            {t.pos.nuevoPedido}
          </Button>
        )}
      </header>

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 xl:flex-row">
          {menu.isPending ? (
            <p role="status" className="flex items-center gap-2 text-muted-foreground">
              <Loader2 aria-hidden="true" className="size-5 animate-spin" />
              {t.pos.cargandoMenu}
            </p>
          ) : menu.isError ? (
            <EmptyState
              icon={AlertCircle}
              titulo={t.pos.errorMenu}
              descripcion=""
              className="w-full"
              accion={<Button onClick={() => void menu.refetch()}>{t.pos.reintentar}</Button>}
            />
          ) : (
            <>
              <CategoryRail
                className="hidden xl:flex"
                categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
                categoriaSeleccionada={categoriaActiva?.id ?? ''}
                onSeleccionar={setCategoriaSel}
              />
              <ToggleGroup
                aria-label="Categorías de productos"
                variant="outline"
                value={categoriaActiva?.id ?? ''}
                onValueChange={(v) => v && setCategoriaSel(v)}
                className="shrink-0 overflow-x-auto xl:hidden"
              >
                {categorias.map((c) => (
                  <ToggleGroupItem key={c.id} value={c.id} className="shrink-0">
                    {c.nombre}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {categoriaActiva && categoriaActiva.productos.length > 0 ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(8.75rem,1fr))] gap-3">
                    {categoriaActiva.productos.map((p) => (
                      <ProductTile
                        key={p.id}
                        nombre={p.nombre}
                        precio={p.precio}
                        agotado={p.agotado || !enEdicion}
                        onClick={() => agregarProducto(p.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={UtensilsCrossed}
                    titulo={t.pos.sinProductos}
                    descripcion={t.pos.sinProductosDescripcion}
                  />
                )}
              </div>
            </>
          )}
        </div>

        <aside
          aria-label="Ticket"
          className="flex w-[22rem] shrink-0 flex-col gap-3 overflow-hidden rounded-xl border bg-card/50 p-3"
        >
          <h2 className="font-display text-lg font-bold">
            {pedido ? t.pos.pedido(pedido.numeroDia) : t.pos.pedidoNuevo}
            {pedido?.mesa ? ` · ${pedido.mesa.nombre}` : esLlevar && pedido ? ` · ${t.pos.tipoLlevar}` : ''}
          </h2>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            {items.length === 0 ? (
              <EmptyState icon={ShoppingCart} titulo={t.pos.pedidoNuevo} descripcion={t.pos.pedidoNuevoDescripcion} className="p-6" />
            ) : confirmado ? (
              <>
                <p className="text-sm text-muted-foreground">{t.pos.soloLectura}</p>
                {items.map((i) => (
                  <div key={i.id} className="flex flex-col gap-1 rounded-lg border bg-card p-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <span>
                        <span className="tabular font-bold">{i.cantidad}×</span> {i.nombre}
                      </span>
                      <span className="tabular font-semibold">{formatearCOP(i.totalLinea)}</span>
                    </div>
                    {i.nota && (
                      <div className="flex items-center gap-1.5 rounded-md bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                        <StickyNote className="size-3 shrink-0 text-accent" aria-hidden="true" />
                        <span className="italic">{i.nota}</span>
                      </div>
                    )}
                  </div>
                ))}
              </>
            ) : (
              items.map((i) => (
                <TicketLine
                  key={i.id}
                  id={i.id}
                  nombre={i.nombre}
                  precioUnitario={i.precioUnitario}
                  cantidad={i.cantidad}
                  nota={i.nota ?? undefined}
                  onIncrementar={() => cambiarCantidad(i.id, i.cantidad + 1)}
                  onDecrementar={() => cambiarCantidad(i.id, i.cantidad - 1)}
                  onEliminar={() => quitarItem(i.id)}
                  onEditarNota={enEdicion ? () => setItemParaNota({ id: i.id, nombre: i.nombre, nota: i.nota ?? '' }) : undefined}
                />
              ))
            )}
          </div>
          {error && (
            <p role="alert" className="flex items-start gap-1.5 text-sm font-medium text-destructive">
              <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}
          <TicketSummary
            cantidadProductos={cantidadProductos}
            total={total}
            deshabilitado={!pedido || ocupado}
            textoAccionPrincipal={esLlevar || confirmado ? t.pos.cobrar : t.pos.enviarCocina}
            onAccionPrincipal={() => (esLlevar || confirmado ? setCobrando(true) : enviarACocina())}
            textoAccionSecundaria={!esLlevar && !confirmado ? t.pos.cobrar : undefined}
            onAccionSecundaria={() => setCobrando(true)}
          />
          {pedido && esAdmin && (pedido.estado === 'ABIERTO' || pedido.estado === 'CONFIRMADO') && (
            <Button
              type="button"
              variant="outline"
              className="h-12 min-h-12 w-full gap-2 font-semibold text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => setMostrarAnular(true)}
            >
              <Ban className="size-4" aria-hidden="true" />
              {t.pos.anular}
            </Button>
          )}
        </aside>
      </div>

      {mostrarAnular && pedido && (
        <AnularPedidoDialog
          pedido={pedido}
          abierto={mostrarAnular}
          onCerrar={() => setMostrarAnular(false)}
          onAnulado={() => {
            setMostrarAnular(false);
            reiniciar();
          }}
        />
      )}

      {cobrando && pedido && (
        <CobroDialog
          pedido={pedido}
          onCerrar={() => setCobrando(false)}
          onCobrado={(r) => {
            setCobrando(false);
            setExito(r);
            navigate('/pos');
          }}
        />
      )}
      {exito && <ReciboDialog exito={exito} onCerrar={() => setExito(null)} />}

      {itemParaNota && (
        <NotaItemDialog
          key={`${itemParaNota.id}:${itemParaNota.nota}`}
          abierto={!!itemParaNota}
          nombreProducto={itemParaNota.nombre}
          notaInicial={itemParaNota.nota}
          guardando={editar.isPending}
          onGuardar={guardarNota}
          onCerrar={() => setItemParaNota(null)}
        />
      )}

      <PedidosActivosDialog
        abierto={mostrarActivos}
        pedidos={pedidosActivos}
        mesas={mesas.data ?? []}
        onCerrar={() => setMostrarActivos(false)}
        onSeleccionarPedido={(pId) => {
          setMostrarActivos(false);
          navigate(`/pos/pedido/${pId}`);
        }}
        onSeleccionarMesaLibre={(mId) => {
          setMostrarActivos(false);
          setTipoLocal('MESA');
          setMesaIdLocal(mId);
          if (pedidoId) navigate('/pos');
        }}
      />

      <AlertDialog open={faltantes !== null} onOpenChange={(a) => !a && setFaltantes(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.pos.stockTitulo}</AlertDialogTitle>
            <AlertDialogDescription>{t.pos.stockDescripcion}</AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="flex flex-col gap-1.5 text-sm">
            {faltantes?.map((f) => (
              <li key={f.nombre} className="tabular flex items-center gap-2">
                <AlertCircle aria-hidden="true" className="size-4 shrink-0 text-destructive" />
                {t.pos.stockLinea(f.nombre, f.requerido, f.disponible, f.unidad)}
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.pos.entendido}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
