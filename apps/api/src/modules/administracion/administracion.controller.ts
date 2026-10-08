import { Body, Controller, Get, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  configuracionNegocioSchema,
  fechaOperativaSchema,
  reporteVentasQuerySchema,
  type AlertasRespuesta,
  type ConfiguracionNegocio,
  type ReporteVentasQuery,
  type ReporteVentasRespuesta,
  type UsuarioSesion,
} from '@mb/shared';
import { z } from 'zod';
import { ZodPipe } from '../../shared-kernel/validation/zod.pipe';
import { Roles, UsuarioActual } from '../identidad/identidad.public';
import { AdministracionService, type DashboardDia } from './administracion.service';

const dashboardQuery = z.object({ fecha: fechaOperativaSchema.optional() });
const eventosQuery = z.object({ cursor: z.string().optional() });

@Roles('ADMIN')
@Controller('admin')
export class AdministracionController {
  constructor(private readonly admin: AdministracionService) {}

  @Get('dashboard')
  async dashboard(
    @Query(new ZodPipe(dashboardQuery)) q: z.output<typeof dashboardQuery>,
  ): Promise<DashboardDia> {
    return this.admin.dashboard(q.fecha);
  }

  @Get('eventos')
  async eventos(@Query(new ZodPipe(eventosQuery)) q: z.output<typeof eventosQuery>) {
    return this.admin.eventos(q.cursor);
  }

  @Get('configuracion')
  async obtenerConfiguracion(): Promise<ConfiguracionNegocio> {
    return this.admin.obtenerConfiguracion();
  }

  @Put('configuracion')
  async guardarConfiguracion(
    @UsuarioActual() usuario: UsuarioSesion,
    @Body(new ZodPipe(configuracionNegocioSchema)) body: ConfiguracionNegocio,
  ): Promise<ConfiguracionNegocio> {
    return this.admin.guardarConfiguracion(body, usuario.id);
  }

  @Get('reportes/ventas')
  async reporteVentas(
    @Query(new ZodPipe(reporteVentasQuerySchema)) q: ReporteVentasQuery,
  ): Promise<ReporteVentasRespuesta> {
    return this.admin.reporteVentas(q);
  }

  @Get('reportes/ventas.csv')
  async reporteVentasCsv(
    @Query(new ZodPipe(reporteVentasQuerySchema)) q: ReporteVentasQuery,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const csv = await this.admin.reporteVentasCsv(q);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte-ventas-${q.desde}-a-${q.hasta}.csv"`,
    );
    return csv;
  }

  @Get('alertas')
  async obtenerAlertas(): Promise<AlertasRespuesta> {
    return this.admin.obtenerAlertas();
  }
}
