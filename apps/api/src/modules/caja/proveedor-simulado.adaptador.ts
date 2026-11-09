import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  DatosEmisionDocumento,
  EmisorDocumentoElectronico,
  ResultadoEmisionDocumento,
} from './emisor-documento-electronico.puerto';

export const PROVEEDOR_SIMULADO = 'SIMULADO';

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
    // Dominio reservado .invalid (RFC 2606): un QR simulado nunca debe apuntar al catálogo real de la DIAN.
    const qr = `https://dee-pos.simulado.invalid/qr?documentkey=SIMULADO-${hash}`;

    return {
      cude,
      qr,
      proveedor: PROVEEDOR_SIMULADO,
      fechaEmision: new Date().toISOString(),
    };
  }
}
