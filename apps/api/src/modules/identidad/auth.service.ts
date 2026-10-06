import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { CODIGOS_ERROR, type UsuarioSesion } from '@mb/shared';
import { ENV, type Env } from '../../config/env';
import { DB, type Db } from '../../shared-kernel/db/db';
import { DomainError } from '../../shared-kernel/errors/domain-error';
import { EventBus } from '../../shared-kernel/events/event-bus';
import { nuevoId } from '../../shared-kernel/ids';
import { IdentidadRepository } from './identidad.repository';

/** Una sesión se extiende (expiración deslizante) como máximo cada 5 minutos. */
const INTERVALO_EXTENSION_MS = 5 * 60 * 1000;

export interface SesionValidada {
  usuario: UsuarioSesion;
  /** Nueva expiración si la sesión se extendió en esta petición (hay que reenviar la cookie). */
  extendidaHasta: Date | null;
}

@Injectable()
export class AuthService {
  /** Hash de referencia para igualar el tiempo de respuesta cuando el usuario no existe. */
  private readonly hashFicticio = argon2.hash(randomBytes(16).toString('hex'));

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    private readonly repo: IdentidadRepository,
    private readonly bus: EventBus,
  ) {}

  get ttlMs(): number {
    return this.env.SESSION_TTL_HORAS * 60 * 60 * 1000;
  }

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async login(
    username: string,
    password: string,
    meta: { ip?: string | undefined; userAgent?: string | undefined },
  ): Promise<{ token: string; usuario: UsuarioSesion }> {
    const encontrado = await this.repo.buscarPorUsername(username);
    const passwordOk = encontrado
      ? await argon2.verify(encontrado.passwordHash, password)
      : await argon2.verify(await this.hashFicticio, password).then(() => false);

    if (!encontrado || !encontrado.activo || !passwordOk) {
      throw new DomainError(
        CODIGOS_ERROR.CREDENCIALES_INVALIDAS,
        'Usuario o contraseña incorrectos.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const token = randomBytes(32).toString('base64url');
    const usuario: UsuarioSesion = {
      id: encontrado.id,
      nombre: encontrado.nombre,
      username: encontrado.username,
      rol: encontrado.rol,
    };

    await this.db.transaction(async (tx) => {
      await this.repo.borrarSesionesExpiradas(tx, usuario.id);
      const sesionId = nuevoId();
      await this.repo.crearSesion(tx, {
        id: sesionId,
        usuarioId: usuario.id,
        tokenHash: hashToken(token),
        expiraAt: new Date(Date.now() + this.ttlMs),
        ip: meta.ip ?? null,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
      });
      await this.bus.publicarEnTx(tx, {
        tipo: 'SesionIniciada',
        modulo: 'identidad',
        agregadoId: usuario.id,
        usuarioId: usuario.id,
        payload: { sesionId, rol: usuario.rol },
      });
    });

    return { token, usuario };
  }

  async validarSesion(token: string): Promise<SesionValidada | null> {
    const sesion = await this.repo.buscarSesionVigente(hashToken(token));
    if (!sesion) return null;

    let extendidaHasta: Date | null = null;
    if (Date.now() - sesion.ultimoUsoAt.getTime() > INTERVALO_EXTENSION_MS) {
      extendidaHasta = new Date(Date.now() + this.ttlMs);
      await this.repo.extenderSesion(sesion.sesionId, extendidaHasta);
    }
    return {
      usuario: { id: sesion.usuarioId, nombre: sesion.nombre, username: sesion.username, rol: sesion.rol },
      extendidaHasta,
    };
  }

  async logout(token: string): Promise<void> {
    const usuarioId = await this.repo.borrarSesion(hashToken(token));
    if (usuarioId) {
      await this.bus.publicar({
        tipo: 'SesionCerrada',
        modulo: 'identidad',
        agregadoId: usuarioId,
        usuarioId,
        payload: {},
      });
    }
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
