import { describe, expect, it } from 'vitest';
import {
  comandaItemSchema,
  comandaSchema,
  listarComandasQuerySchema,
  transicionComandaSchema,
} from './cocina';

const ID_COMANDA = '0199b2c4-1111-7000-8000-000000000001';
const ID_PEDIDO = '0199b2c4-2222-7000-8000-000000000002';
const ID_ITEM = '0199b2c4-3333-7000-8000-000000000003';

describe('schemas/cocina', () => {
  describe('comandaItemSchema', () => {
    it('acepta ítem de comanda con nombre y cantidad entera > 0', () => {
      const item = comandaItemSchema.parse({
        id: ID_ITEM,
        nombre: 'Monster Clásica',
        cantidad: 2,
        nota: 'Sin cebolla',
      });
      expect(item.nombre).toBe('Monster Clásica');
      expect(item.cantidad).toBe(2);
    });

    it('rechaza ítem de comanda con cantidad ≤ 0 o decimal', () => {
      expect(() =>
        comandaItemSchema.parse({
          id: ID_ITEM,
          nombre: 'Monster Clásica',
          cantidad: 0,
        }),
      ).toThrow();

      expect(() =>
        comandaItemSchema.parse({
          id: ID_ITEM,
          nombre: 'Monster Clásica',
          cantidad: 1.5,
        }),
      ).toThrow();
    });
  });

  describe('comandaSchema', () => {
    it('acepta comanda válida con su estado y lista de ítems', () => {
      const comanda = comandaSchema.parse({
        id: ID_COMANDA,
        pedidoId: ID_PEDIDO,
        numeroDia: 14,
        tipoPedido: 'MESA',
        mesaNombre: 'Mesa 4',
        estado: 'PENDIENTE',
        items: [
          {
            id: ID_ITEM,
            nombre: 'Monster Clásica',
            cantidad: 2,
            nota: 'sin cebolla',
          },
        ],
        version: 0,
        createdAt: '2026-10-06T19:40:00.000Z',
      });
      expect(comanda.id).toBe(ID_COMANDA);
      expect(comanda.estado).toBe('PENDIENTE');
      expect(comanda.items).toHaveLength(1);
    });

    it('rechaza estado de comanda no permitido', () => {
      expect(() =>
        comandaSchema.parse({
          id: ID_COMANDA,
          pedidoId: ID_PEDIDO,
          numeroDia: 14,
          tipoPedido: 'MESA',
          estado: 'ESTADO_INEXISTENTE' as unknown as 'PENDIENTE',
          items: [],
          version: 0,
          createdAt: '2026-10-06T19:40:00.000Z',
        }),
      ).toThrow();
    });
  });

  describe('transicionComandaSchema (RN-21, RN-22)', () => {
    it('acepta transición de comanda con versión entera no negativa', () => {
      const t = transicionComandaSchema.parse({ version: 1 });
      expect(t.version).toBe(1);
    });

    it('rechaza transición con versión negativa o no numérica', () => {
      expect(() => transicionComandaSchema.parse({ version: -1 })).toThrow();
      expect(() => transicionComandaSchema.parse({ version: 'abc' })).toThrow();
    });
  });

  describe('listarComandasQuerySchema', () => {
    it('acepta query de comandas activas o por estado', () => {
      expect(listarComandasQuerySchema.parse({ activas: 'true' })).toEqual({
        activas: true,
      });
      expect(listarComandasQuerySchema.parse({ estado: 'EN_PREPARACION' })).toEqual({
        estado: 'EN_PREPARACION',
      });
    });
  });
});
