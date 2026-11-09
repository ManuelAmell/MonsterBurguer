import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  DatosEmisionDocumento,
  EmisorDocumentoElectronico,
  ResultadoEmisionDocumento,
} from './emisor-documento-electronico.puerto';

/**
 * Adaptador simulado para emisión de Documento Equivalente Electrónico POS (DEE POS).
 * Devuelve un CUDE y una URL/QR claramente marcados como simulados (prefijo "SIMULADO-").
 * No implementa el algoritmo real de la DIAN ni realiza llamadas de red (ADR-0012).
 */
@Injectable()
export class ProveedorSimulado implements EmisorDocumentoElectronico {
  async emitir(datos: DatosEmisionDocumento): Promise<ResultadoEmisionDocumento> {
    const hash = createHash('sha256')
      .update(`${datos.reciboId}:${datos.numero}:${datos.total}:${datos.base}:${datos.impuesto}`)
      .digest('hex');

    const cude = `SIMULADO-CUDE-${hash}`;
    const qr = `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=SIMULADO-${hash}`;

    return {
      cude,
      qr,
      proveedor: 'SIMULADO',
      fechaEmision: new Date().toISOString(),
    };
  }
}
