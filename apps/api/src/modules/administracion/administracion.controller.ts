import { Controller, Get, Query } from '@nestjs/common';
import { fechaOperativaSchema } from '@mb/shared';
import { z } from 'zod';
import { ZodPipe } from '../../shared-kernel/validation/zod.pipe';
import { Roles } from '../identidad/identidad.public';
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
}
