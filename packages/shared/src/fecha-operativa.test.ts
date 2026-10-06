import { describe, expect, it } from 'vitest';
import { fechaOperativa } from './fecha-operativa';

describe('fechaOperativa (RN-16)', () => {
  it('RN-16: 04:59 en Bogotá corresponde al día operativo anterior', () => {
    // 04:59:59 COT (UTC-5) es 09:59:59 UTC
    const instante = new Date('2026-10-06T09:59:59.000Z');
    expect(fechaOperativa(instante)).toBe('2026-10-05');
  });

  it('RN-16: 05:00 en Bogotá inicia el nuevo día operativo (mismo día calendario)', () => {
    // 05:00:00 COT (UTC-5) es 10:00:00 UTC
    const instante = new Date('2026-10-06T10:00:00.000Z');
    expect(fechaOperativa(instante)).toBe('2026-10-06');
  });

  it('RN-16: cruce de medianoche (00:30 COT) sigue perteneciendo al día operativo anterior', () => {
    // 00:30:00 del 7 de octubre en Bogotá es 05:30:00 UTC del 7 de octubre
    const instante = new Date('2026-10-07T05:30:00.000Z');
    expect(fechaOperativa(instante)).toBe('2026-10-06');
  });

  it('RN-16: fin de turno a las 23:59 COT pertenece al mismo día operativo', () => {
    // 23:59:00 del 6 de octubre en Bogotá es 04:59:00 UTC del 7 de octubre
    const instante = new Date('2026-10-07T04:59:00.000Z');
    expect(fechaOperativa(instante)).toBe('2026-10-06');
  });

  it('RN-16: conversión UTC vs Bogotá — evalúa correctamente la hora local', () => {
    // 2026-10-06T02:00:00Z: en UTC es 6 de octubre, pero en Bogotá son las 21:00 del 5 de octubre (≥ 05:00)
    const instanteTarde = new Date('2026-10-06T02:00:00.000Z');
    expect(fechaOperativa(instanteTarde)).toBe('2026-10-05');

    // 2026-10-06T08:00:00Z: en UTC es 6 de octubre, en Bogotá son las 03:00 del 6 de octubre (< 05:00)
    const instanteMadrugada = new Date('2026-10-06T08:00:00.000Z');
    expect(fechaOperativa(instanteMadrugada)).toBe('2026-10-05');
  });

  it('RN-16: cruce de fin de año antes de las 05:00 asigna el último día del año anterior', () => {
    // 2026-01-01T08:00:00Z es 2026-01-01 03:00 COT (< 05:00)
    const instanteAnioNuevo = new Date('2026-01-01T08:00:00.000Z');
    expect(fechaOperativa(instanteAnioNuevo)).toBe('2025-12-31');
  });

  it('RN-16: permite hora de corte personalizada configurable', () => {
    // Con corte a las 06:00, 05:30 COT (10:30 UTC) aún es del día anterior
    const instante = new Date('2026-10-06T10:30:00.000Z');
    expect(fechaOperativa(instante, '06:00')).toBe('2026-10-05');
    // A las 06:00 COT (11:00 UTC) ya es el nuevo día
    const instanteCorte = new Date('2026-10-06T11:00:00.000Z');
    expect(fechaOperativa(instanteCorte, '06:00')).toBe('2026-10-06');
  });

  it('RN-16: rechaza fechas inválidas con TypeError', () => {
    expect(() => fechaOperativa(new Date('fecha-invalida'))).toThrow(TypeError);
  });

  it('RN-16: rechaza horaCorte malformada con RangeError', () => {
    expect(() => fechaOperativa(new Date(), '25:00')).toThrow(RangeError);
    expect(() => fechaOperativa(new Date(), 'invalida')).toThrow(RangeError);
    expect(() => fechaOperativa(new Date(), '05:60')).toThrow(RangeError);
  });
});
