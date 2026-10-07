import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { IdentidadPublicService } from './identidad.public-service';
import { IdentidadRepository } from './identidad.repository';

@Module({
  controllers: [AuthController],
  providers: [AuthService, IdentidadRepository, IdentidadPublicService],
  exports: [AuthService, IdentidadPublicService],
})
export class IdentidadModule {}

