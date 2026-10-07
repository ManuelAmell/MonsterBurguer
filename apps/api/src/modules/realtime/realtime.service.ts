import {
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
} from '@nestjs/common';
import { asc, gt } from 'drizzle-orm';
import type { CanalRealtime, MensajeRealtime } from '@mb/shared';
import { DB, type Db } from '../../shared-kernel/db/db';
import { EventBus, type EventoPublicado } from '../../shared-kernel/events/event-bus';
import { eventoSistema } from '../../shared-kernel/events/evento-sistema.schema';
import { BuferCircularEventos } from './bufer-circular';
import {
  MAPA_EVENTOS_SSE_DEFECTO,
  type ReglaMapeoEvento,
} from './realtime-mapa';
import { RealtimeHub } from './realtime.hub';

export function difundir(
  canal: CanalRealtime | readonly CanalRealtime[],
  evento: MensajeRealtime | EventoPublicado,
): void {
  const instancia = RealtimeService.obtenerInstancia();
  if (!instancia) {
    throw new Error('RealtimeService no ha sido inicializado aún.');
  }
  instancia.difundir(canal, evento);
}

@Injectable()
export class RealtimeService implements OnModuleInit {
  private static instancia: RealtimeService | null = null;
  private readonly logger = new Logger(RealtimeService.name);
  private readonly mapaReglas = new Map<string, ReglaMapeoEvento>();
  private bufer = new BuferCircularEventos(500);

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly eventBus: EventBus,
    private readonly hub: RealtimeHub,
  ) {
    RealtimeService.instancia = this;
  }

  static obtenerInstancia(): RealtimeService | null {
    return RealtimeService.instancia;
  }

  onModuleInit(): void {
    for (const regla of MAPA_EVENTOS_SSE_DEFECTO) {
      this.registrarRegla(regla);
    }
  }

  /**
   * Configura la capacidad del búfer circular en memoria (útil para pruebas).
   */
  configurarCapacidadBufer(capacidad: number): void {
    this.bufer = new BuferCircularEventos(capacidad);
  }

  /**
   * Acceso al búfer en memoria (para pruebas o inspección).
   */
  obtenerBufer(): BuferCircularEventos {
    return this.bufer;
  }

  /**
   * Registra una regla de mapeo y suscribe su handler post-commit en el EventBus.
   */
  registrarRegla(regla: ReglaMapeoEvento): void {
    this.mapaReglas.set(regla.eventoOrigen, regla);
    this.eventBus.despuesDeCommit(regla.eventoOrigen, async (evento: EventoPublicado) => {
      const datos = regla.transformar ? regla.transformar(evento.payload) : evento.payload;
      const mensaje: MensajeRealtime = {
        id: evento.id,
        tipo: regla.eventoSse,
        datos,
        ts: evento.createdAt.toISOString(),
      };
      this.bufer.agregar(mensaje, regla.canales);
      this.hub.difundir(regla.canales, mensaje);
    });
  }

  /**
   * Obtiene la regla asociada a un tipo de evento de dominio.
   */
  obtenerRegla(eventoOrigen: string): ReglaMapeoEvento | undefined {
    return this.mapaReglas.get(eventoOrigen);
  }

  /**
   * Difunde un mensaje o EventoPublicado a uno o varios canales.
   */
  difundir(
    canal: CanalRealtime | readonly CanalRealtime[],
    mensajeOEvento: MensajeRealtime | EventoPublicado,
  ): void {
    let mensaje: MensajeRealtime;

    if ('payload' in mensajeOEvento && 'createdAt' in mensajeOEvento) {
      const ev = mensajeOEvento as EventoPublicado;
      const regla = this.obtenerRegla(ev.tipo);
      const tipo = regla ? regla.eventoSse : ev.tipo;
      const datos = regla?.transformar ? regla.transformar(ev.payload) : ev.payload;
      mensaje = {
        id: ev.id,
        tipo,
        datos,
        ts: ev.createdAt.toISOString(),
      };
    } else {
      mensaje = mensajeOEvento as MensajeRealtime;
    }

    const canalesTarget = Array.isArray(canal) ? canal : [canal];
    this.bufer.agregar(mensaje, canalesTarget);
    this.hub.difundir(canal, mensaje);
  }

  /**
   * Obtiene los eventos perdidos posteriores a `lastEventId` filtrados por los canales indicados.
   * Responde desde el búfer circular en memoria si los eventos están disponibles (ALTA-02);
   * solo consulta `evento_sistema` en la base de datos si `lastEventId` es más antiguo que el búfer.
   */
  async obtenerEventosReconexion(
    lastEventId: number,
    canales: readonly CanalRealtime[],
  ): Promise<MensajeRealtime[]> {
    // 1. Intentar responder desde memoria (rápido, sin saturar PG con reconexiones masivas)
    const enBufer = this.bufer.obtenerDesde(lastEventId, canales);
    if (enBufer !== null) {
      return enBufer;
    }

    // 2. Fallback a base de datos
    const filas = await this.db
      .select()
      .from(eventoSistema)
      .where(gt(eventoSistema.id, lastEventId))
      .orderBy(asc(eventoSistema.id));

    const mensajes: MensajeRealtime[] = [];
    for (const fila of filas) {
      const regla = this.obtenerRegla(fila.tipo);
      if (!regla) continue;

      const coincide = regla.canales.some((c) => canales.includes(c));
      if (!coincide) continue;

      const datos = regla.transformar ? regla.transformar(fila.payload) : fila.payload;
      mensajes.push({
        id: fila.id,
        tipo: regla.eventoSse,
        datos,
        ts: fila.createdAt.toISOString(),
      });
    }

    return mensajes;
  }
}
