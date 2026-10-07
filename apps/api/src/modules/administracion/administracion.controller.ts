import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import {
  configuracionNegocioSchema,
  fechaOperativaSchema,
  type ConfiguracionNegocio,
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
}
