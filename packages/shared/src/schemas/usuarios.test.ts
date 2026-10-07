import { describe, expect, it } from 'vitest';
import {
  actualizarUsuarioSchema,
  crearUsuarioSchema,
  restablecerClaveSchema,
  usuarioDetalleSchema,
} from './usuarios';

describe('schemas/usuarios', () => {
  describe('crearUsuarioSchema', () => {
    it('acepta datos válidos y normaliza username a minúsculas', () => {
      const res = crearUsuarioSchema.parse({
        username: '  AdminGeneral  ',
        nombre: '  Juan Pérez  ',
        rol: 'ADMIN',
        password: 'password123',
      });
      expect(res.username).toBe('admingeneral');
      expect(res.nombre).toBe('Juan Pérez');
      expect(res.rol).toBe('ADMIN');
      expect(res.password).toBe('password123');
    });

    it('rechaza contraseñas con longitud menor a 8', () => {
      expect(() =>
        crearUsuarioSchema.parse({
          username: 'caja2',
          nombre: 'Cajero Dos',
          rol: 'CAJERO',
          password: 'short',
        }),
      ).toThrow('La contraseña debe tener al menos 8 caracteres');
    });

    it('rechaza roles no válidos', () => {
      expect(() =>
        crearUsuarioSchema.parse({
          username: 'mesero1',
          nombre: 'Mesero',
          rol: 'MESERO' as unknown as 'ADMIN',
          password: 'password123',
        }),
      ).toThrow();
    });

    it('rechaza nombres vacíos', () => {
      expect(() =>
        crearUsuarioSchema.parse({
          username: 'caja3',
          nombre: '   ',
          rol: 'CAJERO',
          password: 'password123',
        }),
      ).toThrow('El nombre es obligatorio');
    });
  });

  describe('actualizarUsuarioSchema', () => {
    it('permite actualizar campos parciales válidos', () => {
      const res = actualizarUsuarioSchema.parse({
        nombre: 'Nuevo Nombre',
        activo: false,
      });
      expect(res.nombre).toBe('Nuevo Nombre');
      expect(res.activo).toBe(false);
      expect(res.rol).toBeUndefined();
    });

    it('rechaza nombre vacío cuando se envía', () => {
      expect(() =>
        actualizarUsuarioSchema.parse({
          nombre: '   ',
        }),
      ).toThrow('El nombre no puede estar vacío');
    });
  });

  describe('restablecerClaveSchema', () => {
    it('acepta contraseña de 8 o más caracteres', () => {
      const res = restablecerClaveSchema.parse({ password: 'nuevaClave123' });
      expect(res.password).toBe('nuevaClave123');
    });

    it('rechaza contraseña menor a 8 caracteres', () => {
      expect(() => restablecerClaveSchema.parse({ password: '1234567' })).toThrow(
        'La contraseña debe tener al menos 8 caracteres',
      );
    });
  });

  describe('usuarioDetalleSchema', () => {
    it('valida estructura completa sin incluir hash de contraseña', () => {
      const res = usuarioDetalleSchema.parse({
        id: '0199b2c4-1111-7000-8000-000000000001',
        nombre: 'Admin',
        username: 'admin',
        rol: 'ADMIN',
        activo: true,
        createdAt: '2026-10-07T12:00:00.000Z',
        updatedAt: '2026-10-07T12:00:00.000Z',
      });
      expect(res.username).toBe('admin');
      expect('passwordHash' in res).toBe(false);
    });
  });
});
