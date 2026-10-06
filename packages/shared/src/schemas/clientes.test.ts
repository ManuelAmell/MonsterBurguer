import { describe, expect, it } from 'vitest';
import {
  buscarClientesQuerySchema,
  clienteSchema,
  clientesPaginadosRespuestaSchema,
  crearClienteSchema,
} from './clientes';

const ID_CLIENTE = '0199b2c4-1111-7000-8000-000000000001';

describe('schemas/clientes', () => {
  describe('clienteSchema', () => {
    it('valida cliente completo con todos los campos', () => {
      const c = clienteSchema.parse({
        id: ID_CLIENTE,
        nombre: 'Carlos Gómez',
        telefono: '3001234567',
        documento: '1098765432',
        email: 'carlos@example.com',
        createdAt: '2026-10-06T18:00:00.000Z',
        updatedAt: '2026-10-06T18:00:00.000Z',
      });
      expect(c.id).toBe(ID_CLIENTE);
      expect(c.nombre).toBe('Carlos Gómez');
      expect(c.telefono).toBe('3001234567');
      expect(c.documento).toBe('1098765432');
      expect(c.email).toBe('carlos@example.com');
    });

    it('valida cliente solo con nombre obligatorio (mínimo de datos)', () => {
      const c = clienteSchema.parse({
        id: ID_CLIENTE,
        nombre: 'Ana Rojas',
      });
      expect(c.id).toBe(ID_CLIENTE);
      expect(c.nombre).toBe('Ana Rojas');
      expect(c.telefono).toBeUndefined();
      expect(c.documento).toBeUndefined();
      expect(c.email).toBeUndefined();
    });

    it('rechaza ID no válido (no UUID)', () => {
      expect(() =>
        clienteSchema.parse({
          id: '123-invalido',
          nombre: 'Juan',
        }),
      ).toThrow('UUID');
    });

    it('rechaza nombre vacío o solo espacios', () => {
      expect(() =>
        clienteSchema.parse({
          id: ID_CLIENTE,
          nombre: '   ',
        }),
      ).toThrow('El nombre del cliente es obligatorio');
    });

    it('rechaza email con formato inválido', () => {
      expect(() =>
        clienteSchema.parse({
          id: ID_CLIENTE,
          nombre: 'Pedro',
          email: 'no-es-correo',
        }),
      ).toThrow('correo electrónico no es válido');
    });

    it('rechaza teléfono menor a 7 dígitos', () => {
      expect(() =>
        clienteSchema.parse({
          id: ID_CLIENTE,
          nombre: 'Pedro',
          telefono: '12345',
        }),
      ).toThrow('al menos 7 caracteres');
    });
  });

  describe('crearClienteSchema', () => {
    it('acepta datos mínimos (solo nombre)', () => {
      const input = crearClienteSchema.parse({
        nombre: '  María Pérez  ',
      });
      expect(input.nombre).toBe('María Pérez');
      expect(input.telefono).toBeUndefined();
    });

    it('acepta todos los campos opcionales con valores nulos o válidos', () => {
      const input = crearClienteSchema.parse({
        nombre: 'David',
        telefono: '3109876543',
        documento: 'CC88776655',
        email: 'david@correo.co',
      });
      expect(input.nombre).toBe('David');
      expect(input.telefono).toBe('3109876543');
      expect(input.documento).toBe('CC88776655');
      expect(input.email).toBe('david@correo.co');
    });

    it('rechaza si falta el nombre', () => {
      expect(() => crearClienteSchema.parse({})).toThrow();
    });
  });

  describe('buscarClientesQuerySchema', () => {
    it('acepta consulta vacía con valores por defecto', () => {
      const q = buscarClientesQuerySchema.parse({});
      expect(q.limit).toBe(50);
      expect(q.cursor).toBeUndefined();
      expect(q.q).toBeUndefined();
    });

    it('acepta parámetro q y paginación', () => {
      const q = buscarClientesQuerySchema.parse({
        q: '  Gómez  ',
        limit: '20',
        cursor: ID_CLIENTE,
      });
      expect(q.q).toBe('Gómez');
      expect(q.limit).toBe(20);
      expect(q.cursor).toBe(ID_CLIENTE);
    });

    it('rechaza límite fuera de rango', () => {
      expect(() => buscarClientesQuerySchema.parse({ limit: 0 })).toThrow();
      expect(() => buscarClientesQuerySchema.parse({ limit: 101 })).toThrow();
    });
  });

  describe('clientesPaginadosRespuestaSchema', () => {
    it('valida estructura de respuesta paginada', () => {
      const respuesta = clientesPaginadosRespuestaSchema.parse({
        items: [
          {
            id: ID_CLIENTE,
            nombre: 'Cliente 1',
          },
        ],
        nextCursor: null,
      });
      expect(respuesta.items).toHaveLength(1);
      expect(respuesta.nextCursor).toBeNull();
    });
  });
});
