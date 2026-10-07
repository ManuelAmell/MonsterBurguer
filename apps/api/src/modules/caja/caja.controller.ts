import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  abrirSesionCajaSchema,
  cerrarSesionCajaSchema,
  cobroSchema,
  uuidSchema,
  type AbrirSesionCajaOutput,
  type CerrarSesionCajaOutput,
  type CobroInput,
  type CobroRespuesta,
  type ResumenCierre,
  type SesionCaja,
  type UsuarioSesion,
} from '@mb/shared';
import { ZodPipe } from '../../shared-kernel/validation/zod.pipe';
import { Roles, UsuarioActual } from '../identidad/identidad.public';
import { CajaService } from './caja.service';

const IdPipe = new ZodPipe(uuidSchema);

@Roles('ADMIN', 'CAJERO')
@Controller()
export class CajaController {
  constructor(private readonly caja: CajaService) {}

  @Get('caja/sesion-actual')
  async sesionActual(
    @UsuarioActual() usuario: UsuarioSesion,
  ): Promise<(SesionCaja & { ventasEfectivo: number }) | null> {
    return this.caja.sesionActual(usuario.id);
  }

  @Post('caja/sesiones')
  @HttpCode(HttpStatus.CREATED)
  async abrir(
    @Body(new ZodPipe(abrirSesionCajaSchema)) body: AbrirSesionCajaOutput,
    @UsuarioActual() usuario: UsuarioSesion,
  ): Promise<SesionCaja> {
    return this.caja.abrir(usuario.id, body.montoApertura);
  }

  @Post('caja/sesiones/:id/cerrar')
  @HttpCode(HttpStatus.OK)
  async cerrar(
    @Param('id', IdPipe) id: string,
    @Body(new ZodPipe(cerrarSesionCajaSchema)) body: CerrarSesionCajaOutput,
    @UsuarioActual() usuario: UsuarioSesion,
  ): Promise<ResumenCierre> {
    return this.caja.cerrar(id, usuario, body.efectivoContado);
  }

  @Post('caja/cobros')
  @HttpCode(HttpStatus.CREATED)
  async cobrar(
    @Body(new ZodPipe(cobroSchema)) body: CobroInput,
    @UsuarioActual() usuario: UsuarioSesion,
  ): Promise<CobroRespuesta> {
    return this.caja.cobrar(body, usuario);
  }

  @Get('recibos/:id')
  async recibo(@Param('id', IdPipe) id: string) {
    return this.caja.obtenerRecibo(id);
  }
}
