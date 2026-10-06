import { HttpStatus, Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { CODIGOS_ERROR, type Rol } from '@mb/shared';
import { ENV, type Env } from '../../config/env';
import { DomainError } from '../../shared-kernel/errors/domain-error';
import { PUBLICO_KEY, ROLES_KEY, type RequestConUsuario } from './auth.decorators';
import { AuthService } from './auth.service';

export const COOKIE_SESION = 'mb_session';

const METODOS_MUTANTES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function opcionesCookie(env: Env, maxAgeMs: number) {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeMs,
  };
}

/** Defensa CSRF complementaria a SameSite=Strict: rechaza métodos mutantes desde otro origen. */
@Injectable()
export class OrigenGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<RequestConUsuario>();
    const origen = req.headers.origin;
    if (METODOS_MUTANTES.has(req.method) && origen && origen !== this.env.APP_ORIGIN) {
      throw new DomainError(
        CODIGOS_ERROR.ORIGEN_NO_PERMITIDO,
        'Origen no permitido.',
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}

/** Exige sesión válida salvo en endpoints @Publico(); extiende la cookie si la sesión se deslizó. */
@Injectable()
export class SesionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const publico = this.reflector.getAllAndOverride<boolean>(PUBLICO_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (publico) return true;

    const http = ctx.switchToHttp();
    const req = http.getRequest<RequestConUsuario>();
    const token: unknown = req.cookies?.[COOKIE_SESION];
    if (typeof token !== 'string' || token.length === 0) throw DomainError.noAutenticado();

    const sesion = await this.auth.validarSesion(token);
    if (!sesion) throw DomainError.noAutenticado('Tu sesión expiró. Inicia sesión de nuevo.');

    req.usuario = sesion.usuario;
    if (sesion.extendidaHasta) {
      http
        .getResponse<Response>()
        .cookie(COOKIE_SESION, token, opcionesCookie(this.env, this.auth.ttlMs));
    }
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const usuario = ctx.switchToHttp().getRequest<RequestConUsuario>().usuario;
    if (!usuario || !roles.includes(usuario.rol)) throw DomainError.sinPermiso();
    return true;
  }
}
