import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { loginSchema, type UsuarioSesion } from '@mb/shared';
import { ENV, type Env } from '../../config/env';
import { ZodPipe } from '../../shared-kernel/validation/zod.pipe';
import { Publico, UsuarioActual, type RequestConUsuario } from './auth.decorators';
import { COOKIE_SESION, opcionesCookie } from './auth.guards';
import { AuthService } from './auth.service';
import type { z } from 'zod';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** HU-01. Máximo 5 intentos por minuto por IP. */
  @Publico()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodPipe(loginSchema)) body: z.output<typeof loginSchema>,
    @Req() req: RequestConUsuario,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ usuario: UsuarioSesion }> {
    const { token, usuario } = await this.auth.login(body.username, body.password, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.cookie(COOKIE_SESION, token, opcionesCookie(this.env, this.auth.ttlMs));
    return { usuario };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: RequestConUsuario, @Res({ passthrough: true }) res: Response): Promise<void> {
    const token: unknown = req.cookies?.[COOKIE_SESION];
    if (typeof token === 'string') await this.auth.logout(token);
    const { maxAge: _maxAge, ...opciones } = opcionesCookie(this.env, 0);
    res.clearCookie(COOKIE_SESION, opciones);
  }

  @Get('me')
  me(@UsuarioActual() usuario: UsuarioSesion): { usuario: UsuarioSesion } {
    return { usuario };
  }
}
