// Reglas de dinero (docs/BUSINESS_RULES.md §1). Todo monto es un entero en pesos COP (RN-01).
import type { RegimenTributario } from './enums';

/** Tasa de impuesto en puntos básicos (1 % = 100 bp) por régimen (RN-03). */
export const TASA_IMPUESTO_BP: Record<RegimenTributario, number> = {
  NO_RESPONSABLE: 0,
  INC_8: 800,
  IVA_19: 1900,
};

export const NOMBRE_IMPUESTO: Record<RegimenTributario, string | null> = {
  NO_RESPONSABLE: null,
  INC_8: 'INC',
  IVA_19: 'IVA',
};

/** Ley 1935 de 2018: la propina sugerida no puede superar el 10 %. */
export const PROPINA_MAXIMA_BP = 1000;

export interface LineaMonto {
  precioUnitario: number;
  cantidad: number;
}

export interface Totales {
  /** Lo que paga el cliente: precio final al público (RN-02). */
  total: number;
  /** Valor antes de impuestos. */
  base: number;
  impuesto: number;
}

function assertPesos(valor: number, campo: string): void {
  if (!Number.isSafeInteger(valor) || valor < 0) {
    throw new RangeError(`${campo} debe ser un entero de pesos ≥ 0 (recibido: ${valor})`);
  }
}

/** División entera de no negativos, exacta (sin errores de coma flotante). */
function divEntera(dividendo: number, divisor: number): number {
  return (dividendo - (dividendo % divisor)) / divisor;
}

export function totalLinea({ precioUnitario, cantidad }: LineaMonto): number {
  assertPesos(precioUnitario, 'precioUnitario');
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    throw new RangeError(`cantidad debe ser un entero ≥ 1 (recibido: ${cantidad})`);
  }
  return precioUnitario * cantidad;
}

/**
 * RN-04: el total es la suma de líneas (precios finales); el impuesto se extrae del total
 * del pedido con redondeo half-up al peso. Con tasa 0 (régimen NO_RESPONSABLE) base = total.
 */
export function calcularTotales(lineas: readonly LineaMonto[], tasaBp: number): Totales {
  if (!Number.isInteger(tasaBp) || tasaBp < 0) {
    throw new RangeError(`tasaBp debe ser un entero ≥ 0 (recibido: ${tasaBp})`);
  }
  const total = lineas.reduce((acc, linea) => acc + totalLinea(linea), 0);
  const divisor = 10_000 + tasaBp;
  // round(total * 10000 / divisor) half-up, en aritmética entera: floor((2·a + b) / 2b)
  const base = divEntera(2 * total * 10_000 + divisor, 2 * divisor);
  return { total, base, impuesto: total - base };
}

/**
 * RN-06 (Ley 1935 de 2018): propina sugerida = porcentaje de la base (antes de impuestos),
 * redondeada HACIA ABAJO a la centena para no superar nunca el máximo legal.
 */
export function propinaSugerida(base: number, propinaBp: number = PROPINA_MAXIMA_BP): number {
  assertPesos(base, 'base');
  if (!Number.isInteger(propinaBp) || propinaBp < 0 || propinaBp > PROPINA_MAXIMA_BP) {
    throw new RangeError(`propinaBp debe estar entre 0 y ${PROPINA_MAXIMA_BP} (recibido: ${propinaBp})`);
  }
  // base · bp / 10000 pesos, truncado a centenas → divEntera(base · bp, 1_000_000) · 100
  return divEntera(base * propinaBp, 1_000_000) * 100;
}

const formatoCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/** Formato de moneda para UI y recibos: 49700 → "$ 49.700". */
export function formatearCOP(pesos: number): string {
  return formatoCOP.format(pesos);
}
