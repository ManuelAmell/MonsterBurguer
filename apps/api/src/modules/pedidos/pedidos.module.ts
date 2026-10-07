import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes/clientes.public';
import { CocinaModule } from '../cocina/cocina.public';
import { MesasController } from './mesas.controller';
import { PedidosController } from './pedidos.controller';
import { PedidosRepository } from './pedidos.repository';
import { PedidosService } from './pedidos.service';

@Module({
  imports: [CocinaModule, ClientesModule],
  controllers: [MesasController, PedidosController],
  providers: [PedidosRepository, PedidosService],
  exports: [PedidosService],
})
export class PedidosModule {}
