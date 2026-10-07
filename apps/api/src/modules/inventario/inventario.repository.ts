import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, lt, lte, sql } from 'drizzle-orm';
import type { TipoMovimientoInventario, Unidad } from '@mb/shared';
import { DB, type Db, type Executor, type Tx } from '../../shared-kernel/db/db';
import { ingrediente, movimientoInventario } from './inventario.schema';

@Injectable()
export class InventarioRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  // --- Ingredientes ---

  async listarIngredientes(
    filtros: { stockBajo?: boolean; limit?: number; cursor?: string } = {},
    executor: Executor = this.db,
  ) {
    const condiciones = [];
    if (filtros.stockBajo === true) {
      condiciones.push(lte(ingrediente.stockActual, ingrediente.stockMinimo));
    }
    if (filtros.cursor) {
      condiciones.push(lt(ingrediente.id, filtros.cursor));
    }

    const limit = Math.min(filtros.limit ?? 50, 100);
    const filas = await executor
      .select()
      .from(ingrediente)
      .where(condiciones.length > 0 ? and(...condiciones) : undefined)
      .orderBy(asc(ingrediente.nombre))
      .limit(limit + 1);

    const tieneSiguiente = filas.length > limit;
    const items = tieneSiguiente ? filas.slice(0, limit) : filas;
    const nextCursor = tieneSiguiente ? (items[items.length - 1]?.id ?? null) : null;

    return { items, nextCursor };
  }

  async obtenerIngredientePorId(id: string, executor: Executor = this.db) {
    const [item] = await executor.select().from(ingrediente).where(eq(ingrediente.id, id));
    return item ?? null;
  }

  async obtenerIngredientesPorIds(ids: string[], executor: Executor = this.db) {
    if (ids.length === 0) return [];
    return executor.select().from(ingrediente).where(inArray(ingrediente.id, ids));
  }

  async crearIngrediente(
    datos: {
      id: string;
      nombre: string;
      unidad: Unidad;
      stockMinimo?: number;
      costoUnitario?: number;
      activo?: boolean;
    },
    executor: Executor = this.db,
  ) {
    const [creado] = await executor
      .insert(ingrediente)
      .values({
        id: datos.id,
        nombre: datos.nombre,
        unidad: datos.unidad,
        stockActual: 0,
        stockMinimo: datos.stockMinimo ?? 0,
        costoUnitario: datos.costoUnitario ?? 0,
        activo: datos.activo ?? true,
      })
      .returning();
    return creado;
  }

  async editarIngrediente(
    id: string,
    datos: {
      nombre?: string;
      stockMinimo?: number;
      costoUnitario?: number;
      activo?: boolean;
    },
    executor: Executor = this.db,
  ) {
    const [actualizado] = await executor
      .update(ingrediente)
      .set({
        ...datos,
        updatedAt: sql`now()`,
      })
      .where(eq(ingrediente.id, id))
      .returning();
    return actualizado ?? null;
  }

  async actualizarStock(id: string, nuevoStock: number, executor: Executor = this.db) {
    const [actualizado] = await executor
      .update(ingrediente)
      .set({
        stockActual: nuevoStock,
        updatedAt: sql`now()`,
      })
      .where(eq(ingrediente.id, id))
      .returning();
    return actualizado;
  }

  /**
   * RN-32: Bloquea filas de ingredientes en orden de id para evitar deadlocks en concurrencia.
   */
  async bloquearIngredientesParaActualizar(ids: string[], tx: Tx) {
    if (ids.length === 0) return [];
    const idsOrdenados = Array.from(new Set(ids)).sort();
    return tx
      .select()
      .from(ingrediente)
      .where(inArray(ingrediente.id, idsOrdenados))
      .orderBy(asc(ingrediente.id))
      .for('update');
  }

  // --- Movimientos / Kardex (RN-34) ---

  async insertarMovimiento(
    datos: {
      id: string;
      ingredienteId: string;
      tipo: TipoMovimientoInventario;
      cantidad: number;
      stockResultante: number;
      referenciaTipo?: string | null;
      referenciaId?: string | null;
      usuarioId: string;
      motivo?: string | null;
    },
    executor: Executor = this.db,
  ) {
    const [mov] = await executor
      .insert(movimientoInventario)
      .values({
        id: datos.id,
        ingredienteId: datos.ingredienteId,
        tipo: datos.tipo,
        cantidad: datos.cantidad,
        stockResultante: datos.stockResultante,
        referenciaTipo: datos.referenciaTipo ?? null,
        referenciaId: datos.referenciaId ?? null,
        usuarioId: datos.usuarioId,
        motivo: datos.motivo ?? null,
      })
      .returning();
    return mov;
  }

  async listarMovimientosKardex(
    ingredienteId: string,
    paginacion: { limit?: number; cursor?: string } = {},
    executor: Executor = this.db,
  ) {
    const condiciones = [eq(movimientoInventario.ingredienteId, ingredienteId)];
    if (paginacion.cursor) {
      condiciones.push(lt(movimientoInventario.id, paginacion.cursor));
    }

    const limit = Math.min(paginacion.limit ?? 50, 100);
    const filas = await executor
      .select()
      .from(movimientoInventario)
      .where(and(...condiciones))
      .orderBy(desc(movimientoInventario.createdAt), desc(movimientoInventario.id))
      .limit(limit + 1);

    const tieneSiguiente = filas.length > limit;
    const items = tieneSiguiente ? filas.slice(0, limit) : filas;
    const nextCursor = tieneSiguiente ? (items[items.length - 1]?.id ?? null) : null;

    return { items, nextCursor };
  }
}
