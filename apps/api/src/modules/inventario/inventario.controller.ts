import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  crearAjusteInventarioSchema,
  crearEntradaInventarioSchema,
  crearIngredienteSchema,
  crearMermaInventarioSchema,
  editarIngredienteSchema,
  listarIngredientesQuerySchema,
  paginacionQuerySchema,
  type CrearAjusteInventarioOutput,
  type CrearEntradaInventarioOutput,
  type CrearIngredienteOutput,
  type CrearMermaInventarioOutput,
  type EditarIngredienteOutput,
  type ListarIngredientesQuery,
  type PaginacionQuery,
  type UsuarioSesion,
} from '@mb/shared';
import { ZodPipe } from '../../shared-kernel/validation/zod.pipe';
import { Roles, UsuarioActual } from '../identidad/identidad.public';
import { InventarioService } from './inventario.service';

@Controller()
export class InventarioController {
  constructor(private readonly inventarioService: InventarioService) {}

  // --- Ingredientes ---

  @Roles('ADMIN')
  @Get('ingredientes')
  async listarIngredientes(
    @Query(new ZodPipe(listarIngredientesQuerySchema)) query: ListarIngredientesQuery,
  ) {
    return this.inventarioService.listar(query);
  }

  @Roles('ADMIN')
  @Post('ingredientes')
  @HttpCode(HttpStatus.CREATED)
  async crearIngrediente(
    @Body(new ZodPipe(crearIngredienteSchema)) body: CrearIngredienteOutput,
  ) {
    return this.inventarioService.crear(body);
  }

  @Roles('ADMIN')
  @Patch('ingredientes/:id')
  async editarIngrediente(
    @Param('id') id: string,
    @Body(new ZodPipe(editarIngredienteSchema)) body: EditarIngredienteOutput,
  ) {
    return this.inventarioService.editar(id, body);
  }

  @Roles('ADMIN')
  @Get('ingredientes/:id/movimientos')
  async listarKardex(
    @Param('id') id: string,
    @Query(new ZodPipe(paginacionQuerySchema)) query: PaginacionQuery,
  ) {
    return this.inventarioService.listarKardex(id, query);
  }

  // --- Movimientos manuales / Entradas / Ajustes / Mermas ---

  @Roles('ADMIN')
  @Post('inventario/entradas')
  @HttpCode(HttpStatus.CREATED)
  async registrarEntrada(
    @UsuarioActual() usuario: UsuarioSesion,
    @Body(new ZodPipe(crearEntradaInventarioSchema)) body: CrearEntradaInventarioOutput,
  ) {
    return this.inventarioService.registrarEntrada(usuario.id, body);
  }

  @Roles('ADMIN')
  @Post('inventario/ajustes')
  @HttpCode(HttpStatus.CREATED)
  async registrarAjuste(
    @UsuarioActual() usuario: UsuarioSesion,
    @Body(new ZodPipe(crearAjusteInventarioSchema)) body: CrearAjusteInventarioOutput,
  ) {
    return this.inventarioService.registrarAjuste(usuario.id, body);
  }

  @Roles('ADMIN')
  @Post('inventario/mermas')
  @HttpCode(HttpStatus.CREATED)
  async registrarMerma(
    @UsuarioActual() usuario: UsuarioSesion,
    @Body(new ZodPipe(crearMermaInventarioSchema)) body: CrearMermaInventarioOutput,
  ) {
    return this.inventarioService.registrarMermaManual(usuario.id, body);
  }
}
