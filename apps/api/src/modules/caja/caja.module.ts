import { Module } from '@nestjs/common';
import { IdentidadModule } from '../identidad/identidad.public';
import { PedidosModule } from '../pedidos/pedidos.public';
import { CajaController } from './caja.controller';
import { CajaService } from './caja.service';

@Module({
  imports: [IdentidadModule, PedidosModule],
  controllers: [CajaController],
  providers: [CajaService],
})
export class CajaModule {}

