import { describe, expect, it } from 'vitest';
import {
  alertaSchema,
  reporteVentasQuerySchema,
  reporteVentasRespuestaSchema,
} from './reportes';

describe('Esquemas de Reportes y Alertas', () => {
  describe('reporteVentasQuerySchema (RN-16)', () => {
    it('RN-16: acepta parámetros válidos con fechas operativas dentro de los 92 días', () => {
      const parsed = reporteVentasQuerySchema.parse({
        desde: '2026-10-01',
        hasta: '2026-10-07',
        agrupar: 'dia',
      });
      expect(parsed.desde).toBe('2026-10-01');
      expect(parsed.hasta).toBe('2026-10-07');
      expect(parsed.agrupar).toBe('dia');
    });

    it('asigna "dia" por defecto si no se especifica agrupacion', () => {
      const parsed = reporteVentasQuerySchema.parse({
        desde: '2026-10-01',
        hasta: '2026-10-07',
      });
      expect(parsed.agrupar).toBe('dia');
    });

    it('rechaza si desde > hasta', () => {
      expect(() =>
        reporteVentasQuerySchema.parse({
          desde: '2026-10-08',
          hasta: '2026-10-07',
        }),
      ).toThrow();
    });

    it('rechaza si el rango supera 92 días', () => {
      expect(() =>
        reporteVentasQuerySchema.parse({
          desde: '2026-01-01',
          hasta: '2026-05-01', // 120 días
        }),
      ).toThrow(/92 días/);
    });

    it('acepta exactamente 92 días de diferencia', () => {
      // 2026-01-01 a 2026-04-03 es exactamente 92 días
      const parsed = reporteVentasQuerySchema.parse({
        desde: '2026-01-01',
        hasta: '2026-04-03',
      });
      expect(parsed.desde).toBe('2026-01-01');
      expect(parsed.hasta).toBe('2026-04-03');
    });
  });

  describe('reporteVentasRespuestaSchema', () => {
    it('valida una respuesta de reporte completa con totales y anulados', () => {
      const respuesta = {
        desde: '2026-10-01',
        hasta: '2026-10-07',
        agrupar: 'dia' as const,
        items: [
          {
            clave: '2026-10-01',
            etiqueta: '2026-10-01',
            pedidos: 10,
            ventas: 250000,
            propinas: 20000,
            ticketPromedio: 25000,
          },
        ],
        totales: {
          pedidos: 10,
          ventas: 250000,
          propinas: 20000,
          ticketPromedio: 25000,
          anulados: {
            cantidad: 1,
            monto: 30000,
          },
        },
      };

      const parsed = reporteVentasRespuestaSchema.parse(respuesta);
      expect(parsed.items).toHaveLength(1);
      expect(parsed.totales.anulados.cantidad).toBe(1);
    });
  });

  describe('alertaSchema (RN-17, RN-36)', () => {
    it('RN-17: valida alerta de pedido olvidado', () => {
      const alerta = {
        tipo: 'PEDIDO_OLVIDADO' as const,
        severidad: 'ADVERTENCIA' as const,
        entidadId: '0199b2c4-87a1-7c9b-b530-1c8f12a34567',
        datos: {
          pedidoId: '0199b2c4-87a1-7c9b-b530-1c8f12a34567',
          numeroDia: 14,
          mesaNombre: 'Mesa 3',
          abiertoDesde: '2026-10-07T06:00:00.000Z',
        },
      };

      const parsed = alertaSchema.parse(alerta);
      expect(parsed.tipo).toBe('PEDIDO_OLVIDADO');
      expect(parsed.severidad).toBe('ADVERTENCIA');
    });

    it('RN-36: valida alerta de ingrediente bajo minimo', () => {
      const alerta = {
        tipo: 'INGREDIENTE_BAJO_MINIMO' as const,
        severidad: 'ADVERTENCIA' as const,
        entidadId: '0199b2c4-87a1-7c9b-b530-1c8f12a34567',
        datos: {
          ingredienteId: '0199b2c4-87a1-7c9b-b530-1c8f12a34567',
          nombre: 'Pan Brioche',
          stockActual: 10,
          stockMinimo: 30,
          unidad: 'UND' as const,
        },
      };

      const parsed = alertaSchema.parse(alerta);
      expect(parsed.tipo).toBe('INGREDIENTE_BAJO_MINIMO');
      expect(parsed.severidad).toBe('ADVERTENCIA');
    });

    it('RN-36: valida alerta de ingrediente agotado con severidad CRITICA', () => {
      const alerta = {
        tipo: 'INGREDIENTE_AGOTADO' as const,
        severidad: 'CRITICA' as const,
        entidadId: '0199b2c4-87a1-7c9b-b530-1c8f12a34567',
        datos: {
          ingredienteId: '0199b2c4-87a1-7c9b-b530-1c8f12a34567',
          nombre: 'Tocineta',
          unidad: 'G' as const,
        },
      };

      const parsed = alertaSchema.parse(alerta);
      expect(parsed.tipo).toBe('INGREDIENTE_AGOTADO');
      expect(parsed.severidad).toBe('CRITICA');
    });

    it('valida alerta de producto agotado con severidad CRITICA', () => {
      const alerta = {
        tipo: 'PRODUCTO_AGOTADO' as const,
        severidad: 'CRITICA' as const,
        entidadId: '0199b2c4-87a1-7c9b-b530-1c8f12a34567',
        datos: {
          productoId: '0199b2c4-87a1-7c9b-b530-1c8f12a34567',
          nombre: 'Monster Doble',
        },
      };

      const parsed = alertaSchema.parse(alerta);
      expect(parsed.tipo).toBe('PRODUCTO_AGOTADO');
      expect(parsed.severidad).toBe('CRITICA');
    });
  });
});
