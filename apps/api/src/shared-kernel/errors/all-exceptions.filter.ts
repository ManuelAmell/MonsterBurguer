import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Response } from 'express';
import { ZodError } from 'zod';
import { CODIGOS_ERROR, type ApiErrorBody } from '@mb/shared';
import { DomainError } from './domain-error';

const CODIGO_POR_STATUS: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: CODIGOS_ERROR.VALIDACION,
  [HttpStatus.UNAUTHORIZED]: CODIGOS_ERROR.NO_AUTENTICADO,
  [HttpStatus.FORBIDDEN]: CODIGOS_ERROR.SIN_PERMISO,
  [HttpStatus.NOT_FOUND]: CODIGOS_ERROR.NO_ENCONTRADO,
};

/** Traduce cualquier excepción al formato único `{ codigo, mensaje, detalles? }` (docs/API.md). */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errores');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const [status, body] = this.traducir(exception);
    if (status >= 500) this.logger.error(exception);
    res.status(status).json(body);
  }

  private traducir(exception: unknown): [number, ApiErrorBody] {
    if (exception instanceof DomainError) {
      return [
        exception.status,
        { codigo: exception.codigo, mensaje: exception.message, detalles: exception.detalles },
      ];
    }
    if (exception instanceof ZodError) {
      return [
        HttpStatus.BAD_REQUEST,
        {
          codigo: CODIGOS_ERROR.VALIDACION,
          mensaje: 'Los datos enviados no son válidos.',
          detalles: exception.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
        },
      ];
    }
    if (exception instanceof ThrottlerException) {
      return [
        HttpStatus.TOO_MANY_REQUESTS,
        {
          codigo: CODIGOS_ERROR.DEMASIADOS_INTENTOS,
          mensaje: 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.',
        },
      ];
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return [
        status,
        {
          codigo: CODIGO_POR_STATUS[status] ?? CODIGOS_ERROR.ERROR_INTERNO,
          mensaje: status === HttpStatus.NOT_FOUND ? 'Ruta no encontrada.' : exception.message,
        },
      ];
    }
    return [
      HttpStatus.INTERNAL_SERVER_ERROR,
      { codigo: CODIGOS_ERROR.ERROR_INTERNO, mensaje: 'Ocurrió un error inesperado.' },
    ];
  }
}
