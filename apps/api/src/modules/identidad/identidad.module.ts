import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { IdentidadRepository } from './identidad.repository';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

@Module({
  controllers: [AuthController, UsuariosController],
  providers: [AuthService, IdentidadRepository, UsuariosService],
  exports: [AuthService, UsuariosService],
})
export class IdentidadModule {}
