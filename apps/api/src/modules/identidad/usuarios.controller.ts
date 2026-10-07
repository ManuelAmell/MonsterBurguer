import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  actualizarUsuarioSchema,
  crearUsuarioSchema,
  restablecerClaveSchema,
  type ActualizarUsuarioOutput,
  type CrearUsuarioOutput,
  type RestablecerClaveOutput,
  type UsuarioDetalle,
  type UsuarioSesion,
} from '@mb/shared';
import { ZodPipe } from '../../shared-kernel/validation/zod.pipe';
import { Roles, UsuarioActual } from './auth.decorators';
import { UsuariosService } from './usuarios.service';

@Roles('ADMIN')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  async listar(): Promise<UsuarioDetalle[]> {
    return this.usuariosService.listar();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async crear(
    @Body(new ZodPipe(crearUsuarioSchema)) body: CrearUsuarioOutput,
  ): Promise<UsuarioDetalle> {
    return this.usuariosService.crear(body);
  }

  @Patch(':id')
  async actualizar(
    @Param('id') id: string,
    @UsuarioActual() usuarioActual: UsuarioSesion,
    @Body(new ZodPipe(actualizarUsuarioSchema)) body: ActualizarUsuarioOutput,
  ): Promise<UsuarioDetalle> {
    return this.usuariosService.actualizar(id, body, usuarioActual);
  }

  @Post(':id/clave')
  @HttpCode(HttpStatus.OK)
  async restablecerClave(
    @Param('id') id: string,
    @Body(new ZodPipe(restablecerClaveSchema)) body: RestablecerClaveOutput,
  ): Promise<{ ok: boolean }> {
    return this.usuariosService.restablecerClave(id, body);
  }
}
