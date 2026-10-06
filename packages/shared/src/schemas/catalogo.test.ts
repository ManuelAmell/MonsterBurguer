import { describe, expect, it } from 'vitest';
import {
  actualizarAgotadoManualSchema,
  actualizarRecetaSchema,
  categoriaSchema,
  crearCategoriaSchema,
  crearProductoSchema,
  editarCategoriaSchema,
  editarProductoSchema,
  menuPosSchema,
  productoDetalleSchema,
  productoSchema,
} from './catalogo';

const ID_CAT = '0199b2c4-1111-7000-8000-000000000001';
const ID_PROD = '0199b2c4-2222-7000-8000-000000000002';
const ID_ING1 = '0199b2c4-3333-7000-8000-000000000003';
const ID_ING2 = '0199b2c4-4444-7000-8000-000000000004';

describe('schemas/catalogo', () => {
  describe('productoSchema & crearProductoSchema (RN-02)', () => {
    it('RN-02: acepta producto con precio entero en COP > 0', () => {
      const prod = crearProductoSchema.parse({
        categoriaId: ID_CAT,
        nombre: 'Monster Clásica',
        precio: 25000,
        descripcion: 'Carne artesanal 150g, queso cheddar y tocineta',
      });
      expect(prod.precio).toBe(25000);
      expect(prod.nombre).toBe('Monster Clásica');
    });

    it('RN-02: rechaza producto con precio = 0', () => {
      expect(() =>
        crearProductoSchema.parse({
          categoriaId: ID_CAT,
          nombre: 'Monster Clásica',
          precio: 0,
        }),
      ).toThrow();
    });

    it('RN-02: rechaza producto con precio negativo', () => {
      expect(() =>
        crearProductoSchema.parse({
          categoriaId: ID_CAT,
          nombre: 'Monster Clásica',
          precio: -15000,
        }),
      ).toThrow();
    });

    it('RN-02: rechaza producto con precio no entero (decimal)', () => {
      expect(() =>
        crearProductoSchema.parse({
          categoriaId: ID_CAT,
          nombre: 'Monster Clásica',
          precio: 25000.5,
        }),
      ).toThrow();
    });

    it('valida producto completo existente', () => {
      const parsed = productoSchema.parse({
        id: ID_PROD,
        categoriaId: ID_CAT,
        nombre: 'Monster Doble',
        precio: 34000,
        activo: true,
        agotado: false,
        agotadoManual: null,
        orden: 1,
      });
      expect(parsed.id).toBe(ID_PROD);
      expect(parsed.agotado).toBe(false);
    });

    it('valida edición de producto', () => {
      const edit = editarProductoSchema.parse({
        precio: 28000,
        activo: false,
      });
      expect(edit.precio).toBe(28000);
      expect(edit.activo).toBe(false);
    });

    it('valida override manual de agotado (RN-36)', () => {
      expect(actualizarAgotadoManualSchema.parse({ agotadoManual: true })).toEqual({
        agotadoManual: true,
      });
      expect(actualizarAgotadoManualSchema.parse({ agotadoManual: null })).toEqual({
        agotadoManual: null,
      });
    });
  });

  describe('receta (RN-31)', () => {
    it('RN-31: acepta receta con ingredientes y cantidades enteros > 0', () => {
      const receta = actualizarRecetaSchema.parse({
        items: [
          { ingredienteId: ID_ING1, cantidad: 150 },
          { ingredienteId: ID_ING2, cantidad: 2 },
        ],
      });
      expect(receta.items).toHaveLength(2);
      expect(receta.items[0]?.cantidad).toBe(150);
    });

    it('RN-31: rechaza cantidad de ingrediente ≤ 0 o decimal', () => {
      expect(() =>
        actualizarRecetaSchema.parse({
          items: [{ ingredienteId: ID_ING1, cantidad: 0 }],
        }),
      ).toThrow();

      expect(() =>
        actualizarRecetaSchema.parse({
          items: [{ ingredienteId: ID_ING1, cantidad: -5 }],
        }),
      ).toThrow();

      expect(() =>
        actualizarRecetaSchema.parse({
          items: [{ ingredienteId: ID_ING1, cantidad: 12.5 }],
        }),
      ).toThrow();
    });

    it('RN-31: rechaza ingredientes duplicados en la misma receta', () => {
      expect(() =>
        actualizarRecetaSchema.parse({
          items: [
            { ingredienteId: ID_ING1, cantidad: 100 },
            { ingredienteId: ID_ING1, cantidad: 50 },
          ],
        }),
      ).toThrow('No se pueden repetir ingredientes en la misma receta');
    });

    it('valida producto con receta en detalle', () => {
      const detalle = productoDetalleSchema.parse({
        id: ID_PROD,
        categoriaId: ID_CAT,
        nombre: 'Monster Clásica',
        precio: 25000,
        activo: true,
        agotado: false,
        orden: 1,
        receta: [
          {
            ingredienteId: ID_ING1,
            nombre: 'Carne Molida',
            unidad: 'G',
            cantidad: 150,
          },
        ],
      });
      expect(detalle.receta).toHaveLength(1);
      expect(detalle.receta[0]?.unidad).toBe('G');
    });
  });

  describe('categoría', () => {
    it('valida creación y edición de categoría', () => {
      const creada = crearCategoriaSchema.parse({
        nombre: 'Hamburguesas',
        orden: 1,
      });
      expect(creada.nombre).toBe('Hamburguesas');
      expect(creada.activa).toBe(true);

      const editada = editarCategoriaSchema.parse({
        activa: false,
      });
      expect(editada.activa).toBe(false);
    });

    it('rechaza categoría con nombre vacío', () => {
      expect(() => crearCategoriaSchema.parse({ nombre: '   ' })).toThrow();
    });

    it('valida categoría completa existente', () => {
      const cat = categoriaSchema.parse({
        id: ID_CAT,
        nombre: 'Bebidas',
        orden: 2,
        activa: true,
      });
      expect(cat.nombre).toBe('Bebidas');
    });
  });

  describe('menú del POS (GET /catalogo/menu)', () => {
    it('valida estructura del menú para el POS con categorías y productos', () => {
      const menu = menuPosSchema.parse([
        {
          id: ID_CAT,
          nombre: 'Hamburguesas',
          orden: 1,
          productos: [
            {
              id: ID_PROD,
              nombre: 'Monster Clásica',
              descripcion: 'Con papas',
              precio: 25000,
              imagenUrl: null,
              agotado: false,
              orden: 1,
            },
          ],
        },
      ]);
      expect(menu).toHaveLength(1);
      expect(menu[0]?.productos[0]?.precio).toBe(25000);
    });
  });
});
