import { AlertCircle, ChefHat, Loader2, LogOut, RotateCcw, Wifi, WifiOff, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Comanda, EstadoComanda } from '@mb/shared';
import { Logo } from '@/components/brand/logo';
import { EmptyState } from '@/components/empty-state';
import { KdsTicketCard } from '@/components/kds/kds-ticket-card';
import { Button } from '@/components/ui/button';
import { useLogout, useSesion } from '@/features/auth/session';
import { useEventStream } from '@/hooks/use-event-stream';
import { t } from '@/i18n/es';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

type Columna = 'PENDIENTE' | 'EN_PREPARACION' | 'LISTA';
const COLUMNAS: { estado: Columna; titulo: string; accion: 'iniciar' | 'lista' | 'entregar'; texto: string }[] = [
  { estado: 'PENDIENTE', titulo: t.cocinaKds.pendientes, accion: 'iniciar', texto: t.cocinaKds.iniciar },
  { estado: 'EN_PREPARACION', titulo: t.cocinaKds.preparando, accion: 'lista', texto: t.cocinaKds.marcarLista },
  { estado: 'LISTA', titulo: t.cocinaKds.listas, accion: 'entregar', texto: t.cocinaKds.entregada },
];

function extraerLista(data: unknown): Comanda[] {
  if (Array.isArray(data)) return data as Comanda[];
  if (data !== null && typeof data === 'object' && 'items' in data && Array.isArray(data.items)) {
    return data.items as Comanda[];
  }
  return [];
}

/** Reloj de 1 s para los temporizadores (el valor `now` entra por estado, no por render impuro). */
function useAhora(): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return ahora;
}

