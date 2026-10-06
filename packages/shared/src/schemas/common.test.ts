import { describe, expect, it } from 'vitest';
import {
  fechaOperativaSchema,
  paginacionQuerySchema,
  paginacionRespuestaSchema,
  pesosSchema,
  uuidSchema,
} from './common';

describe('schemas/common', () => {
  describe('pesosSchema (RN-01)', () => {
    it('RN-01: acepta montos enteros no negativos en pesos COP', () => {
      expect(pesosSchema.parse(0)).toBe(0);
      expect(pesosSchema.parse(19900)).toBe(19900);
      expect(pesosSchema.parse(1000000)).toBe(1000000);
    });

    it('RN-01: rechaza montos negativos', () => {
      expect(() => pesosSchema.parse(-100)).toThrow();
    });

    it('RN-01: rechaza montos decimales (sin centavos)', () => {
      expect(() => pesosSchema.parse(19900.5)).toThrow();
    });

    it('RN-01: rechaza NaN y no numéricos', () => {
      expect(() => pesosSchema.parse('19900')).toThrow();
      expect(() => pesosSchema.parse(NaN)).toThrow();
    });
  });

  describe('fechaOperativaSchema (RN-16)', () => {
    it('RN-16: acepta fechas operativas válidas en formato YYYY-MM-DD', () => {
      expect(fechaOperativaSchema.parse('2026-10-06')).toBe('2026-10-06');
      expect(fechaOperativaSchema.parse('2025-12-31')).toBe('2025-12-31');
    });

    it('RN-16: rechaza formatos distintos a YYYY-MM-DD', () => {
      expect(() => fechaOperativaSchema.parse('06-10-2026')).toThrow();
      expect(() => fechaOperativaSchema.parse('2026/10/06')).toThrow();
      expect(() => fechaOperativaSchema.parse('2026-1-6')).toThrow();
    });

    it('RN-16: rechaza fechas inexistentes en el calendario', () => {
      expect(() => fechaOperativaSchema.parse('2026-02-30')).toThrow();
      expect(() => fechaOperativaSchema.parse('2026-13-01')).toThrow();
    });
  });

  describe('uuidSchema', () => {
    it('acepta UUID válidos', () => {
      const validUuid = '0199b2c4-1234-7000-8000-000000000001';
      expect(uuidSchema.parse(validUuid)).toBe(validUuid);
    });

    it('rechaza strings que no son UUID', () => {
      expect(() => uuidSchema.parse('no-es-un-uuid')).toThrow();
      expect(() => uuidSchema.parse('')).toThrow();
    });
  });

  describe('paginación', () => {
    it('acepta query de paginación por defecto y con parámetros', () => {
      expect(paginacionQuerySchema.parse({})).toEqual({ limit: 50 });
      expect(paginacionQuerySchema.parse({ limit: '20', cursor: 'cursor-1' })).toEqual({
        limit: 20,
        cursor: 'cursor-1',
      });
    });

    it('rechaza límites de paginación inválidos', () => {
      expect(() => paginacionQuerySchema.parse({ limit: 0 })).toThrow();
      expect(() => paginacionQuerySchema.parse({ limit: 101 })).toThrow();
    });

    it('valida respuesta paginada genérica', () => {
      const esquema = paginacionRespuestaSchema(uuidSchema);
      const res = esquema.parse({
        items: ['0199b2c4-1234-7000-8000-000000000001'],
        nextCursor: null,
      });
      expect(res.items).toHaveLength(1);
      expect(res.nextCursor).toBeNull();
    });
  });
});
