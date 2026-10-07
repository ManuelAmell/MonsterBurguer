import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  abrirSesionCajaSchema,
  buscarSesionesQuerySchema,
  cerrarSesionCajaSchema,
  cobroSchema,
  movimientoCajaInputSchema,
  uuidSchema,
  type AbrirSesionCajaOutput,
  type BuscarSesionesQuery,
  type CerrarSesionCajaOutput,
  type CobroInput,
  type CobroRespuesta,
  type MovimientoCaja,
  type MovimientoCajaInput,
  type ResumenCierre,
  type SesionCaja,
  type SesionCajaDetalle,
  type SesionesPaginadasRespuesta,
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

  @Post('caja/sesiones/:id/movimientos')
  @HttpCode(HttpStatus.CREATED)
  async registrarMovimiento(
    @Param('id', IdPipe) id: string,
    @Body(new ZodPipe(movimientoCajaInputSchema)) body: MovimientoCajaInput,
    @UsuarioActual() usuario: UsuarioSesion,
  ): Promise<MovimientoCaja> {
    return this.caja.registrarMovimiento(id, body, usuario);
  }

  @Get('caja/sesiones/:id/movimientos')
  async listarMovimientos(
    @Param('id', IdPipe) id: string,
    @UsuarioActual() usuario: UsuarioSesion,
  ): Promise<MovimientoCaja[]> {
    return this.caja.listarMovimientos(id, usuario);
  }

  @Get('caja/sesiones')
  async listarSesiones(
    @Query(new ZodPipe(buscarSesionesQuerySchema)) query: BuscarSesionesQuery,
    @UsuarioActual() usuario: UsuarioSesion,
  ): Promise<SesionesPaginadasRespuesta> {
    return this.caja.listarSesiones(query, usuario);
  }

  @Get('caja/sesiones/:id')
  async sesionDetalle(
    @Param('id', IdPipe) id: string,
    @UsuarioActual() usuario: UsuarioSesion,
  ): Promise<SesionCajaDetalle> {
    return this.caja.obtenerSesionDetalle(id, usuario);
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

