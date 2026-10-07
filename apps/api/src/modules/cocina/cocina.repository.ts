import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { EstadoComanda } from '@mb/shared';
import { DB, type Db, type Executor } from '../../shared-kernel/db/db';
import { comanda, comandaItem } from './cocina.schema';

export type ComandaFila = typeof comanda.$inferSelect;
export type NuevaComandaFila = typeof comanda.$inferInsert;
export type ComandaItemFila = typeof comandaItem.$inferSelect;
export type NuevoComandaItemFila = typeof comandaItem.$inferInsert;

export const ESTADOS_ACTIVOS: readonly EstadoComanda[] = ['PENDIENTE', 'EN_PREPARACION', 'LISTA'];

@Injectable()
export class CocinaRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async insertarComanda(
    datos: NuevaComandaFila,
    items: NuevoComandaItemFila[],
    executor: Executor,
  ): Promise<void> {
    await executor.insert(comanda).values(datos);
    if (items.length > 0) await executor.insert(comandaItem).values(items);
  }

  async buscarPorId(id: string, executor: Executor = this.db): Promise<ComandaFila | undefined> {
    const [fila] = await executor.select().from(comanda).where(eq(comanda.id, id)).limit(1);
    return fila;
  }

  async bloquearPorId(id: string, executor: Executor): Promise<ComandaFila | undefined> {
    const [fila] = await executor
      .select()
      .from(comanda)
      .where(eq(comanda.id, id))
      .limit(1)
      .for('update');
    return fila;
  }

  async bloquearPorPedidoId(pedidoId: string, executor: Executor): Promise<ComandaFila | undefined> {
    const [fila] = await executor
      .select()
      .from(comanda)
      .where(eq(comanda.pedidoId, pedidoId))
      .limit(1)
      .for('update');
    return fila;
  }

  async actualizar(
    id: string,
    datos: Partial<Omit<ComandaFila, 'id' | 'pedidoId' | 'createdAt'>>,
    executor: Executor,
  ): Promise<ComandaFila> {
    const [fila] = await executor.update(comanda).set(datos).where(eq(comanda.id, id)).returning();
    if (!fila) throw new Error(`Comanda ${id} no encontrada al actualizar`);
    return fila;
  }

  async listar(
    filtros: { activas?: boolean; estado?: EstadoComanda },
    executor: Executor = this.db,
  ): Promise<ComandaFila[]> {
    const condiciones = [
      ...(filtros.activas ? [inArray(comanda.estado, [...ESTADOS_ACTIVOS])] : []),
      ...(filtros.estado ? [eq(comanda.estado, filtros.estado)] : []),
    ];
    return executor
      .select()
      .from(comanda)
      .where(condiciones.length > 0 ? and(...condiciones) : undefined)
      .orderBy(asc(comanda.createdAt), asc(comanda.numeroDia))
      .limit(300);
  }

  async itemsDe(comandaIds: string[], executor: Executor = this.db): Promise<ComandaItemFila[]> {
    if (comandaIds.length === 0) return [];
    return executor
      .select()
      .from(comandaItem)
      .where(inArray(comandaItem.comandaId, comandaIds))
      .orderBy(asc(comandaItem.orden));
  }

  async estadosPorPedidos(
    pedidoIds: string[],
    executor: Executor = this.db,
  ): Promise<Array<{ pedidoId: string; estado: EstadoComanda }>> {
    if (pedidoIds.length === 0) return [];
    return executor
      .select({ pedidoId: comanda.pedidoId, estado: comanda.estado })
      .from(comanda)
      .where(inArray(comanda.pedidoId, pedidoIds));
  }
}
