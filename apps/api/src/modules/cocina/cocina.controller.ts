import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  listarComandasQuerySchema,
  transicionComandaSchema,
  uuidSchema,
  type Comanda,
  type ListarComandasQuery,
  type TransicionComandaInput,
  type UsuarioSesion,
} from '@mb/shared';
import { ZodPipe } from '../../shared-kernel/validation/zod.pipe';
import { Roles, UsuarioActual } from '../identidad/identidad.public';
import { CocinaService } from './cocina.service';

const IdPipe = new ZodPipe(uuidSchema);

@Controller('comandas')
export class CocinaController {
  constructor(private readonly cocina: CocinaService) {}

  @Roles('ADMIN', 'CAJERO', 'COCINA')
  @Get()
  async listar(
    @Query(new ZodPipe(listarComandasQuerySchema)) query: ListarComandasQuery,
  ): Promise<Comanda[]> {
    return this.cocina.listar(query);
  }

  @Roles('ADMIN', 'COCINA')
  @Post(':id/iniciar')
  @HttpCode(HttpStatus.OK)
  async iniciar(
    @Param('id', IdPipe) id: string,
    @Body(new ZodPipe(transicionComandaSchema)) body: TransicionComandaInput,
    @UsuarioActual() usuario: UsuarioSesion,
  ): Promise<Comanda> {
    return this.cocina.transicionar('iniciar', id, body.version, usuario.id);
  }

  @Roles('ADMIN', 'COCINA')
  @Post(':id/lista')
  @HttpCode(HttpStatus.OK)
  async lista(
    @Param('id', IdPipe) id: string,
    @Body(new ZodPipe(transicionComandaSchema)) body: TransicionComandaInput,
    @UsuarioActual() usuario: UsuarioSesion,
  ): Promise<Comanda> {
    return this.cocina.transicionar('lista', id, body.version, usuario.id);
  }

  @Roles('ADMIN', 'CAJERO', 'COCINA')
  @Post(':id/entregar')
  @HttpCode(HttpStatus.OK)
  async entregar(
    @Param('id', IdPipe) id: string,
    @Body(new ZodPipe(transicionComandaSchema)) body: TransicionComandaInput,
    @UsuarioActual() usuario: UsuarioSesion,
  ): Promise<Comanda> {
    return this.cocina.transicionar('entregar', id, body.version, usuario.id);
  }
}
