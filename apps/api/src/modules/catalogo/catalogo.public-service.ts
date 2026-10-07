import { Injectable } from '@nestjs/common';
import type { Executor } from '../../shared-kernel/db/db';
import { CatalogoRepository } from './catalogo.repository';

@Injectable()
export class CatalogoPublicService {
  constructor(private readonly repo: CatalogoRepository) {}

  /**
   * Resuelve los ingredientes y cantidades totales requeridos para una lista de productos.
   * Si un producto no tiene receta (RN-31), no genera requerimientos de inventario.
   */
  async resolverRecetas(
    tx: Executor,
    items: Array<{ productoId: string; cantidad: number }>,
  ): Promise<Array<{ ingredienteId: string; cantidad: number }>> {
    if (items.length === 0) return [];
    const productoIds = Array.from(new Set(items.map((i) => i.productoId)));
    const recetas = await this.repo.obtenerItemsRecetaPorProductos(productoIds, tx);

    const recetasPorProducto = new Map<string, Array<{ ingredienteId: string; cantidad: number }>>();
    for (const r of recetas) {
      const lista = recetasPorProducto.get(r.productoId) ?? [];
      lista.push({ ingredienteId: r.ingredienteId, cantidad: r.cantidad });
      recetasPorProducto.set(r.productoId, lista);
    }

    const totalesPorIngrediente = new Map<string, number>();
    for (const item of items) {
      const ingredientes = recetasPorProducto.get(item.productoId) ?? [];
      for (const ing of ingredientes) {
        const acumulado = totalesPorIngrediente.get(ing.ingredienteId) ?? 0;
        totalesPorIngrediente.set(ing.ingredienteId, acumulado + ing.cantidad * item.cantidad);
      }
    }

    return Array.from(totalesPorIngrediente.entries()).map(([ingredienteId, cantidad]) => ({
      ingredienteId,
      cantidad,
    }));
  }

  async obtenerRecetasPorProductos(tx: Executor, productoIds: string[]) {
    const recetas = await this.repo.obtenerItemsRecetaPorProductos(productoIds, tx);
    const mapa = new Map<string, Array<{ ingredienteId: string; cantidad: number }>>();
    for (const r of recetas) {
      const lista = mapa.get(r.productoId) ?? [];
      lista.push({ ingredienteId: r.ingredienteId, cantidad: r.cantidad });
      mapa.set(r.productoId, lista);
    }
    return mapa;
  }

  /** Datos de un producto para venderlo (RN-05, RN-13): `null` si no existe. */
  async obtenerProductoParaVenta(
    executor: Executor,
    productoId: string,
  ): Promise<{ id: string; nombre: string; precio: number; activo: boolean; agotado: boolean } | null> {
    const fila = await this.repo.obtenerProductoPorId(productoId, executor);
    if (!fila) return null;
    return {
      id: fila.id,
      nombre: fila.nombre,
      precio: fila.precio,
      activo: fila.activo,
      agotado: fila.agotado,
    };
  }

  async obtenerProductoIdsPorIngrediente(ingredienteId: string, tx?: Executor) {
    return this.repo.obtenerProductoIdsPorIngrediente(ingredienteId, tx);
  }
}
