import type { CanalRealtime, MensajeRealtime } from '@mb/shared';

export interface EntradaBuferRealtime {
  mensaje: MensajeRealtime;
  canales: readonly CanalRealtime[];
}

/**
 * Búfer circular en memoria para reconexiones masivas (ALTA-02).
 * Almacena los últimos N eventos para responder reconexiones SSE con `Last-Event-ID`
 * sin saturar PostgreSQL con consultas concurrentes por cliente.
 */
export class BuferCircularEventos {
  private readonly items: EntradaBuferRealtime[] = [];

  constructor(private readonly capacidad = 500) {}

  /**
   * Agrega un nuevo evento al búfer. Si supera la capacidad, descarta el más antiguo.
   */
  agregar(mensaje: MensajeRealtime, canales: readonly CanalRealtime[]): void {
    if (this.items.length >= this.capacidad) {
      this.items.shift();
    }
    this.items.push({ mensaje, canales });
  }

  /**
   * Retorna los eventos posteriores a `lastEventId` filtrados por canales si están disponibles en el búfer.
   * Si `lastEventId` es más viejo que el evento más antiguo disponible en el búfer,
   * retorna `null` para delegar la consulta a la base de datos (`evento_sistema`).
   */
  obtenerDesde(
    lastEventId: number,
    canalesFiltro: readonly CanalRealtime[],
  ): MensajeRealtime[] | null {
    if (this.items.length === 0) {
      return null;
    }

    const primerItem = this.items[0];
    if (!primerItem) return null;

    // Si lastEventId es anterior al inicio del búfer menos 1, faltan eventos en memoria
    if (lastEventId < primerItem.mensaje.id - 1) {
      return null;
    }

    const resultado: MensajeRealtime[] = [];
    for (const item of this.items) {
      if (item.mensaje.id > lastEventId) {
        const coincide = item.canales.some((c) => canalesFiltro.includes(c));
        if (coincide) {
          resultado.push(item.mensaje);
        }
      }
    }

    return resultado;
  }

  /** Cantidad de eventos almacenados en el búfer. */
  tamano(): number {
    return this.items.length;
  }

  /** Limpia el contenido del búfer. */
  limpiar(): void {
    this.items.length = 0;
  }
}
