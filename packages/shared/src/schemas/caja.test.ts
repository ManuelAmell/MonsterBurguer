import { describe, expect, it } from 'vitest';
import {
  abrirSesionCajaSchema,
  cerrarSesionCajaSchema,
  cobroRespuestaSchema,
  cobroSchema,
  movimientoCajaInputSchema,
  pagoCobroItemSchema,
  resumenCierreSchema,
} from './caja';

const ID_PEDIDO = '0199b2c4-1111-7000-8000-000000000001';
const ID_RECIBO = '0199b2c4-2222-7000-8000-000000000002';
const ID_SESION = '0199b2c4-3333-7000-8000-000000000003';

describe('schemas/caja', () => {
  describe('abrirSesionCajaSchema (RN-41)', () => {
    it('RN-41: acepta apertura con monto en pesos ≥ 0', () => {
      expect(abrirSesionCajaSchema.parse({ montoApertura: 0 })).toEqual({
        montoApertura: 0,
      });
      expect(abrirSesionCajaSchema.parse({ montoApertura: 100000 })).toEqual({
        montoApertura: 100000,
      });
    });

    it('RN-41: rechaza monto de apertura negativo o decimal', () => {
      expect(() => abrirSesionCajaSchema.parse({ montoApertura: -1 })).toThrow();
      expect(() => abrirSesionCajaSchema.parse({ montoApertura: 50000.5 })).toThrow();
    });
  });

  describe('movimientoCajaInputSchema (RN-46)', () => {
    it('RN-46: acepta INGRESO y RETIRO con monto > 0 y motivo obligatorio', () => {
      const ingreso = movimientoCajaInputSchema.parse({
        tipo: 'INGRESO',
        monto: 50000,
        motivo: 'Base adicional por falta de cambio',
      });
      expect(ingreso.tipo).toBe('INGRESO');
      expect(ingreso.monto).toBe(50000);

      const retiro = movimientoCajaInputSchema.parse({
        tipo: 'RETIRO',
        monto: 20000,
        motivo: 'Pago a proveedor de verduras',
      });
      expect(retiro.tipo).toBe('RETIRO');
      expect(retiro.monto).toBe(20000);
    });

    it('RN-46: rechaza movimiento con monto ≤ 0', () => {
      expect(() =>
        movimientoCajaInputSchema.parse({
          tipo: 'INGRESO',
          monto: 0,
          motivo: 'Aporte',
        }),
      ).toThrow('El monto del movimiento debe ser mayor a 0');

      expect(() =>
        movimientoCajaInputSchema.parse({
          tipo: 'RETIRO',
          monto: -5000,
          motivo: 'Retiro',
        }),
      ).toThrow();
    });

    it('RN-46: rechaza movimiento sin motivo o con motivo vacío', () => {
      expect(() =>
        movimientoCajaInputSchema.parse({
          tipo: 'INGRESO',
          monto: 10000,
          motivo: '   ',
        }),
      ).toThrow('El motivo del movimiento es obligatorio');
    });
  });

  describe('cobroSchema (RN-42, RN-43)', () => {
    it('RN-42 & RN-43: acepta cobro con pago único en EFECTIVO si recibido ≥ monto', () => {
      const cobro = cobroSchema.parse({
        pedidoId: ID_PEDIDO,
        pedidoVersion: 2,
        propina: 0,
        pagos: [
          {
            metodo: 'EFECTIVO',
            monto: 49700,
            recibido: 50000,
          },
        ],
      });
      expect(cobro.pagos).toHaveLength(1);
      expect(cobro.pagos[0]?.monto).toBe(49700);
    });

    it('RN-42: acepta cobro con pago no efectivo (TARJETA) sin necesidad de recibido', () => {
      const cobro = cobroSchema.parse({
        pedidoId: ID_PEDIDO,
        pedidoVersion: 1,
        propina: 3000,
        pagos: [
          {
            metodo: 'TARJETA',
            monto: 52700,
            referencia: 'VOUCHER-9921',
          },
        ],
      });
      expect(cobro.pagos[0]?.metodo).toBe('TARJETA');
      expect(cobro.pagos[0]?.recibido).toBeUndefined();
    });

    it('RN-42 & RN-43: acepta pagos mixtos (EFECTIVO + TARJETA)', () => {
      const cobro = cobroSchema.parse({
        pedidoId: ID_PEDIDO,
        pedidoVersion: 3,
        propina: 0,
        pagos: [
          { metodo: 'EFECTIVO', monto: 30000, recibido: 50000 },
          { metodo: 'TARJETA', monto: 19700, referencia: 'VOUCHER-8812' },
        ],
      });
      expect(cobro.pagos).toHaveLength(2);
    });

    it('RN-43: rechaza cobro con más de un pago en EFECTIVO', () => {
      expect(() =>
        cobroSchema.parse({
          pedidoId: ID_PEDIDO,
          pedidoVersion: 1,
          propina: 0,
          pagos: [
            { metodo: 'EFECTIVO', monto: 20000, recibido: 20000 },
            { metodo: 'EFECTIVO', monto: 10000, recibido: 10000 },
          ],
        }),
      ).toThrow('Solo se permite un único pago en EFECTIVO por cobro (RN-43)');
    });

    it('RN-43: rechaza pago en EFECTIVO donde recibido < monto', () => {
      expect(() =>
        pagoCobroItemSchema.parse({
          metodo: 'EFECTIVO',
          monto: 30000,
          recibido: 25000,
        }),
      ).toThrow(/mayor o igual al monto a pagar/);
    });

    it('RN-43: rechaza pago en EFECTIVO sin monto recibido', () => {
      expect(() =>
        pagoCobroItemSchema.parse({
          metodo: 'EFECTIVO',
          monto: 30000,
        }),
      ).toThrow(/mayor o igual al monto a pagar/);
    });

    it('RN-42: rechaza pagos con monto ≤ 0', () => {
      expect(() =>
        pagoCobroItemSchema.parse({
          metodo: 'TARJETA',
          monto: 0,
        }),
      ).toThrow('El monto a pagar debe ser mayor a 0');

      expect(() =>
        pagoCobroItemSchema.parse({
          metodo: 'EFECTIVO',
          monto: -500,
          recibido: 1000,
        }),
      ).toThrow();
    });

    it('rechaza cobro con lista de pagos vacía', () => {
      expect(() =>
        cobroSchema.parse({
          pedidoId: ID_PEDIDO,
          pedidoVersion: 1,
          propina: 0,
          pagos: [],
        }),
      ).toThrow('Debe registrar al menos un pago');
    });
  });

  describe('cobroRespuestaSchema', () => {
    it('valida respuesta de cobro (201 en docs/API.md)', () => {
      const res = cobroRespuestaSchema.parse({
        reciboId: ID_RECIBO,
        numero: 'R-000127',
        total: 49700,
        propina: 0,
        cambio: 20000,
      });
      expect(res.numero).toBe('R-000127');
      expect(res.cambio).toBe(20000);
    });
  });

  describe('cerrarSesionCajaSchema & resumenCierreSchema (RN-47)', () => {
    it('RN-47: acepta cierre con efectivo contado ≥ 0 y versión', () => {
      const cierre = cerrarSesionCajaSchema.parse({
        efectivoContado: 145000,
        version: 5,
      });
      expect(cierre.efectivoContado).toBe(145000);
      expect(cierre.version).toBe(5);
    });

    it('RN-47: rechaza cierre con efectivo contado negativo', () => {
      expect(() =>
        cerrarSesionCajaSchema.parse({
          efectivoContado: -100,
          version: 1,
        }),
      ).toThrow();
    });

    it('valida resumen de cierre de sesión', () => {
      const resumen = resumenCierreSchema.parse({
        sesionId: ID_SESION,
        montoApertura: 50000,
        ventasEfectivo: 95000,
        ingresos: 10000,
        retiros: 5000,
        efectivoEsperado: 150000,
        efectivoContado: 148000,
        diferencia: -2000,
        cerradaAt: '2026-10-06T23:00:00.000Z',
      });
      expect(resumen.diferencia).toBe(-2000);
    });
  });
});
