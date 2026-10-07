import { describe, expect, it } from 'vitest';
import {
  CANALES_POR_ROL,
  CANALES_REALTIME,
  EVENTOS_SSE,
  MAPA_INVALIDACION_QUERIES,
  canalRealtimeSchema,
  eventoSseSchema,
  mensajeRealtimeSchema,
  parsearCanales,
  validarCanalesParaRol,
} from './realtime';

describe('realtime schemas and helpers', () => {
  it('valida canales válidos con canalRealtimeSchema', () => {
    expect(CANALES_REALTIME).toContain('cocina');
    expect(canalRealtimeSchema.safeParse('cocina').success).toBe(true);
    expect(canalRealtimeSchema.safeParse('pos').success).toBe(true);
    expect(canalRealtimeSchema.safeParse('admin').success).toBe(true);
    expect(canalRealtimeSchema.safeParse('otro').success).toBe(false);
  });

  it('valida eventos SSE definidos en docs/API.md', () => {
    for (const evento of EVENTOS_SSE) {
      expect(eventoSseSchema.safeParse(evento).success).toBe(true);
      expect(MAPA_INVALIDACION_QUERIES[evento]).toBeDefined();
    }
    expect(eventoSseSchema.safeParse('invalido').success).toBe(false);
  });

  it('valida canales por rol', () => {
    expect(CANALES_POR_ROL.COCINA).toEqual(['cocina']);
    expect(CANALES_POR_ROL.CAJERO).toEqual(['pos']);
    expect(CANALES_POR_ROL.ADMIN).toEqual(['cocina', 'pos', 'admin']);
  });

  it('parsearCanales maneja strings separados por coma y arrays', () => {
    expect(parsearCanales('cocina,pos')).toEqual(['cocina', 'pos']);
    expect(parsearCanales('cocina, invalido, admin')).toEqual(['cocina', 'admin']);
    expect(parsearCanales(['cocina', 'pos'])).toEqual(['cocina', 'pos']);
    expect(parsearCanales(['cocina,pos', 'admin'])).toEqual(['cocina', 'pos', 'admin']);
    expect(parsearCanales(null)).toEqual([]);
    expect(parsearCanales(123)).toEqual([]);
  });

  it('validarCanalesParaRol verifica canales permitidos', () => {
    expect(validarCanalesParaRol(['cocina'], 'COCINA')).toBe(true);
    expect(validarCanalesParaRol(['cocina', 'pos'], 'COCINA')).toBe(false);
    expect(validarCanalesParaRol(['pos'], 'CAJERO')).toBe(true);
    expect(validarCanalesParaRol(['admin'], 'CAJERO')).toBe(false);
    expect(validarCanalesParaRol(['cocina', 'pos', 'admin'], 'ADMIN')).toBe(true);
    expect(validarCanalesParaRol([], 'ADMIN')).toBe(false);
  });

  it('valida estructura de mensaje con mensajeRealtimeSchema', () => {
    const valido = {
      tipo: 'comanda.nueva',
      id: 123,
      datos: { comandaId: 'abc' },
      ts: new Date().toISOString(),
    };
    expect(mensajeRealtimeSchema.safeParse(valido).success).toBe(true);

    const invalido = {
      tipo: '',
      id: -1,
      datos: {},
      ts: 'no-es-iso',
    };
    expect(mensajeRealtimeSchema.safeParse(invalido).success).toBe(false);
  });
});
