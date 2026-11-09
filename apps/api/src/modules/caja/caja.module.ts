import { Module } from '@nestjs/common';
import { IdentidadModule } from '../identidad/identidad.public';
import { PedidosModule } from '../pedidos/pedidos.public';
import { CajaController } from './caja.controller';
import { CajaService } from './caja.service';
import { EMISOR_DOCUMENTO_ELECTRONICO } from './emisor-documento-electronico.puerto';
import { ProveedorSimulado } from './proveedor-simulado.adaptador';

@Module({
  imports: [IdentidadModule, PedidosModule],
  controllers: [CajaController],
  providers: [
    CajaService,
    {
      provide: EMISOR_DOCUMENTO_ELECTRONICO,
      useClass: ProveedorSimulado,
    },
  ],
  exports: [CajaService, EMISOR_DOCUMENTO_ELECTRONICO],
})
export class CajaModule {}
