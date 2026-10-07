import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import {
  agregarPedidoItemSchema,
  crearPedidoSchema,
  editarPedidoItemSchema,
  type EditarPedidoItemOutput,
  listarPedidosQuerySchema,
  uuidSchema,
  type AgregarPedidoItemOutput,
  type CrearPedidoOutput,
  type ListarPedidosQuery,
  type Pedido,
  type UsuarioSesion,
} from '@mb/shared';
import { ZodPipe } from '../../shared-kernel/validation/zod.pipe';
import { Roles, UsuarioActual } from '../identidad/identidad.public';
import { PedidosService } from './pedidos.service';

const IdPipe = new ZodPipe(uuidSchema);

@Roles('ADMIN', 'CAJERO')
@Controller('pedidos')
export class PedidosController {
  constructor(private readonly pedidos: PedidosService) {}

  @Get()
  async listar(
    @Query(new ZodPipe(listarPedidosQuerySchema)) query: ListarPedidosQuery,
  ): Promise<{ items: Pedido[]; nextCursor: string | null }> {
    return this.pedidos.listarPedidos(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async crear(
    @Body(new ZodPipe(crearPedidoSchema)) body: CrearPedidoOutput,
    @UsuarioActual() usuario: UsuarioSesion,
  ): Promise<Pedido> {
    return this.pedidos.crearPedido(body, usuario.id);
  }

  @Get(':id')
  async detalle(@Param('id', IdPipe) id: string): Promise<Pedido> {
    return this.pedidos.obtenerPedido(id);
  }

  @Post(':id/items')
  @HttpCode(HttpStatus.CREATED)
  async agregarItem(
    @Param('id', IdPipe) id: string,
    @Body(new ZodPipe(agregarPedidoItemSchema)) body: AgregarPedidoItemOutput,
  ): Promise<Pedido> {
    return this.pedidos.agregarItem(id, body);
  }

  @Patch(':id/items/:itemId')
  async editarItem(
    @Param('id', IdPipe) id: string,
    @Param('itemId', IdPipe) itemId: string,
    @Body(new ZodPipe(editarPedidoItemSchema)) body: EditarPedidoItemOutput,
  ): Promise<Pedido> {
    return this.pedidos.editarItem(id, itemId, body);
  }

  @Delete(':id/items/:itemId')
  async quitarItem(
    @Param('id', IdPipe) id: string,
    @Param('itemId', IdPipe) itemId: string,
  ): Promise<Pedido> {
    return this.pedidos.quitarItem(id, itemId);
  }

  @Post(':id/confirmar')
  @HttpCode(HttpStatus.OK)
  async confirmar(
    @Param('id', IdPipe) id: string,
    @UsuarioActual() usuario: UsuarioSesion,
  ): Promise<Pedido> {
    return this.pedidos.confirmar(id, usuario.id);
  }
}
