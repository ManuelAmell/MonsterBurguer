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
  Query,
} from '@nestjs/common';
import {
  actualizarAgotadoManualSchema,
  actualizarRecetaSchema,
  crearCategoriaSchema,
  crearProductoSchema,
  editarCategoriaSchema,
  editarProductoSchema,
  listarProductosQuerySchema,
  type ActualizarAgotadoManualOutput,
  type ActualizarRecetaOutput,
  type CrearCategoriaOutput,
  type CrearProductoOutput,
  type EditarCategoriaOutput,
  type EditarProductoOutput,
  type ListarProductosQuery,
} from '@mb/shared';
import { ZodPipe } from '../../shared-kernel/validation/zod.pipe';
import { Roles } from '../identidad/identidad.public';
import { CatalogoService } from './catalogo.service';

@Controller()
export class CatalogoController {
  constructor(private readonly catalogoService: CatalogoService) {}

  // --- Menú POS ---

  @Roles('ADMIN', 'CAJERO')
  @Get('catalogo/menu')
  async obtenerMenuPos() {
    return this.catalogoService.obtenerMenuPos();
  }

  // --- Categorías ---

  @Roles('ADMIN')
  @Get('categorias')
  async listarCategorias() {
    return this.catalogoService.listarCategorias();
  }

  @Roles('ADMIN')
  @Post('categorias')
  @HttpCode(HttpStatus.CREATED)
  async crearCategoria(
    @Body(new ZodPipe(crearCategoriaSchema)) body: CrearCategoriaOutput,
  ) {
    return this.catalogoService.crearCategoria(body);
  }

  @Roles('ADMIN')
  @Patch('categorias/:id')
  async editarCategoria(
    @Param('id') id: string,
    @Body(new ZodPipe(editarCategoriaSchema)) body: EditarCategoriaOutput,
  ) {
    return this.catalogoService.editarCategoria(id, body);
  }

  // --- Productos ---

  @Roles('ADMIN')
  @Get('productos')
  async listarProductos(
    @Query(new ZodPipe(listarProductosQuerySchema)) query: ListarProductosQuery,
  ) {
    return this.catalogoService.listarProductos(query);
  }

  @Roles('ADMIN')
  @Post('productos')
  @HttpCode(HttpStatus.CREATED)
  async crearProducto(
    @Body(new ZodPipe(crearProductoSchema)) body: CrearProductoOutput,
  ) {
    return this.catalogoService.crearProducto(body);
  }

  @Roles('ADMIN')
  @Get('productos/:id')
  async obtenerProducto(@Param('id') id: string) {
    return this.catalogoService.obtenerProductoPorId(id);
  }

  @Roles('ADMIN')
  @Patch('productos/:id')
  async editarProducto(
    @Param('id') id: string,
    @Body(new ZodPipe(editarProductoSchema)) body: EditarProductoOutput,
  ) {
    return this.catalogoService.editarProducto(id, body);
  }

  @Roles('ADMIN')
  @Put('productos/:id/receta')
  async actualizarReceta(
    @Param('id') id: string,
    @Body(new ZodPipe(actualizarRecetaSchema)) body: ActualizarRecetaOutput,
  ) {
    return this.catalogoService.actualizarReceta(id, body.items);
  }

  @Roles('ADMIN')
  @Put('productos/:id/agotado')
  async actualizarAgotado(
    @Param('id') id: string,
    @Body(new ZodPipe(actualizarAgotadoManualSchema)) body: ActualizarAgotadoManualOutput,
  ) {
    return this.catalogoService.actualizarAgotadoManual(id, body.agotadoManual);
  }
}
