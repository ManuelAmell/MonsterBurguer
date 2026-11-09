import type { RegimenTributario } from '@mb/shared';

/** Token de inyección para el puerto de emisión de documentos electrónicos (ADR-0012). */
export const EMISOR_DOCUMENTO_ELECTRONICO = Symbol('EMISOR_DOCUMENTO_ELECTRONICO');

export interface ItemEmisionDocumento {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  totalLinea: number;
  nota?: string | null;
}

export interface PagoEmisionDocumento {
  metodo: string;
  monto: number;
  referencia?: string | null;
}

export interface NegocioEmisionDocumento {
  razonSocial?: string;
  documento?: string;
  direccion?: string;
  telefono?: string;
}

export interface DatosEmisionDocumento {
  reciboId: string;
  numero: string;
  fecha: Date;
  total: number;
  base: number;
  impuesto: number;
  impuestoTasaBp: number;
  regimenTributario: RegimenTributario;
  propina: number;
  items: ItemEmisionDocumento[];
  pagos: PagoEmisionDocumento[];
  negocio?: NegocioEmisionDocumento;
}

export interface ResultadoEmisionDocumento {
  cude: string;
  qr: string;
  proveedor: string;
  fechaEmision: string;
}

/**
 * Puerto de emisión de Documento Equivalente Electrónico POS (DEE POS) y Factura Electrónica.
 * Desacopla la lógica de facturación de cualquier Proveedor Tecnológico DIAN externo (ADR-0012).
 */
export interface EmisorDocumentoElectronico {
  emitir(datos: DatosEmisionDocumento): Promise<ResultadoEmisionDocumento>;
}
