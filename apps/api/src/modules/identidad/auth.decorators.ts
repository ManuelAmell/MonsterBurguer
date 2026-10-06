import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Rol, UsuarioSesion } from '@mb/shared';

export const PUBLICO_KEY = 'mb:publico';
export const ROLES_KEY = 'mb:roles';

/** Marca un endpoint como accesible sin sesión. */
export const Publico = () => SetMetadata(PUBLICO_KEY, true);

/** Restringe un endpoint a los roles indicados (matriz RN-51). */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);

export interface RequestConUsuario extends Request {
  usuario?: UsuarioSesion;
}

/** Inyecta el usuario autenticado de la petición. */
export const UsuarioActual = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UsuarioSesion | undefined =>
    ctx.switchToHttp().getRequest<RequestConUsuario>().usuario,
);
