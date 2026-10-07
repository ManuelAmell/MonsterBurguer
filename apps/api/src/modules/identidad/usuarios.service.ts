import { HttpStatus, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import type {
  ActualizarUsuarioOutput,
  CrearUsuarioOutput,
  RestablecerClaveOutput,
  UsuarioDetalle,
  UsuarioSesion,
} from '@mb/shared';
import { esViolacionUnicidad } from '../../shared-kernel/db/db';
import { DomainError } from '../../shared-kernel/errors/domain-error';
import { nuevoId } from '../../shared-kernel/ids';
import { IdentidadRepository, type Usuario } from './identidad.repository';

@Injectable()
export class UsuariosService {
  constructor(private readonly repo: IdentidadRepository) {}

  private mapearDetalle(u: Omit<Usuario, 'passwordHash'>): UsuarioDetalle {
    return {
      id: u.id,
      nombre: u.nombre,
      username: u.username,
      rol: u.rol,
      activo: u.activo,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    };
  }

  async listar(): Promise<UsuarioDetalle[]> {
    const usuarios = await this.repo.listarUsuarios();
    return usuarios.map((u) => this.mapearDetalle(u));
  }

  async crear(input: CrearUsuarioOutput): Promise<UsuarioDetalle> {
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const id = nuevoId();
    const username = input.username.trim().toLowerCase();

    try {
      const creado = await this.repo.crearUsuario({
        id,
        nombre: input.nombre.trim(),
        username,
        passwordHash,
        rol: input.rol,
        activo: true,
      });
      return this.mapearDetalle(creado);
    } catch (err: unknown) {
      if (esViolacionUnicidad(err)) {
        throw new DomainError(
          'USERNAME_DUPLICADO',
          'El nombre de usuario ya está registrado.',
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
  }

  async actualizar(
    id: string,
    input: ActualizarUsuarioOutput,
    usuarioActual: UsuarioSesion,
  ): Promise<UsuarioDetalle> {
    const existente = await this.repo.buscarPorId(id);
    if (!existente) {
      throw DomainError.noEncontrado('Usuario no encontrado.');
    }

    // Seguridad: Un admin no puede desactivarse a sí mismo ni quitarse el rol ADMIN
    if (id === usuarioActual.id) {
      if (input.activo === false) {
        throw new DomainError(
          'OPERACION_INVALIDA',
          'Un administrador no puede desactivarse a sí mismo.',
          HttpStatus.CONFLICT,
        );
      }
      if (input.rol !== undefined && input.rol !== 'ADMIN') {
        throw new DomainError(
          'OPERACION_INVALIDA',
          'Un administrador no puede quitarse el rol ADMIN a sí mismo.',
          HttpStatus.CONFLICT,
        );
      }
    }

    // Seguridad: Siempre debe quedar al menos un ADMIN activo (409)
    if (existente.rol === 'ADMIN' && existente.activo) {
      const vaADesactivar = input.activo === false;
      const vaACambiarRol = input.rol !== undefined && input.rol !== 'ADMIN';
      if (vaADesactivar || vaACambiarRol) {
        const adminsActivos = await this.repo.contarAdminsActivos();
        if (adminsActivos <= 1) {
          throw new DomainError(
            'ULTIMO_ADMIN',
            'No se puede desactivar ni modificar el rol del único administrador activo.',
            HttpStatus.CONFLICT,
          );
        }
      }
    }

    const actualizado = await this.repo.actualizarUsuario(id, {
      nombre: input.nombre ? input.nombre.trim() : undefined,
      rol: input.rol,
      activo: input.activo,
    });

    if (!actualizado) {
      throw DomainError.noEncontrado('Usuario no encontrado.');
    }

    // Desactivar un usuario invalida sus sesiones activas de inmediato
    if (input.activo === false) {
      await this.repo.invalidarSesionesUsuario(id);
    }

    return this.mapearDetalle(actualizado);
  }

  async restablecerClave(id: string, input: RestablecerClaveOutput): Promise<{ ok: boolean }> {
    const existente = await this.repo.buscarPorId(id);
    if (!existente) {
      throw DomainError.noEncontrado('Usuario no encontrado.');
    }

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    await this.repo.actualizarPasswordHash(id, passwordHash);

    // Cambiar la clave invalida las sesiones activas del usuario
    await this.repo.invalidarSesionesUsuario(id);

    return { ok: true };
  }
}
