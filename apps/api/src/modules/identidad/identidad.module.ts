import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { IdentidadRepository } from './identidad.repository';

@Module({
  controllers: [AuthController],
  providers: [AuthService, IdentidadRepository],
  exports: [AuthService],
})
export class IdentidadModule {}
