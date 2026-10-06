import { describe, expect, it } from 'vitest';
import {
  crearAjusteInventarioSchema,
  crearEntradaInventarioSchema,
  crearIngredienteSchema,
  crearMermaInventarioSchema,
  editarIngredienteSchema,
  ingredienteSchema,
  kardexRespuestaSchema,
  movimientoInventarioSchema,
} from './inventario';

const ID_ING = '0199b2c4-3333-7000-8000-000000000003';
const ID_USR = '0199b2c4-5555-7000-8000-000000000005';
const ID_MOV = '0199b2c4-6666-7000-8000-000000000006';

describe('schemas/inventario', () => {
  describe('ingredienteSchema & crearIngredienteSchema (RN-30)', () => {
    it('RN-30: acepta ingrediente con unidad base válida (G, ML, UND) y stock entero', () => {
      const g = crearIngredienteSchema.parse({
        nombre: 'Carne Molida',
        unidad: 'G',
        stockMinimo: 1000,
      });
      expect(g.unidad).toBe('G');

      const ml = crearIngredienteSchema.parse({
        nombre: 'Salsa Especial',
        unidad: 'ML',
      });
      expect(ml.unidad).toBe('ML');

      const und = crearIngredienteSchema.parse({
        nombre: 'Pan Brioche',
        unidad: 'UND',
      });
      expect(und.unidad).toBe('UND');
    });

    it('RN-30: rechaza unidades no permitidas (ej: KG, L, PIEZA)', () => {
      expect(() =>
        crearIngredienteSchema.parse({
          nombre: 'Papas',
          unidad: 'KG' as unknown as 'G',
        }),
      ).toThrow('La unidad debe ser una de las permitidas');
    });

    it('RN-30: rechaza cantidades decimales en stock o mínimos', () => {
      expect(() =>
        ingredienteSchema.parse({
          id: ID_ING,
          nombre: 'Tocineta',
          unidad: 'G',
          stockActual: 500.5,
          stockMinimo: 100,
          costoUnitario: 35000,
          activo: true,
        }),
      ).toThrow();

      expect(() =>
        crearIngredienteSchema.parse({
          nombre: 'Tocineta',
          unidad: 'G',
          stockMinimo: 100.25,
        }),
      ).toThrow();
    });

    it('valida edición de ingrediente (sin editar stock directamente, RN-34)', () => {
      const edit = editarIngredienteSchema.parse({
        nombre: 'Pan Brioche Premium',
        stockMinimo: 50,
      });
      expect(edit.nombre).toBe('Pan Brioche Premium');
      expect((edit as Record<string, unknown>).stockActual).toBeUndefined();
    });
  });

  describe('entradas de inventario', () => {
    it('acepta entrada con items válidos de cantidad entera > 0', () => {
      const entrada = crearEntradaInventarioSchema.parse({
        items: [{ ingredienteId: ID_ING, cantidad: 5000, costoUnitario: 28000 }],
        nota: 'Compra a proveedor Carnes del Valle',
      });
      expect(entrada.items).toHaveLength(1);
      expect(entrada.items[0]?.cantidad).toBe(5000);
    });

    it('rechaza entrada sin items o con cantidad ≤ 0', () => {
      expect(() =>
        crearEntradaInventarioSchema.parse({
          items: [],
        }),
      ).toThrow('Debe registrar al menos un ingrediente');

      expect(() =>
        crearEntradaInventarioSchema.parse({
          items: [{ ingredienteId: ID_ING, cantidad: 0 }],
        }),
      ).toThrow();
    });
  });

  describe('ajustes de inventario (RN-34)', () => {
    it('RN-34: acepta ajuste con stock contado entero ≥ 0 y motivo obligatorio', () => {
      const ajuste = crearAjusteInventarioSchema.parse({
        ingredienteId: ID_ING,
        stockContado: 450,
        motivo: 'Conteo físico fin de turno',
      });
      expect(ajuste.stockContado).toBe(450);
      expect(ajuste.motivo).toBe('Conteo físico fin de turno');
    });

    it('RN-34: rechaza ajuste con motivo vacío o muy corto (<3 caracteres)', () => {
      expect(() =>
        crearAjusteInventarioSchema.parse({
          ingredienteId: ID_ING,
          stockContado: 450,
          motivo: '  ',
        }),
      ).toThrow();

      expect(() =>
        crearAjusteInventarioSchema.parse({
          ingredienteId: ID_ING,
          stockContado: 450,
          motivo: 'ok',
        }),
      ).toThrow();
    });

    it('rechaza stock contado negativo', () => {
      expect(() =>
        crearAjusteInventarioSchema.parse({
          ingredienteId: ID_ING,
          stockContado: -10,
          motivo: 'Error de digitación',
        }),
      ).toThrow();
    });
  });

  describe('mermas de inventario', () => {
    it('acepta merma con cantidad > 0 y motivo obligatorio', () => {
      const merma = crearMermaInventarioSchema.parse({
        ingredienteId: ID_ING,
        cantidad: 200,
        motivo: 'Carne quemada en parrilla',
      });
      expect(merma.cantidad).toBe(200);
    });

    it('rechaza merma con cantidad ≤ 0 o motivo ausente', () => {
      expect(() =>
        crearMermaInventarioSchema.parse({
          ingredienteId: ID_ING,
          cantidad: 0,
          motivo: 'Dañado',
        }),
      ).toThrow();

      expect(() =>
        crearMermaInventarioSchema.parse({
          ingredienteId: ID_ING,
          cantidad: 10,
          motivo: '   ',
        }),
      ).toThrow();
    });
  });

  describe('movimientoInventarioSchema (RN-34)', () => {
    it('RN-34: acepta movimiento de kardex válido con cantidad con signo ≠ 0', () => {
      const mov = movimientoInventarioSchema.parse({
        id: ID_MOV,
        ingredienteId: ID_ING,
        tipo: 'CONSUMO',
        cantidad: -150,
        stockResultante: 850,
        referenciaTipo: 'PEDIDO',
        referenciaId: '0199b2c4-7777-7000-8000-000000000007',
        usuarioId: ID_USR,
      });
      expect(mov.cantidad).toBe(-150);
      expect(mov.tipo).toBe('CONSUMO');
    });

    it('RN-34: rechaza movimiento con cantidad 0', () => {
      expect(() =>
        movimientoInventarioSchema.parse({
          id: ID_MOV,
          ingredienteId: ID_ING,
          tipo: 'AJUSTE',
          cantidad: 0,
          stockResultante: 500,
          usuarioId: ID_USR,
        }),
      ).toThrow('La cantidad del movimiento no puede ser 0');
    });

    it('valida respuesta paginada de kardex', () => {
      const kardex = kardexRespuestaSchema.parse({
        items: [
          {
            id: ID_MOV,
            ingredienteId: ID_ING,
            tipo: 'ENTRADA',
            cantidad: 1000,
            stockResultante: 1000,
            usuarioId: ID_USR,
          },
        ],
        nextCursor: null,
      });
      expect(kardex.items).toHaveLength(1);
    });
  });
});
