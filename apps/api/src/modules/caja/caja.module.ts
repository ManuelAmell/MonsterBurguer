import { Module } from '@nestjs/common';
import { PedidosModule } from '../pedidos/pedidos.public';
import { CajaController } from './caja.controller';
import { CajaService } from './caja.service';

@Module({
  imports: [PedidosModule],
  controllers: [CajaController],
  providers: [CajaService],
})
export class CajaModule {}
