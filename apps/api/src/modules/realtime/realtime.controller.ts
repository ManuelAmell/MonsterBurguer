import {
  Controller,
  Get,
  HttpStatus,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  CANALES_POR_ROL,
  type CanalRealtime,
} from '@mb/shared';
import { DomainError } from '../../shared-kernel/errors/domain-error';
import { nuevoId } from '../../shared-kernel/ids';
import { type RequestConUsuario, UsuarioActual } from '../identidad/identidad.public';
import { type ClienteSse, RealtimeHub } from './realtime.hub';
import { RealtimeService } from './realtime.service';

@Controller('stream')
export class RealtimeController {
  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly hub: RealtimeHub,
  ) {}

  @Get()
  async stream(
    @UsuarioActual() usuario: RequestConUsuario['usuario'],
    @Req() req: RequestConUsuario,
    @Res() res: Response,
    @Query('canales') canalesParam?: unknown,
  ): Promise<void> {
    if (!usuario) {
      throw DomainError.noAutenticado();
    }

    const permitidos = CANALES_POR_ROL[usuario.rol] ?? [];
    let canalesSeleccionados: CanalRealtime[];

    const tokens = (
      typeof canalesParam === 'string'
        ? canalesParam.split(',')
        : Array.isArray(canalesParam)
          ? canalesParam.flatMap((c) => (typeof c === 'string' ? c.split(',') : []))
          : []
    )
      .map((c) => c.trim())
      .filter(Boolean);

    if (tokens.length === 0) {
      canalesSeleccionados = [...permitidos];
    } else {
      const noPermitidos = tokens.filter(
        (c) => !(permitidos as readonly string[]).includes(c),
      );
      if (noPermitidos.length > 0) {
        throw DomainError.sinPermiso(
          `Canal(es) no permitido(s) para el rol ${usuario.rol}: ${noPermitidos.join(', ')}.`,
        );
      }
      canalesSeleccionados = tokens as CanalRealtime[];
    }

    // Cabeceras correctas para SSE
    res.status(HttpStatus.OK);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    // Primer chunk inmediato: algunos proxies (el de Vite en desarrollo) no reenvían las
    // cabeceras hasta recibir cuerpo; sin esto el EventSource no abre hasta el primer heartbeat.
    res.write('retry: 3000\n\n');

    // Reenvío de eventos perdidos según Last-Event-ID
    const lastEventIdHeader = req.headers['last-event-id'];
    const lastEventIdQuery = req.query?.['lastEventId'] ?? req.query?.['last_event_id'];
    const rawLastEventId =
      (typeof lastEventIdHeader === 'string' ? lastEventIdHeader : undefined) ??
      (typeof lastEventIdQuery === 'string' ? lastEventIdQuery : undefined);

    if (rawLastEventId !== undefined && rawLastEventId !== '') {
      const lastId = Number(rawLastEventId);
      if (!Number.isNaN(lastId) && lastId >= 0) {
        const perdidos = await this.realtimeService.obtenerEventosReconexion(
          lastId,
          canalesSeleccionados,
        );
        for (const msg of perdidos) {
          const datosStr =
            typeof msg.datos === 'string'
              ? msg.datos
              : JSON.stringify(msg.datos ?? {});
          res.write(`id: ${msg.id}\nevent: ${msg.tipo}\ndata: ${datosStr}\n\n`);
        }
      }
    }

    const clienteId = nuevoId();
    const cliente: ClienteSse = {
      id: clienteId,
      usuarioId: usuario.id,
      rol: usuario.rol,
      canales: new Set(canalesSeleccionados),
      res,
    };

    this.hub.conectar(cliente);

    req.on('close', () => {
      this.hub.desconectar(clienteId);
    });
  }
}
