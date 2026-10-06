import { describe, expect, it } from 'vitest';
import {
  calcularTotales,
  formatearCOP,
  propinaSugerida,
  TASA_IMPUESTO_BP,
  totalLinea,
} from './money';

const pedidoEjemplo = [
  { precioUnitario: 19_900, cantidad: 2 }, // 2 × Monster Clásica
  { precioUnitario: 9_900, cantidad: 1 }, // 1 × Papas grandes
];

describe('money', () => {
  it('RN-01: rechaza montos no enteros o negativos', () => {
    expect(() => totalLinea({ precioUnitario: 199.5, cantidad: 1 })).toThrow(RangeError);
    expect(() => totalLinea({ precioUnitario: -1, cantidad: 1 })).toThrow(RangeError);
    expect(() => totalLinea({ precioUnitario: 1000, cantidad: 0 })).toThrow(RangeError);
  });

  it('RN-03/RN-04: régimen NO_RESPONSABLE no discrimina impuesto ($49.700 → impuesto $0)', () => {
    expect(calcularTotales(pedidoEjemplo, TASA_IMPUESTO_BP.NO_RESPONSABLE)).toEqual({
      total: 49_700,
      base: 49_700,
      impuesto: 0,
    });
  });

  it('RN-04: régimen INC_8 extrae el impuesto del total con half-up ($49.700 → base $46.019, INC $3.681)', () => {
    expect(calcularTotales(pedidoEjemplo, TASA_IMPUESTO_BP.INC_8)).toEqual({
      total: 49_700,
      base: 46_019,
      impuesto: 3_681,
    });
  });

  it('RN-04: redondeo half-up exacto en el punto medio', () => {
    // 54 / 1.08 = 50 exacto; 1 / 1.08 = 0.926 → 1
    expect(calcularTotales([{ precioUnitario: 54, cantidad: 1 }], 800).base).toBe(50);
    expect(calcularTotales([{ precioUnitario: 1, cantidad: 1 }], 800).base).toBe(1);
    // 105 / 2 = 52.5 → 53 (half-up)
    expect(calcularTotales([{ precioUnitario: 105, cantidad: 1 }], 10_000).base).toBe(53);
  });

  it('RN-04: pedido vacío totaliza cero', () => {
    expect(calcularTotales([], 800)).toEqual({ total: 0, base: 0, impuesto: 0 });
  });

  it('RN-06: propina sugerida 10 % de la base, hacia abajo a la centena ($49.700 → $4.900)', () => {
    expect(propinaSugerida(49_700)).toBe(4_900);
    expect(propinaSugerida(46_019)).toBe(4_600);
  });

  it('RN-06: la propina sugerida nunca supera el 10 % de la base', () => {
    for (let base = 0; base <= 200_000; base += 37) {
      const propina = propinaSugerida(base);
      expect(propina * 10).toBeLessThanOrEqual(base);
      expect(propina % 100).toBe(0);
    }
  });

  it('RN-06: rechaza porcentajes de propina mayores al 10 %', () => {
    expect(() => propinaSugerida(10_000, 1_500)).toThrow(RangeError);
  });

  it('formatea en pesos colombianos sin decimales', () => {
    expect(formatearCOP(49_700).replace(/\s/g, ' ')).toBe('$ 49.700');
  });
});
