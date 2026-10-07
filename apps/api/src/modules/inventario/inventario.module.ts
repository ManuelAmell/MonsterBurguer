import { Global, Module } from '@nestjs/common';
import { InventarioController } from './inventario.controller';
import { InventarioRepository } from './inventario.repository';
import { InventarioService } from './inventario.service';

@Global()
@Module({
  controllers: [InventarioController],
  providers: [InventarioService, InventarioRepository],
  exports: [InventarioService],
})
export class InventarioModule {}
