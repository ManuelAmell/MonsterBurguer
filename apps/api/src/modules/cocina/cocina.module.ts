import { Module } from '@nestjs/common';
import { CocinaController } from './cocina.controller';
import { CocinaRepository } from './cocina.repository';
import { CocinaService } from './cocina.service';

@Module({
  controllers: [CocinaController],
  providers: [CocinaRepository, CocinaService],
  exports: [CocinaService],
})
export class CocinaModule {}
