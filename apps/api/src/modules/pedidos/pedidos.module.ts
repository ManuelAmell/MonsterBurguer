import { Module } from '@nestjs/common';
import { MesasController } from './mesas.controller';
import { PedidosRepository } from './pedidos.repository';
import { PedidosService } from './pedidos.service';

@Module({
  controllers: [MesasController],
  providers: [PedidosRepository, PedidosService],
  exports: [PedidosService],
})
export class PedidosModule {}
