import { Module } from '@nestjs/common';
import { AdministracionController } from './administracion.controller';
import { AdministracionService } from './administracion.service';

@Module({
  controllers: [AdministracionController],
  providers: [AdministracionService],
})
export class AdministracionModule {}