/** KDS: pantalla completa en tema oscuro (DESIGN.md §7.4). */
export function CocinaPage() {
  const { data: usuario } = useSesion();
  const logout = useLogout();
  const qc = useQueryClient();
  const ahora = useAhora();
  const stream = useEventStream(['cocina']);
  const [ultimaTransicion, setUltimaTransicion] = useState<{
    id: string;
    numeroDia: number;
    version: number;
    expiraAt: number;
  } | null>(null);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    return () => document.documentElement.classList.remove('dark');
  }, []);

  const comandas = useQuery({
    queryKey: ['comandas', 'activas'],
    queryFn: async () => extraerLista(await api<unknown>('/comandas?activas=true')),
    refetchInterval: 10_000, // respaldo si SSE se cae
  });

  const avanzar = useMutation({
    mutationFn: ({ id, accion, version }: { id: string; accion: string; version: number }) =>
      api<Comanda>(`/comandas/${id}/${accion}`, { method: 'POST', body: { version } }),
    onSuccess: (comandaActualizada) => {
      setUltimaTransicion({
        id: comandaActualizada.id,
        numeroDia: comandaActualizada.numeroDia,
        version: comandaActualizada.version,
        expiraAt: Date.now() + 10_000,
      });
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['comandas'] }),
    onError: (err) =>
      toast.error(
        err instanceof ApiError && err.codigo === 'VERSION_CONFLICT' ? t.cocinaKds.conflicto : t.cocinaKds.errorAvanzar,
      ),
  });

  const deshacer = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      api<Comanda>(`/comandas/${id}/deshacer`, { method: 'POST', body: { version } }),
    onSuccess: () => {
      toast.success(t.cocinaKds.deshechoExito);
      setUltimaTransicion(null);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['comandas'] }),
    onError: (err) => {
      if (err instanceof ApiError && err.codigo === 'TIEMPO_EXPIRADO') {
        toast.error(t.cocinaKds.deshacerExpirado);
      } else {
        toast.error(t.cocinaKds.errorDeshacer);
      }
      setUltimaTransicion(null);
    },
  });

  const transicionActiva =
    ultimaTransicion && ahora < ultimaTransicion.expiraAt ? ultimaTransicion : null;
  const segundosRestantes = transicionActiva
    ? Math.max(0, Math.ceil((transicionActiva.expiraAt - ahora) / 1000))
    : 0;

  const lista = (comandas.data ?? [])
    .filter((c) => (['PENDIENTE', 'EN_PREPARACION', 'LISTA'] as EstadoComanda[]).includes(c.estado))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt)); // FIFO

  const estadoConexion = stream.conectado
    ? { icono: Wifi, texto: t.cocinaKds.conectado, clase: 'text-success', girar: false }
    : stream.conectando
      ? { icono: Loader2, texto: t.cocinaKds.conectando, clase: 'text-muted-foreground', girar: true }
      : stream.reconectando
        ? { icono: WifiOff, texto: t.cocinaKds.reconectando, clase: 'text-warning', girar: false }
        : { icono: WifiOff, texto: t.cocinaKds.desconectado, clase: 'text-destructive', girar: false };
  const IconoConexion = estadoConexion.icono;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 border-b px-6 py-4">
        <Logo />
        <div className="flex items-center gap-4">
          <span role="status" className={cn('flex items-center gap-1.5 text-sm font-semibold', estadoConexion.clase)}>
            <IconoConexion aria-hidden="true" className={cn('size-4', estadoConexion.girar && 'animate-spin')} />
            {estadoConexion.texto}
          </span>
          <span className="hidden text-muted-foreground sm:inline">{usuario?.nombre}</span>
          <Button variant="outline" onClick={() => logout.mutate()} disabled={logout.isPending}>
            <LogOut aria-hidden="true" />
            {t.nav.cerrarSesion}
          </Button>
        </div>
      </header>

      <main id="contenido" className="flex-1 p-4">
        {comandas.isPending ? (
          <p role="status" className="flex items-center gap-2 text-muted-foreground">
            <Loader2 aria-hidden="true" className="size-5 animate-spin" />
            {t.cocinaKds.cargando}
          </p>
        ) : comandas.isError ? (
          <EmptyState
            icon={AlertCircle}
            titulo={t.cocinaKds.errorCarga}
            descripcion=""
            accion={<Button onClick={() => void comandas.refetch()}>{t.cocinaKds.reintentar}</Button>}
          />
        ) : lista.length === 0 ? (
          <EmptyState
            icon={ChefHat}
            titulo={t.cocina.sinComandas}
            descripcion={t.cocina.sinComandasDescripcion}
            className="mx-auto max-w-xl"
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {COLUMNAS.map((col) => {
              const delaColumna = lista.filter((c) => c.estado === col.estado);
              return (
                <section key={col.estado} aria-label={col.titulo} className="flex flex-col gap-3">
                  <h2 className="font-display text-xl font-bold tracking-wide uppercase">
                    {col.titulo} <span className="tabular text-muted-foreground">({delaColumna.length})</span>
                  </h2>
                  {delaColumna.length === 0 && (
                    <p className="rounded-lg border border-dashed p-4 text-muted-foreground">{t.cocinaKds.vacioColumna}</p>
                  )}
                  {delaColumna.map((c) => (
                    <KdsTicketCard
                      key={c.id}
                      numeroPedido={c.numeroDia}
                      tipo={c.tipoPedido}
                      mesa={c.mesaNombre?.replace(/^Mesa\s+/i, '') ?? undefined}
                      tiempoSegundos={Math.max(0, Math.floor((ahora - new Date(c.createdAt).getTime()) / 1000))}
                      items={c.items.map((i) => ({ cantidad: i.cantidad, nombre: i.nombre, nota: i.nota ?? undefined }))}
                      estado={col.estado}
                      textoAvanzar={col.texto}
                      deshabilitado={avanzar.isPending || deshacer.isPending}
                      onAvanzar={() => avanzar.mutate({ id: c.id, accion: col.accion, version: c.version })}
                    />
                  ))}
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* Barra flotante para deshacer última transición (RN-22, DESIGN.md §7.4) */}
      {transicionActiva && segundosRestantes > 0 && (
        <aside
          role="status"
          aria-label={t.cocinaKds.deshacer}
          className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-2xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 duration-200"
        >
          <div className="flex flex-col px-1">
            <span className="text-sm font-semibold text-card-foreground">
              #{String(transicionActiva.numeroDia).padStart(3, '0')}
            </span>
            <span className="text-xs text-muted-foreground">
              {segundosRestantes}s
            </span>
          </div>
          <Button
            variant="secondary"
            size="default"
            onClick={() => deshacer.mutate({ id: transicionActiva.id, version: transicionActiva.version })}
            disabled={deshacer.isPending}
            aria-label={t.cocinaKds.deshacerAria(segundosRestantes)}
            className="h-12 min-h-12 min-w-12 gap-2 px-4 text-base font-semibold"
          >
            {deshacer.isPending ? (
              <Loader2 aria-hidden="true" className="size-5 animate-spin" />
            ) : (
              <RotateCcw aria-hidden="true" className="size-5" />
            )}
            {t.cocinaKds.deshacerConCuenta(segundosRestantes)}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setUltimaTransicion(null)}
            aria-label={t.cocinaKds.descartar}
            className="h-12 min-h-12 w-12 min-w-12 text-muted-foreground hover:text-foreground"
          >
            <X aria-hidden="true" className="size-5" />
          </Button>
        </aside>
      )}
    </div>
  );
}
