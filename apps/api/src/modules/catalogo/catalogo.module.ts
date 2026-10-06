import { Global, Module } from '@nestjs/common';
import { CatalogoController } from './catalogo.controller';
import { CatalogoPublicService } from './catalogo.public-service';
import { CatalogoRepository } from './catalogo.repository';
import { CatalogoService } from './catalogo.service';

@Global()
@Module({
  controllers: [CatalogoController],
  providers: [CatalogoService, CatalogoRepository, CatalogoPublicService],
  exports: [CatalogoService, CatalogoPublicService],
})
export class CatalogoModule {}
