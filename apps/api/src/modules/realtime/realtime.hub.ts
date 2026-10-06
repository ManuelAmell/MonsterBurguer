import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import type { Response } from 'express';
import type { CanalRealtime, MensajeRealtime, Rol } from '@mb/shared';

export const HEARTBEAT_INTERVALO_MS_DEFECTO = 25_000;

export interface ClienteSse {
  id: string;
  usuarioId: string;
  rol: Rol;
  canales: Set<CanalRealtime>;
  res: Response;
  heartbeatTimer?: NodeJS.Timeout;
}

@Injectable()
export class RealtimeHub implements OnApplicationShutdown {
  private readonly logger = new Logger(RealtimeHub.name);
  private readonly clientes = new Map<string, ClienteSse>();

  onApplicationShutdown(): void {
    this.destruir();
  }

  /**
   * Conecta un nuevo cliente SSE y programa el envío periódico de heartbeats.
   */
  conectar(cliente: ClienteSse, intervaloHeartbeatMs = HEARTBEAT_INTERVALO_MS_DEFECTO): void {
    // Si ya existía un cliente con el mismo id, limpiar el anterior
    this.desconectar(cliente.id);

    const timer = setInterval(() => {
      this.enviarHeartbeatACliente(cliente);
    }, intervaloHeartbeatMs);

    cliente.heartbeatTimer = timer;
    this.clientes.set(cliente.id, cliente);
    this.logger.debug(
      `Cliente ${cliente.id} conectado (rol: ${cliente.rol}, canales: ${[...cliente.canales].join(',')}). Total: ${this.clientes.size}`,
    );
  }

  /**
   * Desconecta un cliente limpiando su timer de heartbeat y referencias.
   */
  desconectar(clienteId: string): void {
    const cliente = this.clientes.get(clienteId);
    if (!cliente) return;

    if (cliente.heartbeatTimer) {
      clearInterval(cliente.heartbeatTimer);
      cliente.heartbeatTimer = undefined;
    }

    this.clientes.delete(clienteId);
    this.logger.debug(`Cliente ${clienteId} desconectado. Total: ${this.clientes.size}`);
  }

  /**
   * Envía un heartbeat individual `: heartbeat\n\n` a un cliente.
   */
  enviarHeartbeatACliente(cliente: ClienteSse): void {
    try {
      cliente.res.write(': heartbeat\n\n');
    } catch {
      this.desconectar(cliente.id);
    }
  }

  /**
   * Envía un heartbeat a todos los clientes conectados.
   */
  enviarHeartbeatATodos(): void {
    for (const cliente of this.clientes.values()) {
      this.enviarHeartbeatACliente(cliente);
    }
  }

  /**
   * Difunde un mensaje a los clientes suscritos a cualquiera de los canales objetivo.
   * Retorna la cantidad de clientes que recibieron el mensaje.
   */
  difundir(
    canales: CanalRealtime | readonly CanalRealtime[],
    mensaje: MensajeRealtime,
  ): number {
    const canalesTarget = Array.isArray(canales) ? canales : [canales];
    const datosStr =
      typeof mensaje.datos === 'string'
        ? mensaje.datos
        : JSON.stringify(mensaje.datos ?? {});

    const chunk = `id: ${mensaje.id}\nevent: ${mensaje.tipo}\ndata: ${datosStr}\n\n`;

    let enviados = 0;
    for (const cliente of this.clientes.values()) {
      const coincide = canalesTarget.some((c) => cliente.canales.has(c));
      if (!coincide) continue;

      try {
        cliente.res.write(chunk);
        enviados++;
      } catch {
        this.desconectar(cliente.id);
      }
    }

    return enviados;
  }

  /** Número de clientes conectados actualmente. */
  numeroClientes(): number {
    return this.clientes.size;
  }

  /**
   * Cierra todas las conexiones activas al apagar el módulo.
   */
  destruir(): void {
    for (const cliente of this.clientes.values()) {
      if (cliente.heartbeatTimer) {
        clearInterval(cliente.heartbeatTimer);
      }
      try {
        cliente.res.end();
      } catch {
        // Ignorar errores al cerrar
      }
    }
    this.clientes.clear();
  }
}
