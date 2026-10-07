import { describe, expect, it } from 'vitest';
import { configuracionNegocioSchema } from './configuracion';

describe('schemas/configuracion', () => {
  describe('configuracionNegocioSchema', () => {
    it('acepta configuración válida con propina sugerida legal', () => {
      const res = configuracionNegocioSchema.parse({
        nombre: 'MonsterBurguer Cartagena',
        nit: '901.234.567-8',
        direccion: 'Calle 30 # 15-20',
        telefono: '3001234567',
        pieRecibo: 'Gracias por su compra. ¡Vuelva pronto!',
        propinaSugeridaPorcentaje: 10,
        horaCorte: '05:00',
      });
      expect(res.nombre).toBe('MonsterBurguer Cartagena');
      expect(res.propinaSugeridaPorcentaje).toBe(10);
      expect(res.horaCorte).toBe('05:00');
    });

    it('acepta 0% de propina', () => {
      const res = configuracionNegocioSchema.parse({
        nombre: 'MonsterBurguer',
        propinaSugeridaPorcentaje: 0,
        horaCorte: '04:00',
      });
      expect(res.propinaSugeridaPorcentaje).toBe(0);
      expect(res.nit).toBe('');
      expect(res.pieRecibo).toBe('');
    });

    it('RN-06: rechaza propina mayor al 10 % (Ley 1935 de 2018)', () => {
      expect(() =>
        configuracionNegocioSchema.parse({
          nombre: 'MonsterBurguer',
          propinaSugeridaPorcentaje: 11,
          horaCorte: '05:00',
        }),
      ).toThrow('La propina sugerida no puede superar el 10 %');
    });

    it('rechaza propina negativa', () => {
      expect(() =>
        configuracionNegocioSchema.parse({
          nombre: 'MonsterBurguer',
          propinaSugeridaPorcentaje: -1,
          horaCorte: '05:00',
        }),
      ).toThrow('El porcentaje de propina no puede ser negativo');
    });

    it('RN-16: valida formato de hora de corte HH:mm', () => {
      expect(() =>
        configuracionNegocioSchema.parse({
          nombre: 'MonsterBurguer',
          propinaSugeridaPorcentaje: 10,
          horaCorte: '25:00',
        }),
      ).toThrow('La hora de corte debe tener formato HH:mm');

      expect(() =>
        configuracionNegocioSchema.parse({
          nombre: 'MonsterBurguer',
          propinaSugeridaPorcentaje: 10,
          horaCorte: 'cinco',
        }),
      ).toThrow('La hora de corte debe tener formato HH:mm');
    });

    it('rechaza nombre del negocio vacío', () => {
      expect(() =>
        configuracionNegocioSchema.parse({
          nombre: '   ',
          propinaSugeridaPorcentaje: 10,
          horaCorte: '05:00',
        }),
      ).toThrow('El nombre del negocio es obligatorio');
    });
  });
});
