import { describe, expect, it } from 'vitest';
import {
  agregarPedidoItemSchema,
  anularPedidoSchema,
  confirmarPedidoSchema,
  crearMesaSchema,
  crearPedidoSchema,
  editarPedidoItemSchema,
  mesaSchema,
  pedidoItemSchema,
  pedidoSchema,
} from './pedidos';

const ID_MESA = '0199b2c4-1111-7000-8000-000000000001';
const ID_PEDIDO = '0199b2c4-2222-7000-8000-000000000002';
const ID_PROD = '0199b2c4-3333-7000-8000-000000000003';
const ID_ITEM = '0199b2c4-4444-7000-8000-000000000004';

describe('schemas/pedidos', () => {
  describe('crearPedidoSchema (RN-11)', () => {
    it('RN-11: acepta pedido MESA con mesaId especificado', () => {
      const pedido = crearPedidoSchema.parse({
        tipo: 'MESA',
        mesaId: ID_MESA,
      });
      expect(pedido.tipo).toBe('MESA');
      expect(pedido.mesaId).toBe(ID_MESA);
    });

    it('RN-11: rechaza pedido MESA sin mesaId', () => {
      expect(() =>
        crearPedidoSchema.parse({
          tipo: 'MESA',
        }),
      ).toThrow('Un pedido de tipo MESA requiere una mesa asignada');

      expect(() =>
        crearPedidoSchema.parse({
          tipo: 'MESA',
          mesaId: null,
        }),
      ).toThrow('Un pedido de tipo MESA requiere una mesa asignada');
    });

    it('RN-11: acepta pedido LLEVAR sin mesaId', () => {
      const pedido = crearPedidoSchema.parse({
        tipo: 'LLEVAR',
        nota: 'Para llevar en bolsa biodegradable',
      });
      expect(pedido.tipo).toBe('LLEVAR');
      expect(pedido.mesaId).toBeUndefined();
    });

    it('RN-11: rechaza pedido LLEVAR con mesaId asignado', () => {
      expect(() =>
        crearPedidoSchema.parse({
          tipo: 'LLEVAR',
          mesaId: ID_MESA,
        }),
      ).toThrow('un pedido LLEVAR no debe tener mesa asignada');
    });
  });

  describe('pedidoItemSchema & agregarPedidoItemSchema (RN-12)', () => {
    it('RN-12: acepta ítem con cantidad entre 1 y 99 y nota ≤ 140 caracteres', () => {
      const item1 = agregarPedidoItemSchema.parse({
        productoId: ID_PROD,
        cantidad: 1,
        nota: 'Sin cebolla',
      });
      expect(item1.cantidad).toBe(1);

      const item99 = agregarPedidoItemSchema.parse({
        productoId: ID_PROD,
        cantidad: 99,
        nota: 'a'.repeat(140),
      });
      expect(item99.cantidad).toBe(99);
      expect(item99.nota?.length).toBe(140);
    });

    it('RN-12: rechaza cantidad = 0, negativa o decimal', () => {
      expect(() =>
        agregarPedidoItemSchema.parse({
          productoId: ID_PROD,
          cantidad: 0,
        }),
      ).toThrow('La cantidad mínima por ítem es 1');

      expect(() =>
        agregarPedidoItemSchema.parse({
          productoId: ID_PROD,
          cantidad: -1,
        }),
      ).toThrow('La cantidad mínima por ítem es 1');

      expect(() =>
        agregarPedidoItemSchema.parse({
          productoId: ID_PROD,
          cantidad: 2.5,
        }),
      ).toThrow();
    });

    it('RN-12: rechaza cantidad > 99', () => {
      expect(() =>
        agregarPedidoItemSchema.parse({
          productoId: ID_PROD,
          cantidad: 100,
        }),
      ).toThrow('La cantidad máxima por ítem es 99');
    });

    it('RN-12: rechaza nota con más de 140 caracteres', () => {
      expect(() =>
        agregarPedidoItemSchema.parse({
          productoId: ID_PROD,
          cantidad: 1,
          nota: 'a'.repeat(141),
        }),
      ).toThrow('La nota del ítem no puede superar 140 caracteres');
    });

    it('valida edición de ítem de pedido', () => {
      const edit = editarPedidoItemSchema.parse({
        cantidad: 3,
        nota: 'Bien cocida',
      });
      expect(edit.cantidad).toBe(3);
    });

    it('valida ítem completo existente en respuesta', () => {
      const item = pedidoItemSchema.parse({
        id: ID_ITEM,
        productoId: ID_PROD,
        nombre: 'Monster Clásica',
        precioUnitario: 19900,
        cantidad: 2,
        nota: 'sin cebolla',
        totalLinea: 39800,
      });
      expect(item.totalLinea).toBe(39800);
    });
  });

  describe('pedidoSchema (respuesta completa según docs/API.md)', () => {
    it('valida estructura de pedido de ejemplo en docs/API.md', () => {
      const payload = {
        id: ID_PEDIDO,
        numeroDia: 14,
        fechaOperativa: '2026-10-06',
        tipo: 'MESA',
        mesa: { id: ID_MESA, nombre: 'Mesa 4' },
        estado: 'CONFIRMADO',
        estadoComanda: 'EN_PREPARACION',
        items: [
          {
            id: ID_ITEM,
            productoId: ID_PROD,
            nombre: 'Monster Clásica',
            precioUnitario: 19900,
            cantidad: 2,
            nota: 'sin cebolla',
            totalLinea: 39800,
          },
        ],
        total: 49700,
        base: 49700,
        impuesto: 0,
        version: 3,
        createdAt: '2026-10-06T19:40:02.000Z',
      };

      const pedido = pedidoSchema.parse(payload);
      expect(pedido.id).toBe(ID_PEDIDO);
      expect(pedido.numeroDia).toBe(14);
      expect(pedido.fechaOperativa).toBe('2026-10-06');
      expect(pedido.mesa?.nombre).toBe('Mesa 4');
      expect(pedido.total).toBe(49700);
      expect(pedido.items[0]?.totalLinea).toBe(39800);
    });
  });

  describe('confirmarPedidoSchema y anularPedidoSchema (RN-50)', () => {
    it('valida confirmación de pedido con versión', () => {
      const conf = confirmarPedidoSchema.parse({ version: 2 });
      expect(conf.version).toBe(2);
    });

    it('rechaza versión negativa en confirmación', () => {
      expect(() => confirmarPedidoSchema.parse({ version: -1 })).toThrow();
    });

    it('RN-50: acepta anulación con motivo ≥ 5 caracteres y versión', () => {
      const anulacion = anularPedidoSchema.parse({
        version: 3,
        motivo: 'Cliente canceló el pedido por demora',
      });
      expect(anulacion.motivo).toBe('Cliente canceló el pedido por demora');
      expect(anulacion.version).toBe(3);
    });

    it('RN-50: rechaza anulación con motivo < 5 caracteres o vacío', () => {
      expect(() =>
        anularPedidoSchema.parse({
          version: 1,
          motivo: 'test',
        }),
      ).toThrow('El motivo de anulación debe tener al menos 5 caracteres (RN-50)');

      expect(() =>
        anularPedidoSchema.parse({
          version: 1,
          motivo: '   ',
        }),
      ).toThrow();
    });
  });

  describe('mesaSchema', () => {
    it('valida mesa y creación de mesa', () => {
      const creada = crearMesaSchema.parse({
        nombre: 'Mesa 1',
        capacidad: 4,
      });
      expect(creada.nombre).toBe('Mesa 1');
      expect(creada.capacidad).toBe(4);

      const m = mesaSchema.parse({
        id: ID_MESA,
        nombre: 'Mesa 1',
        capacidad: 4,
        activa: true,
        orden: 1,
      });
      expect(m.id).toBe(ID_MESA);
    });
  });
});
