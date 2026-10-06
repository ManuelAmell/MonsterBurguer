import { HttpStatus } from '@nestjs/common';
import { CODIGOS_ERROR, type CodigoError } from '@mb/shared';

/** Error de negocio con código estable; el filtro global lo traduce al formato de error de la API. */
export class DomainError extends Error {
  constructor(
    readonly codigo: CodigoError | (string & {}),
    mensaje: string,
    readonly status: HttpStatus = HttpStatus.CONFLICT,
    readonly detalles?: unknown,
  ) {
    super(mensaje);
    this.name = 'DomainError';
  }

  static noAutenticado(mensaje = 'Debes iniciar sesión.'): DomainError {
    return new DomainError(CODIGOS_ERROR.NO_AUTENTICADO, mensaje, HttpStatus.UNAUTHORIZED);
  }

  static sinPermiso(mensaje = 'No tienes permiso para realizar esta acción.'): DomainError {
    return new DomainError(CODIGOS_ERROR.SIN_PERMISO, mensaje, HttpStatus.FORBIDDEN);
  }

  static noEncontrado(mensaje = 'No se encontró el recurso.'): DomainError {
    return new DomainError(CODIGOS_ERROR.NO_ENCONTRADO, mensaje, HttpStatus.NOT_FOUND);
  }
}
