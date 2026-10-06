import { Module } from '@nestjs/common';
import { ClientesController } from './clientes.controller';
import { ClientesRepository } from './clientes.repository';
import { ClientesService } from './clientes.service';

@Module({
  controllers: [ClientesController],
  providers: [ClientesRepository, ClientesService],
  exports: [ClientesService],
})
export class ClientesModule {}
