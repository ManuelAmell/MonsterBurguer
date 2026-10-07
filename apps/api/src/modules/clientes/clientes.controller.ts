import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import {
  buscarClientesQuerySchema,
  crearClienteSchema,
  type BuscarClientesQuery,
  type Cliente,
  type ClientesPaginadosRespuesta,
  type CrearClienteInput,
} from '@mb/shared';
import { ZodPipe } from '../../shared-kernel/validation/zod.pipe';
import { Roles } from '../identidad/identidad.public';
import { ClientesService } from './clientes.service';

@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Roles('ADMIN', 'CAJERO')
  @Get()
  async buscar(
    @Query(new ZodPipe(buscarClientesQuerySchema)) query: BuscarClientesQuery,
  ): Promise<ClientesPaginadosRespuesta> {
    const res = await this.clientesService.buscar(query);
    return {
      items: res.items.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        telefono: c.telefono,
        documento: c.documento,
        email: c.email,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
      nextCursor: res.nextCursor,
    };
  }

  @Roles('ADMIN', 'CAJERO')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async crear(
    @Body(new ZodPipe(crearClienteSchema)) body: CrearClienteInput,
  ): Promise<Cliente> {
    const c = await this.clientesService.crear(body);
    return {
      id: c.id,
      nombre: c.nombre,
      telefono: c.telefono,
      documento: c.documento,
      email: c.email,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }
}
