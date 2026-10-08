import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertOctagon,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleSlash,
  Clock,
  DollarSign,
  Package,
  Receipt,
  ShoppingBag,
  TriangleAlert,
} from 'lucide-react';
import { Link } from 'react-router';
import {
  formatearCOP,
  type Alerta,
  type AlertasRespuesta,
} from '@mb/shared';
import { KpiTile } from '@/components/admin/kpi-tile';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { t } from '@/i18n/es';
import { api } from '@/lib/api';
import { CabeceraPagina, EstadoError, PaginaAdmin, Skeleton, TablaSkeleton } from './components/campos';
import { formatearFechaHora, formatearNumero } from './lib';

// Tipos locales del contrato de GET /admin/dashboard y GET /admin/eventos (docs/API.md).
interface DashboardDto {
  ventasTotal?: number;
  pedidosCerrados?: number;
  ticketPromedio?: number;
  topProductos?: { nombre: string; unidades: number; monto: number }[];
}
interface EventoDto {
  id: string | number;
  tipo: string;
  modulo: string;
  fecha: string;
  payload?: Record<string, unknown> | null;
}

const td = t.admin.dashboard;
const ta = t.admin.alertas;

function resumenPayload(payload: EventoDto['payload']): string {
  if (!payload) return '—';
  const partes = Object.entries(payload)
    .filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${String(v)}`);
  return partes.length > 0 ? partes.join(' · ') : '—';
}

function renderMensajeAlerta(alerta: Alerta): string {
  switch (alerta.tipo) {
    case 'PEDIDO_OLVIDADO':
      return ta.pedidoOlvidadoMensaje(alerta.datos.numeroDia, alerta.datos.mesaNombre);
    case 'INGREDIENTE_BAJO_MINIMO':
      return ta.ingredienteBajoMinimoMensaje(
        alerta.datos.nombre,
        alerta.datos.stockActual,
        alerta.datos.stockMinimo,
        alerta.datos.unidad,
      );
    case 'INGREDIENTE_AGOTADO':
      return ta.ingredienteAgotadoMensaje(alerta.datos.nombre);
    case 'PRODUCTO_AGOTADO':
      return ta.productoAgotadoMensaje(alerta.datos.nombre);
  }
}

function enlaceAlerta(alerta: Alerta): { to: string; texto: string } {
  switch (alerta.tipo) {
    case 'PEDIDO_OLVIDADO':
      return { to: '/pos', texto: ta.irAPos };
    case 'INGREDIENTE_BAJO_MINIMO':
    case 'INGREDIENTE_AGOTADO':
      return { to: '/admin/inventario', texto: ta.irAInventario };
    case 'PRODUCTO_AGOTADO':
      return { to: '/admin/productos', texto: ta.irAProductos };
  }
}

export function DashboardPage() {
  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardDto>('/admin/dashboard'),
    retry: false,
  });

  const alertasQuery = useQuery({
    queryKey: ['admin-alertas'],
    queryFn: () => api<AlertasRespuesta>('/admin/alertas'),
    refetchInterval: 15000,
  });

  const eventos = useQuery({
    queryKey: ['eventos'],
    queryFn: () => api<{ items: EventoDto[] }>('/admin/eventos'),
    retry: false,
  });

  const d = dashboard.data;
  const alertas = alertasQuery.data?.items ?? [];

  const pedidosOlvidados = alertas.filter((a) => a.tipo === 'PEDIDO_OLVIDADO');
  const ingredientesBajos = alertas.filter((a) => a.tipo === 'INGREDIENTE_BAJO_MINIMO');
  const ingredientesAgotados = alertas.filter((a) => a.tipo === 'INGREDIENTE_AGOTADO');
  const productosAgotados = alertas.filter((a) => a.tipo === 'PRODUCTO_AGOTADO');

  return (
    <PaginaAdmin>
      <CabeceraPagina titulo={td.titulo} descripcion={td.descripcion} />

      {dashboard.isPending ? (
        <div role="status" className="grid gap-4 sm:grid-cols-3">
          <span className="sr-only">{t.admin.comun.cargando}</span>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : dashboard.isError ? (
        <EstadoError
          titulo={td.noDisponible}
          descripcion={td.noDisponibleDescripcion}
          onReintentar={() => void dashboard.refetch()}
          reintentando={dashboard.isFetching}
        />
      ) : (
        <>
          <section aria-label="KPIs" className="grid gap-4 sm:grid-cols-3">
            <KpiTile titulo={td.kpiVentas} valor={formatearCOP(d?.ventasTotal ?? 0)} icono={DollarSign} />
            <KpiTile titulo={td.kpiPedidos} valor={formatearNumero(d?.pedidosCerrados ?? 0)} icono={ShoppingBag} />
            <KpiTile titulo={td.kpiTicket} valor={formatearCOP(d?.ticketPromedio ?? 0)} icono={Receipt} />
          </section>

          {/* Widget de Alertas (RN-17, RN-36) */}
          <section aria-labelledby="alertas-titulo" className="space-y-4 rounded-lg border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <div className="flex items-center gap-3">
                <AlertOctagon aria-hidden="true" className="size-5 text-primary" />
                <h2 id="alertas-titulo" className="font-display text-xl font-bold">
                  {ta.titulo}
                </h2>
              </div>
              <Badge variant={alertas.length > 0 ? 'destructive' : 'secondary'} className="gap-1 px-3 py-1 text-sm font-semibold">
                {alertas.length > 0 ? (
                  <>
                    <TriangleAlert aria-hidden="true" className="size-3.5" />
                    {alertas.length} {alertas.length === 1 ? 'alerta activa' : 'alertas activas'}
                  </>
                ) : (
                  <>
                    <CheckCircle2 aria-hidden="true" className="size-3.5 text-success" />
                    {ta.sinAlertas}
                  </>
                )}
              </Badge>
            </div>

            {alertasQuery.isPending ? (
              <div role="status" className="grid gap-3 sm:grid-cols-4">
                <span className="sr-only">{t.admin.comun.cargando}</span>
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : alertas.length === 0 ? (
              <div className="flex items-center gap-4 rounded-md border border-success/30 bg-success/5 p-4 text-success">
                <CheckCircle2 aria-hidden="true" className="size-6 shrink-0" />
                <div>
                  <p className="font-semibold">{ta.sinAlertas}</p>
                  <p className="text-sm opacity-90">{ta.sinAlertasDescripcion}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Resumen de conteo por tipo con enlaces a la entidad (icono + texto, nunca solo color) */}
                <div role="group" aria-label="Conteo de alertas por tipo" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Pedidos olvidados */}
                  <Link
                    to="/pos"
                    className="flex min-h-12 items-center justify-between rounded-md border bg-background p-3 transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring outline-none"
                  >
                    <div className="flex items-center gap-2">
                      <Clock aria-hidden="true" className="size-4 text-warning" />
                      <span className="text-sm font-medium">Pedidos olvidados</span>
                    </div>
                    <Badge variant={pedidosOlvidados.length > 0 ? 'warning' : 'secondary'}>
                      {pedidosOlvidados.length}
                    </Badge>
                  </Link>

                  {/* Stock bajo mínimo */}
                  <Link
                    to="/admin/inventario"
                    className="flex min-h-12 items-center justify-between rounded-md border bg-background p-3 transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring outline-none"
                  >
                    <div className="flex items-center gap-2">
                      <TriangleAlert aria-hidden="true" className="size-4 text-warning" />
                      <span className="text-sm font-medium">Stock bajo</span>
                    </div>
                    <Badge variant={ingredientesBajos.length > 0 ? 'warning' : 'secondary'}>
                      {ingredientesBajos.length}
                    </Badge>
                  </Link>

                  {/* Ingredientes agotados */}
                  <Link
                    to="/admin/inventario"
                    className="flex min-h-12 items-center justify-between rounded-md border bg-background p-3 transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring outline-none"
                  >
                    <div className="flex items-center gap-2">
                      <CircleSlash aria-hidden="true" className="size-4 text-destructive" />
                      <span className="text-sm font-medium">Ingredientes agotados</span>
                    </div>
                    <Badge variant={ingredientesAgotados.length > 0 ? 'destructive' : 'secondary'}>
                      {ingredientesAgotados.length}
                    </Badge>
                  </Link>

                  {/* Productos agotados */}
                  <Link
                    to="/admin/productos"
                    className="flex min-h-12 items-center justify-between rounded-md border bg-background p-3 transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring outline-none"
                  >
                    <div className="flex items-center gap-2">
                      <Package aria-hidden="true" className="size-4 text-destructive" />
                      <span className="text-sm font-medium">Productos agotados</span>
                    </div>
                    <Badge variant={productosAgotados.length > 0 ? 'destructive' : 'secondary'}>
                      {productosAgotados.length}
                    </Badge>
                  </Link>
                </div>

                {/* Lista de alertas con detalle y enlace de acción directa */}
                <div className="divide-y rounded-md border bg-background">
                  {alertas.slice(0, 8).map((alerta) => {
                    const enlace = enlaceAlerta(alerta);
                    const esCritica = alerta.severidad === 'CRITICA';

                    return (
                      <div
                        key={`${alerta.tipo}-${alerta.entidadId}`}
                        className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-start gap-3">
                          {esCritica ? (
                            <AlertOctagon aria-hidden="true" className="size-5 shrink-0 text-destructive mt-0.5" />
                          ) : (
                            <TriangleAlert aria-hidden="true" className="size-5 shrink-0 text-warning mt-0.5" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant={esCritica ? 'destructive' : 'warning'} className="text-xs">
                                {esCritica ? ta.severidadCritica : ta.severidadAdvertencia}
                              </Badge>
                              <span className="font-semibold text-sm text-foreground">
                                {alerta.tipo === 'PEDIDO_OLVIDADO'
                                  ? 'Pedido olvidado'
                                  : alerta.tipo === 'INGREDIENTE_BAJO_MINIMO'
                                  ? 'Stock bajo'
                                  : alerta.tipo === 'INGREDIENTE_AGOTADO'
                                  ? 'Ingrediente agotado'
                                  : 'Producto agotado'}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">{renderMensajeAlerta(alerta)}</p>
                          </div>
                        </div>

                        <Button asChild variant="outline" size="sm" className="h-9 shrink-0 gap-1.5 self-end sm:self-center">
                          <Link to={enlace.to}>
                            {enlace.texto}
                            <ArrowRight aria-hidden="true" className="size-3.5" />
                          </Link>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <section aria-labelledby="top-titulo" className="space-y-3">
            <h2 id="top-titulo" className="font-display text-xl font-bold">
              {td.topTitulo}
            </h2>
            {(d?.topProductos ?? []).length === 0 ? (
              <EmptyState icon={BarChart3} titulo={td.topVacio} descripcion={td.topVacioDescripcion} />
            ) : (
              <div className="rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">{td.colProducto}</TableHead>
                      <TableHead scope="col" className="text-right">
                        {td.colUnidades}
                      </TableHead>
                      <TableHead scope="col" className="text-right">
                        {td.colMonto}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(d?.topProductos ?? []).slice(0, 5).map((p) => (
                      <TableRow key={p.nombre}>
                        <TableCell className="font-medium">{p.nombre}</TableCell>
                        <TableCell className="tabular text-right">{formatearNumero(p.unidades)}</TableCell>
                        <TableCell className="tabular text-right">{formatearCOP(p.monto)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </>
      )}

      <section aria-labelledby="eventos-titulo" className="space-y-3">
        <div>
          <h2 id="eventos-titulo" className="font-display text-xl font-bold">
            {td.eventosTitulo}
          </h2>
          <p className="text-sm text-muted-foreground">{td.eventosDescripcion}</p>
        </div>
        {eventos.isPending ? (
          <TablaSkeleton filas={4} />
        ) : eventos.isError ? (
          <EstadoError
            titulo={td.noDisponible}
            descripcion={td.noDisponibleDescripcion}
            onReintentar={() => void eventos.refetch()}
            reintentando={eventos.isFetching}
          />
        ) : eventos.data.items.length === 0 ? (
          <EmptyState icon={Activity} titulo={td.eventosVacio} descripcion={td.eventosVacioDescripcion} />
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{td.colCuando}</TableHead>
                  <TableHead scope="col">{td.colEvento}</TableHead>
                  <TableHead scope="col">{td.colModulo}</TableHead>
                  <TableHead scope="col">{td.colDetalle}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventos.data.items.slice(0, 10).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="tabular whitespace-nowrap">{formatearFechaHora(e.fecha)}</TableCell>
                    <TableCell className="font-medium">{e.tipo}</TableCell>
                    <TableCell>{e.modulo}</TableCell>
                    <TableCell className="text-muted-foreground">{resumenPayload(e.payload)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </PaginaAdmin>
  );
}
