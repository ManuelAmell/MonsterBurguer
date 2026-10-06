import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  crearMesaSchema,
  editarMesaSchema,
  reordenarMesasSchema,
  type CrearMesaInput,
  type EditarMesaInput,
  type Mesa,
  type MesaConEstado,
  type ReordenarMesasInput,
} from '@mb/shared';
import { ZodPipe } from '../../shared-kernel/validation/zod.pipe';
import { Roles } from '../identidad/identidad.public';
import { PedidosService } from './pedidos.service';

@Controller('mesas')
export class MesasController {
  constructor(private readonly pedidosService: PedidosService) {}

  @Roles('ADMIN', 'CAJERO')
  @Get()
  async listar(): Promise<MesaConEstado[]> {
    return this.pedidosService.listarMesas();
  }

  @Roles('ADMIN')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async crear(@Body(new ZodPipe(crearMesaSchema)) body: CrearMesaInput): Promise<Mesa> {
    return this.pedidosService.crearMesa(body);
  }

  @Roles('ADMIN', 'CAJERO')
  @Get(':id')
  async buscarPorId(@Param('id') id: string): Promise<Mesa> {
    return this.pedidosService.buscarMesaPorId(id);
  }

  @Roles('ADMIN')
  @Patch(':id')
  async editar(
    @Param('id') id: string,
    @Body(new ZodPipe(editarMesaSchema)) body: EditarMesaInput,
  ): Promise<Mesa> {
    return this.pedidosService.editarMesa(id, body);
  }

  @Roles('ADMIN')
  @Put('orden')
  async reordenar(
    @Body(new ZodPipe(reordenarMesasSchema)) body: ReordenarMesasInput,
  ): Promise<MesaConEstado[]> {
    return this.pedidosService.reordenarMesas(body);
  }
}
