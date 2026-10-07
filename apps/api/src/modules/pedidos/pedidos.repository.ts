import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import type { EstadoPedido, TipoPedido } from '@mb/shared';
import { DB, type Db, type Executor } from '../../shared-kernel/db/db';
import { contadorDia, mesa, pedido, pedidoItem } from './pedidos.schema';

export type MesaFila = typeof mesa.$inferSelect;
export type NuevaMesaFila = typeof mesa.$inferInsert;
export type PedidoFila = typeof pedido.$inferSelect;
export type NuevoPedidoFila = typeof pedido.$inferInsert;
export type PedidoItemFila = typeof pedidoItem.$inferSelect;
export type NuevoPedidoItemFila = typeof pedidoItem.$inferInsert;

@Injectable()
export class PedidosRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async crearMesa(datos: NuevaMesaFila): Promise<MesaFila> {
    const [fila] = await this.db.insert(mesa).values(datos).returning();
    return fila!;
  }

  async buscarMesaPorId(id: string): Promise<MesaFila | undefined> {
    const [fila] = await this.db.select().from(mesa).where(eq(mesa.id, id)).limit(1);
    return fila;
  }

  async buscarMesaPorNombre(nombre: string): Promise<MesaFila | undefined> {
    const [fila] = await this.db.select().from(mesa).where(eq(mesa.nombre, nombre)).limit(1);
    return fila;
  }

  async listarMesas(): Promise<MesaFila[]> {
    return this.db.select().from(mesa).orderBy(asc(mesa.orden), asc(mesa.nombre));
  }

  async actualizarMesa(
    id: string,
    datos: Partial<Omit<MesaFila, 'id' | 'createdAt'>>,
  ): Promise<MesaFila | undefined> {
    const [fila] = await this.db
      .update(mesa)
      .set({ ...datos, updatedAt: new Date() })
      .where(eq(mesa.id, id))
      .returning();
    return fila;
  }

  async reordenarMesas(ordenes: { id: string; orden: number }[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const item of ordenes) {
        await tx
          .update(mesa)
          .set({ orden: item.orden, updatedAt: new Date() })
          .where(eq(mesa.id, item.id));
      }
    });
  }

  // --- Pedidos ---

  /** RN-15: siguiente numero_dia de la fecha operativa; el UPSERT atómico serializa pedidos concurrentes. */
  async siguienteNumeroDia(fechaOperativa: string, executor: Executor): Promise<number> {
    const [fila] = await executor
      .insert(contadorDia)
      .values({ fechaOperativa, ultimoNumero: 1 })
      .onConflictDoUpdate({
        target: contadorDia.fechaOperativa,
        set: { ultimoNumero: sql`${contadorDia.ultimoNumero} + 1` },
      })
      .returning({ numero: contadorDia.ultimoNumero });
    return fila!.numero;
  }

  async insertarPedido(datos: NuevoPedidoFila, executor: Executor): Promise<PedidoFila> {
    const [fila] = await executor.insert(pedido).values(datos).returning();
    return fila!;
  }

  async buscarPedido(id: string, executor: Executor = this.db): Promise<PedidoFila | undefined> {
    const [fila] = await executor.select().from(pedido).where(eq(pedido.id, id)).limit(1);
    return fila;
  }

  async bloquearPedido(id: string, executor: Executor): Promise<PedidoFila | undefined> {
    const [fila] = await executor
      .select()
      .from(pedido)
      .where(eq(pedido.id, id))
      .limit(1)
      .for('update');
    return fila;
  }

  async actualizarPedido(
    id: string,
    datos: Partial<Omit<PedidoFila, 'id' | 'createdAt'>>,
    executor: Executor,
  ): Promise<PedidoFila> {
    const [fila] = await executor
      .update(pedido)
      .set({ ...datos, updatedAt: new Date() })
      .where(eq(pedido.id, id))
      .returning();
    if (!fila) throw new Error(`Pedido ${id} no encontrado al actualizar`);
    return fila;
  }

  async listarPedidos(
    filtros: {
      estado?: EstadoPedido;
      fechaOperativa?: string;
      tipo?: TipoPedido;
      cursor?: string;
      limit: number;
    },
    executor: Executor = this.db,
  ): Promise<PedidoFila[]> {
    const condiciones = [
      ...(filtros.estado ? [eq(pedido.estado, filtros.estado)] : []),
      ...(filtros.fechaOperativa ? [eq(pedido.fechaOperativa, filtros.fechaOperativa)] : []),
      ...(filtros.tipo ? [eq(pedido.tipo, filtros.tipo)] : []),
      ...(filtros.cursor ? [lt(pedido.id, filtros.cursor)] : []),
    ];
    return executor
      .select()
      .from(pedido)
      .where(condiciones.length > 0 ? and(...condiciones) : undefined)
      .orderBy(desc(pedido.id))
      .limit(filtros.limit);
  }

  /** Pedidos ABIERTO/CONFIRMADO de las mesas (RN-11: máximo uno por mesa). */
  async pedidosActivosPorMesa(
    executor: Executor = this.db,
  ): Promise<Array<{ mesaId: string; pedidoId: string }>> {
    const filas = await executor
      .select({ mesaId: pedido.mesaId, pedidoId: pedido.id })
      .from(pedido)
      .where(inArray(pedido.estado, ['ABIERTO', 'CONFIRMADO']));
    return filas.flatMap((f) => (f.mesaId ? [{ mesaId: f.mesaId, pedidoId: f.pedidoId }] : []));
  }

  async mesasPorIds(ids: string[], executor: Executor = this.db): Promise<MesaFila[]> {
    if (ids.length === 0) return [];
    return executor.select().from(mesa).where(inArray(mesa.id, ids));
  }

  // --- Ítems ---

  async itemsDe(pedidoIds: string[], executor: Executor = this.db): Promise<PedidoItemFila[]> {
    if (pedidoIds.length === 0) return [];
    return executor
      .select()
      .from(pedidoItem)
      .where(inArray(pedidoItem.pedidoId, pedidoIds))
      .orderBy(asc(pedidoItem.orden), asc(pedidoItem.id));
  }

  async buscarItem(
    pedidoId: string,
    itemId: string,
    executor: Executor,
  ): Promise<PedidoItemFila | undefined> {
    const [fila] = await executor
      .select()
      .from(pedidoItem)
      .where(and(eq(pedidoItem.pedidoId, pedidoId), eq(pedidoItem.id, itemId)))
      .limit(1);
    return fila;
  }

  async insertarItem(datos: NuevoPedidoItemFila, executor: Executor): Promise<void> {
    await executor.insert(pedidoItem).values(datos);
  }

  async actualizarItem(
    id: string,
    datos: Partial<Pick<PedidoItemFila, 'cantidad' | 'nota' | 'totalLinea'>>,
    executor: Executor,
  ): Promise<void> {
    await executor.update(pedidoItem).set(datos).where(eq(pedidoItem.id, id));
  }

  async borrarItem(id: string, executor: Executor): Promise<void> {
    await executor.delete(pedidoItem).where(eq(pedidoItem.id, id));
  }
}
