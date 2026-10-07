import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  CODIGOS_ERROR,
  type Comanda,
  type EstadoComanda,
  type ListarComandasQuery,
  type TipoPedido,
} from '@mb/shared';
import { DB, type Db, type Tx } from '../../shared-kernel/db/db';
import { DomainError } from '../../shared-kernel/errors/domain-error';
import { EventBus } from '../../shared-kernel/events/event-bus';
import { nuevoId } from '../../shared-kernel/ids';
import { CocinaRepository, type ComandaFila, type ComandaItemFila } from './cocina.repository';

export interface DatosNuevaComanda {
  pedidoId: string;
  numeroDia: number;
  tipoPedido: TipoPedido;
  mesaNombre: string | null;
  items: Array<{ nombre: string; cantidad: number; nota: string | null }>;
}

type Transicion = 'iniciar' | 'lista' | 'entregar';

const TRANSICIONES: Record<
  Transicion,
  { desde: EstadoComanda; hacia: EstadoComanda; evento: string; marca: 'iniciadaAt' | 'listaAt' | 'entregadaAt' }
> = {
  iniciar: { desde: 'PENDIENTE', hacia: 'EN_PREPARACION', evento: 'ComandaIniciada', marca: 'iniciadaAt' },
  lista: { desde: 'EN_PREPARACION', hacia: 'LISTA', evento: 'ComandaLista', marca: 'listaAt' },
  entregar: { desde: 'LISTA', hacia: 'ENTREGADA', evento: 'ComandaEntregada', marca: 'entregadaAt' },
};

@Injectable()
export class CocinaService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly repo: CocinaRepository,
    private readonly eventBus: EventBus,
  ) {}

  // --- API pública para otros módulos (dentro de la transacción del llamador) ---

  /** RN-20: exactamente una comanda por pedido confirmado. Devuelve el id de la comanda. */
  async crearComanda(tx: Tx, datos: DatosNuevaComanda): Promise<string> {
    const id = nuevoId();
    await this.repo.insertarComanda(
      {
        id,
        pedidoId: datos.pedidoId,
        numeroDia: datos.numeroDia,
        tipoPedido: datos.tipoPedido,
        mesaNombre: datos.mesaNombre,
        estado: 'PENDIENTE',
      },
      datos.items.map((it, i) => ({
        id: nuevoId(),
        comandaId: id,
        nombre: it.nombre,
        cantidad: it.cantidad,
        nota: it.nota,
        orden: i,
      })),
      tx,
    );
    return id;
  }

  /**
   * RN-21: anula la comanda del pedido (si existe y no es final). Devuelve el estado que tenía
   * para que pedidos decida entre reversión y merma (RN-35).
   */
  async anularComanda(
    tx: Tx,
    pedidoId: string,
  ): Promise<{ comandaId: string; estadoPrevio: EstadoComanda } | null> {
    const fila = await this.repo.bloquearPorPedidoId(pedidoId, tx);
    if (!fila) return null;
    if (fila.estado !== 'ENTREGADA' && fila.estado !== 'ANULADA') {
      await this.repo.actualizar(
        fila.id,
        { estado: 'ANULADA', anuladaAt: new Date(), version: fila.version + 1 },
        tx,
      );
    }
    return { comandaId: fila.id, estadoPrevio: fila.estado };
  }

  async estadosPorPedidos(pedidoIds: string[]): Promise<Map<string, EstadoComanda>> {
    const filas = await this.repo.estadosPorPedidos(pedidoIds);
    return new Map(filas.map((f) => [f.pedidoId, f.estado]));
  }

  // --- Casos de uso HTTP ---

  async listar(filtros: ListarComandasQuery): Promise<Comanda[]> {
    const filas = await this.repo.listar({
      ...(filtros.activas !== undefined ? { activas: filtros.activas } : {}),
      ...(filtros.estado ? { estado: filtros.estado } : {}),
    });
    const items = await this.repo.itemsDe(filas.map((f) => f.id));
    return filas.map((f) => this.mapear(f, items.filter((i) => i.comandaId === f.id)));
  }

  /** RN-21: PENDIENTE → EN_PREPARACION → LISTA → ENTREGADA, con bloqueo optimista. */
  async transicionar(
    accion: Transicion,
    id: string,
    version: number | undefined,
    usuarioId: string,
  ): Promise<Comanda> {
    const regla = TRANSICIONES[accion];
    const { fila, items } = await this.db.transaction(async (tx) => {
      const actual = await this.repo.bloquearPorId(id, tx);
      if (!actual) throw DomainError.noEncontrado('Comanda no encontrada.');
      if (version !== undefined && actual.version !== version) {
        throw new DomainError(
          CODIGOS_ERROR.VERSION_CONFLICT,
          'La comanda fue modificada por otro usuario. Recarga e inténtalo de nuevo.',
          HttpStatus.CONFLICT,
        );
      }
      if (actual.estado !== regla.desde) {
        throw new DomainError(
          CODIGOS_ERROR.ESTADO_INVALIDO,
          `No se puede pasar de ${actual.estado} a ${regla.hacia}.`,
          HttpStatus.CONFLICT,
          { estadoActual: actual.estado, estadoEsperado: regla.desde },
        );
      }
      const actualizada = await this.repo.actualizar(
        id,
        { estado: regla.hacia, [regla.marca]: new Date(), version: actual.version + 1 },
        tx,
      );
      await this.eventBus.publicarEnTx(tx, {
        tipo: regla.evento,
        modulo: 'cocina',
        agregadoId: id,
        usuarioId,
        payload: {
          comandaId: id,
          pedidoId: actualizada.pedidoId,
          numeroDia: actualizada.numeroDia,
          estado: regla.hacia,
        },
      });
      return { fila: actualizada, items: await this.repo.itemsDe([id], tx) };
    });
    return this.mapear(fila, items);
  }

  private mapear(fila: ComandaFila, items: ComandaItemFila[]): Comanda {
    return {
      id: fila.id,
      pedidoId: fila.pedidoId,
      numeroDia: fila.numeroDia,
      tipoPedido: fila.tipoPedido,
      mesaNombre: fila.mesaNombre,
      estado: fila.estado,
      items: items.map((i) => ({
        id: i.id,
        nombre: i.nombre,
        cantidad: i.cantidad,
        nota: i.nota,
        orden: i.orden,
      })),
      iniciadaAt: fila.iniciadaAt?.toISOString() ?? null,
      listaAt: fila.listaAt?.toISOString() ?? null,
      entregadaAt: fila.entregadaAt?.toISOString() ?? null,
      anuladaAt: fila.anuladaAt?.toISOString() ?? null,
      version: fila.version,
      createdAt: fila.createdAt.toISOString(),
    };
  }
}
