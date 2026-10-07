import { useQuery } from '@tanstack/react-query';
import { Activity, BarChart3, DollarSign, Receipt, ShoppingBag } from 'lucide-react';
import { formatearCOP } from '@mb/shared';
import { KpiTile } from '@/components/admin/kpi-tile';
import { EmptyState } from '@/components/empty-state';
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

function resumenPayload(payload: EventoDto['payload']): string {
  if (!payload) return '—';
  const partes = Object.entries(payload)
    .filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${String(v)}`);
  return partes.length > 0 ? partes.join(' · ') : '—';
}

export function DashboardPage() {
  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardDto>('/admin/dashboard'),
    retry: false,
  });
  const eventos = useQuery({
    queryKey: ['eventos'],
    queryFn: () => api<{ items: EventoDto[] }>('/admin/eventos'),
    retry: false,
  });

  const d = dashboard.data;

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
