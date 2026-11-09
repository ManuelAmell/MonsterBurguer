// API pública del módulo caja: lo único que otros módulos pueden importar de aquí (ARCHITECTURE.md §3).
export { CajaModule } from './caja.module';
export { CajaService } from './caja.service';
export { EMISOR_DOCUMENTO_ELECTRONICO } from './emisor-documento-electronico.puerto';
export type {
  DatosEmisionDocumento,
  EmisorDocumentoElectronico,
  ItemEmisionDocumento,
  NegocioEmisionDocumento,
  PagoEmisionDocumento,
  ResultadoEmisionDocumento,
} from './emisor-documento-electronico.puerto';
export { ProveedorSimulado } from './proveedor-simulado.adaptador';
