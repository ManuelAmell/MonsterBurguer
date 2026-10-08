import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CreditCard,
  Download,
  Package,
  Receipt,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import {
  fechaOperativa,
  formatearCOP,
  type AgrupacionReporteVentas,
  type ReporteVentasRespuesta,
} from '@mb/shared';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { t } from '@/i18n/es';
import { api } from '@/lib/api';
import { CabeceraPagina, EstadoError, PaginaAdmin, Skeleton, TablaSkeleton } from './components/campos';
import { formatearNumero } from './lib';

type PresetRango = 'hoy' | '7dias' | 'mes' | 'personalizado';

const tr = t.admin.reportes;

function calcularPresets(preset: PresetRango): { desde: string; hasta: string } {
  const hoyStr = fechaOperativa(new Date());
  if (preset === 'hoy') {
    return { desde: hoyStr, hasta: hoyStr };
  }
  if (preset === '7dias') {
    const d = new Date(`${hoyStr}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 6);
    const desdeStr = d.toISOString().slice(0, 10);
    return { desde: desdeStr, hasta: hoyStr };
  }
  if (preset === 'mes') {
    const desdeStr = `${hoyStr.slice(0, 7)}-01`;
    return { desde: desdeStr, hasta: hoyStr };
  }
  return { desde: hoyStr, hasta: hoyStr };
}

export function ReportesPage() {
  const [preset, setPreset] = useState<PresetRango>('hoy');
  const [rango, setRango] = useState<{ desde: string; hasta: string }>(() => calcularPresets('hoy'));
  const [agrupar, setAgrupar] = useState<AgrupacionReporteVentas>('dia');
  const [descargandoCsv, setDescargandoCsv] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<{ fecha: string; ventas: number; pedidos: number } | null>(null);

  const { desde, hasta } = rango;

  // Validación de rango
  const rangoValido = desde <= hasta;
  const diasDiferencia = Math.round(
    (new Date(`${hasta}T00:00:00Z`).getTime() - new Date(`${desde}T00:00:00Z`).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  const rangoEnLimite = diasDiferencia <= 92;

  // Query principal del reporte según agrupación
  const reporteQuery = useQuery({
    queryKey: ['admin-reportes-ventas', desde, hasta, agrupar],
    queryFn: () =>
      api<ReporteVentasRespuesta>(`/admin/reportes/ventas?desde=${desde}&hasta=${hasta}&agrupar=${agrupar}`),
    enabled: rangoValido && rangoEnLimite,
  });

  // Query de ventas por día para el gráfico (siempre agrupado por día para graficar la evolución)
  const reporteDiaQuery = useQuery({
    queryKey: ['admin-reportes-ventas-grafico', desde, hasta],
    queryFn: () => api<ReporteVentasRespuesta>(`/admin/reportes/ventas?desde=${desde}&hasta=${hasta}&agrupar=dia`),
    enabled: rangoValido && rangoEnLimite,
  });

  const cambiarPreset = (nuevoPreset: PresetRango) => {
    setPreset(nuevoPreset);
    if (nuevoPreset !== 'personalizado') {
      setRango(calcularPresets(nuevoPreset));
    }
  };

  const handleDescargarCsv = async () => {
    try {
      setDescargandoCsv(true);
      const res = await fetch(`/api/v1/admin/reportes/ventas.csv?desde=${desde}&hasta=${hasta}&agrupar=${agrupar}`, {
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('Error al generar CSV');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-ventas-${desde}-a-${hasta}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // toast or fallback
    } finally {
      setDescargandoCsv(false);
    }
  };

  const data = reporteQuery.data;
  const itemsDia = reporteDiaQuery.data?.items ?? [];

  // Calcular escala para el gráfico SVG
  const maxVentas = Math.max(1, ...itemsDia.map((i) => i.ventas));
  const svgHeight = 160;
  const svgWidth = Math.max(400, itemsDia.length * 50);

  return (
    <PaginaAdmin>
      <CabeceraPagina
        titulo={tr.titulo}
        descripcion={tr.descripcion}
        acciones={
          <Button
            onClick={() => void handleDescargarCsv()}
            disabled={descargandoCsv || !reporteQuery.data || reporteQuery.data.items.length === 0}
            className="h-12 px-5 gap-2"
          >
            <Download aria-hidden="true" className="size-5" />
            {descargandoCsv ? tr.exportando : tr.exportarCsv}
          </Button>
        }
      />

      {/* Controles de Filtros: Rango de Fechas y Agrupación */}
      <section aria-labelledby="filtros-titulo" className="grid gap-6 rounded-lg border bg-card p-5">
        <h2 id="filtros-titulo" className="sr-only">
          {tr.rango}
        </h2>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          {/* Selector de Presets */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">{tr.rango}</Label>
            <div role="group" aria-label={tr.rango} className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'hoy', label: tr.rangoHoy },
                  { id: '7dias', label: tr.rango7Dias },
                  { id: 'mes', label: tr.rangoMesActual },
                  { id: 'personalizado', label: tr.rangoPersonalizado },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => cambiarPreset(id)}
                  aria-pressed={preset === id}
                  className={`min-h-12 rounded-md px-4 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring ${
                    preset === id
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'border border-input bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Inputs de fecha personalizada */}
          {preset === 'personalizado' && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="desde-input" className="text-xs text-muted-foreground">
                  {tr.desde}
                </Label>
                <Input
                  id="desde-input"
                  type="date"
                  value={desde}
                  onChange={(e) => setRango((r) => ({ ...r, desde: e.target.value }))}
                  className="h-12 w-40"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hasta-input" className="text-xs text-muted-foreground">
                  {tr.hasta}
                </Label>
                <Input
                  id="hasta-input"
                  type="date"
                  value={hasta}
                  onChange={(e) => setRango((r) => ({ ...r, hasta: e.target.value }))}
                  className="h-12 w-40"
                />
              </div>
            </div>
          )}
        </div>

        {(!rangoValido || !rangoEnLimite) && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {tr.errorRango}
          </p>
        )}

        {/* Selector de Agrupación */}
        <div className="space-y-2 border-t pt-4">
          <Label className="text-sm font-medium text-foreground">{tr.agrupacion}</Label>
          <div role="group" aria-label={tr.agrupacion} className="flex flex-wrap gap-2">
            {(
              [
                { id: 'dia', label: tr.agruparDia, icon: Calendar },
                { id: 'producto', label: tr.agruparProducto, icon: Package },
                { id: 'metodo', label: tr.agruparMetodo, icon: CreditCard },
                { id: 'cajero', label: tr.agruparCajero, icon: User },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setAgrupar(id)}
                aria-pressed={agrupar === id}
                className={`flex min-h-12 items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring ${
                  agrupar === id
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'border border-input bg-background text-foreground hover:bg-muted'
                }`}
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Estados de Carga y Error */}
      {reporteQuery.isPending ? (
        <div className="space-y-6">
          <div role="status" className="grid gap-4 sm:grid-cols-4">
            <span className="sr-only">{t.admin.comun.cargando}</span>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-56" />
          <TablaSkeleton filas={5} />
        </div>
      ) : reporteQuery.isError ? (
        <EstadoError
          titulo={t.admin.dashboard.noDisponible}
          descripcion={t.admin.dashboard.noDisponibleDescripcion}
          onReintentar={() => void reporteQuery.refetch()}
          reintentando={reporteQuery.isFetching}
        />
      ) : (
        <>
          {/* Tarjetas de Totales del Período */}
          <section aria-label={tr.totalesTitulo} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Wallet aria-hidden="true" className="size-4 text-primary" />
                  {tr.totalVentas}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-display text-2xl font-bold tabular">
                  {formatearCOP(data?.totales.ventas ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Sin incluir propinas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Receipt aria-hidden="true" className="size-4 text-primary" />
                  {tr.totalPropinas}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-display text-2xl font-bold tabular">
                  {formatearCOP(data?.totales.propinas ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Propinas voluntarias</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users aria-hidden="true" className="size-4 text-primary" />
                  {tr.totalPedidos}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-display text-2xl font-bold tabular">
                  {formatearNumero(data?.totales.pedidos ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Pedidos cerrados</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BarChart3 aria-hidden="true" className="size-4 text-primary" />
                  {tr.colTicketPromedio}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-display text-2xl font-bold tabular">
                  {formatearCOP(data?.totales.ticketPromedio ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Ventas / pedidos</p>
              </CardContent>
            </Card>
          </section>

          {/* Sección de Pedidos Anulados si los hay */}
          {(data?.totales.anulados.cantidad ?? 0) > 0 && (
            <div
              role="status"
              className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle aria-hidden="true" className="size-5 shrink-0" />
                <div>
                  <p className="font-semibold">{tr.anuladosCantidad(data?.totales.anulados.cantidad ?? 0)}</p>
                  <p className="text-sm opacity-90">{tr.anuladosMonto(formatearCOP(data?.totales.anulados.monto ?? 0))}</p>
                </div>
              </div>
              <Badge variant="destructive">{tr.anuladosTitulo}</Badge>
            </div>
          )}

          {/* Gráfico Simple de Ventas por Día (SVG accesible) */}
          <section aria-labelledby="grafico-titulo" className="space-y-3 rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 id="grafico-titulo" className="font-display text-lg font-bold">
                  {tr.graficoVentasTitulo}
                </h3>
                <p className="text-xs text-muted-foreground">{tr.graficoVentasDescripcion}</p>
              </div>
              {hoveredBar && (
                <div className="rounded-md border bg-background px-3 py-1 text-xs shadow-sm" aria-live="polite">
                  <span className="font-semibold">{hoveredBar.fecha}:</span>{' '}
                  <span className="tabular font-bold text-primary">{formatearCOP(hoveredBar.ventas)}</span>{' '}
                  <span className="text-muted-foreground">({hoveredBar.pedidos} pedidos)</span>
                </div>
              )}
            </div>

            {itemsDia.length === 0 ? (
              <EmptyState icon={BarChart3} titulo={tr.vacioTitulo} descripcion={tr.vacioDescripcion} />
            ) : (
              <div className="overflow-x-auto pb-2">
                <div className="min-w-[400px]">
                  <svg
                    role="img"
                    aria-label={`${tr.graficoVentasTitulo}: ${itemsDia.length} días de datos`}
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    className="h-44 w-full overflow-visible"
                  >
                    {/* Líneas guía */}
                    <line x1="0" y1="20" x2={svgWidth} y2="20" stroke="currentColor" strokeDasharray="4 4" className="text-border" />
                    <line x1="0" y1={svgHeight - 30} x2={svgWidth} y2={svgHeight - 30} stroke="currentColor" className="text-border" />

                    {/* Barras */}
                    {itemsDia.map((item, idx) => {
                      const barWidth = 28;
                      const gap = svgWidth / itemsDia.length;
                      const x = idx * gap + (gap - barWidth) / 2;
                      const barHeight = Math.max(4, Math.round((item.ventas / maxVentas) * (svgHeight - 50)));
                      const y = svgHeight - 30 - barHeight;

                      const isHovered = hoveredBar?.fecha === item.clave;

                      return (
                        <g key={item.clave}>
                          {/* Barra interactiva */}
                          <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            rx="4"
                            className={`transition-all duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              isHovered ? 'fill-primary' : 'fill-primary/80 hover:fill-primary'
                            }`}
                            tabIndex={0}
                            role="button"
                            aria-label={`${item.clave}: ${formatearCOP(item.ventas)}, ${item.pedidos} pedidos`}
                            onMouseEnter={() => setHoveredBar({ fecha: item.clave, ventas: item.ventas, pedidos: item.pedidos })}
                            onMouseLeave={() => setHoveredBar(null)}
                            onFocus={() => setHoveredBar({ fecha: item.clave, ventas: item.ventas, pedidos: item.pedidos })}
                            onBlur={() => setHoveredBar(null)}
                          />

                          {/* Etiqueta del día en el eje X */}
                          <text
                            x={x + barWidth / 2}
                            y={svgHeight - 12}
                            textAnchor="middle"
                            className="fill-muted-foreground text-[10px] tabular"
                          >
                            {item.clave.slice(5)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            )}
          </section>

          {/* Tabla de Resultados por Agrupación */}
          <section aria-labelledby="tabla-titulo" className="space-y-3">
            <h3 id="tabla-titulo" className="font-display text-lg font-bold">
              Desglose {agrupar === 'dia' ? tr.agruparDia : agrupar === 'producto' ? tr.agruparProducto : agrupar === 'metodo' ? tr.agruparMetodo : tr.agruparCajero}
            </h3>

            {(data?.items ?? []).length === 0 ? (
              <EmptyState icon={BarChart3} titulo={tr.vacioTitulo} descripcion={tr.vacioDescripcion} />
            ) : (
              <div className="rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">
                        {agrupar === 'dia' ? tr.colFecha : agrupar === 'producto' ? tr.colProducto : agrupar === 'metodo' ? tr.colMetodo : tr.colCajero}
                      </TableHead>
                      <TableHead scope="col" className="text-right">
                        {tr.colPedidos}
                      </TableHead>
                      {agrupar === 'producto' && (
                        <TableHead scope="col" className="text-right">
                          {tr.colUnidades}
                        </TableHead>
                      )}
                      <TableHead scope="col" className="text-right">
                        {tr.colVentas}
                      </TableHead>
                      {agrupar !== 'producto' && (
                        <TableHead scope="col" className="text-right">
                          {tr.colPropinas}
                        </TableHead>
                      )}
                      <TableHead scope="col" className="text-right">
                        {tr.colTicketPromedio}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.items.map((item) => (
                      <TableRow key={item.clave}>
                        <TableCell className="font-medium">{item.etiqueta}</TableCell>
                        <TableCell className="tabular text-right">{formatearNumero(item.pedidos)}</TableCell>
                        {agrupar === 'producto' && (
                          <TableCell className="tabular text-right">{formatearNumero(item.unidades ?? 0)}</TableCell>
                        )}
                        <TableCell className="tabular text-right font-medium">{formatearCOP(item.ventas)}</TableCell>
                        {agrupar !== 'producto' && (
                          <TableCell className="tabular text-right">{formatearCOP(item.propinas)}</TableCell>
                        )}
                        <TableCell className="tabular text-right text-muted-foreground">
                          {formatearCOP(item.ticketPromedio)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="font-bold bg-muted/30">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="tabular text-right">{formatearNumero(data?.totales.pedidos ?? 0)}</TableCell>
                      {agrupar === 'producto' && (
                        <TableCell className="tabular text-right">
                          {formatearNumero(data?.totales.unidades ?? 0)}
                        </TableCell>
                      )}
                      <TableCell className="tabular text-right text-primary">
                        {formatearCOP(data?.totales.ventas ?? 0)}
                      </TableCell>
                      {agrupar !== 'producto' && (
                        <TableCell className="tabular text-right">
                          {formatearCOP(data?.totales.propinas ?? 0)}
                        </TableCell>
                      )}
                      <TableCell className="tabular text-right">
                        {formatearCOP(data?.totales.ticketPromedio ?? 0)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          </section>
        </>
      )}
    </PaginaAdmin>
  );
}
