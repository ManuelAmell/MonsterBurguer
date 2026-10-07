import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, exists, gt, inArray, notExists, sql } from 'drizzle-orm';
import { DB, type Db, type Executor } from '../../shared-kernel/db/db';
import { categoria, producto, recetaItem } from './catalogo.schema';

@Injectable()
export class CatalogoRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  // --- Categorías ---

  async listarCategorias(executor: Executor = this.db) {
    return executor.select().from(categoria).orderBy(asc(categoria.orden), asc(categoria.nombre));
  }

  async obtenerCategoriaPorId(id: string, executor: Executor = this.db) {
    const [cat] = await executor.select().from(categoria).where(eq(categoria.id, id));
    return cat ?? null;
  }

  async crearCategoria(
    datos: { id: string; nombre: string; orden?: number; activa?: boolean },
    executor: Executor = this.db,
  ) {
    const [creada] = await executor
      .insert(categoria)
      .values({
        id: datos.id,
        nombre: datos.nombre,
        orden: datos.orden ?? 0,
        activa: datos.activa ?? true,
      })
      .returning();
    return creada;
  }

  async editarCategoria(
    id: string,
    datos: { nombre?: string; orden?: number; activa?: boolean },
    executor: Executor = this.db,
  ) {
    const [actualizada] = await executor
      .update(categoria)
      .set({
        ...datos,
        updatedAt: sql`now()`,
      })
      .where(eq(categoria.id, id))
      .returning();
    return actualizada ?? null;
  }

  // --- Productos ---

  async listarProductos(
    filtros: {
      categoriaId?: string;
      activo?: boolean;
      sinReceta?: boolean;
      limit?: number;
      cursor?: string;
    } = {},
    executor: Executor = this.db,
  ) {
    const condiciones = [];
    if (filtros.categoriaId) {
      condiciones.push(eq(producto.categoriaId, filtros.categoriaId));
    }
    if (filtros.activo !== undefined) {
      condiciones.push(eq(producto.activo, filtros.activo));
    }
    if (filtros.cursor) {
      condiciones.push(gt(producto.id, filtros.cursor));
    }
    if (filtros.sinReceta === true) {
      condiciones.push(
        notExists(
          this.db
            .select({ dummy: sql`1` })
            .from(recetaItem)
            .where(eq(recetaItem.productoId, producto.id)),
        ),
      );
    } else if (filtros.sinReceta === false) {
      condiciones.push(
        exists(
          this.db
            .select({ dummy: sql`1` })
            .from(recetaItem)
            .where(eq(recetaItem.productoId, producto.id)),
        ),
      );
    }

    const limit = Math.min(filtros.limit ?? 50, 100);
    const filas = await executor
      .select()
      .from(producto)
      .where(condiciones.length > 0 ? and(...condiciones) : undefined)
      .orderBy(asc(producto.orden), asc(producto.id))
      .limit(limit + 1);

    const tieneSiguiente = filas.length > limit;
    const items = tieneSiguiente ? filas.slice(0, limit) : filas;
    const nextCursor = tieneSiguiente ? (items[items.length - 1]?.id ?? null) : null;

    return { items, nextCursor };
  }

  async obtenerProductoPorId(id: string, executor: Executor = this.db) {
    const [prod] = await executor.select().from(producto).where(eq(producto.id, id));
    return prod ?? null;
  }

  async crearProducto(
    datos: {
      id: string;
      categoriaId: string;
      nombre: string;
      descripcion?: string | null;
      precio: number;
      imagenUrl?: string | null;
      activo?: boolean;
      orden?: number;
    },
    executor: Executor = this.db,
  ) {
    const [creado] = await executor
      .insert(producto)
      .values({
        id: datos.id,
        categoriaId: datos.categoriaId,
        nombre: datos.nombre,
        descripcion: datos.descripcion ?? null,
        precio: datos.precio,
        imagenUrl: datos.imagenUrl ?? null,
        activo: datos.activo ?? true,
        agotado: false,
        agotadoManual: null,
        orden: datos.orden ?? 0,
      })
      .returning();
    return creado;
  }

  async editarProducto(
    id: string,
    datos: {
      categoriaId?: string;
      nombre?: string;
      descripcion?: string | null;
      precio?: number;
      imagenUrl?: string | null;
      activo?: boolean;
      orden?: number;
    },
    executor: Executor = this.db,
  ) {
    const [actualizado] = await executor
      .update(producto)
      .set({
        ...datos,
        updatedAt: sql`now()`,
      })
      .where(eq(producto.id, id))
      .returning();
    return actualizado ?? null;
  }

  async actualizarAgotado(
    id: string,
    agotado: boolean,
    agotadoManual?: boolean | null,
    executor: Executor = this.db,
  ) {
    const valores: Record<string, unknown> = {
      agotado,
      updatedAt: sql`now()`,
    };
    if (agotadoManual !== undefined) {
      valores.agotadoManual = agotadoManual;
    }
    const [actualizado] = await executor
      .update(producto)
      .set(valores)
      .where(eq(producto.id, id))
      .returning();
    return actualizado ?? null;
  }

  // --- Recetas ---

  async obtenerItemsReceta(productoId: string, executor: Executor = this.db) {
    return executor
      .select()
      .from(recetaItem)
      .where(eq(recetaItem.productoId, productoId));
  }

  async obtenerItemsRecetaPorProductos(productoIds: string[], executor: Executor = this.db) {
    if (productoIds.length === 0) return [];
    return executor
      .select()
      .from(recetaItem)
      .where(inArray(recetaItem.productoId, productoIds));
  }

  async guardarReceta(
    productoId: string,
    items: Array<{ ingredienteId: string; cantidad: number }>,
    executor: Executor = this.db,
  ) {
    await executor.delete(recetaItem).where(eq(recetaItem.productoId, productoId));
    if (items.length > 0) {
      await executor.insert(recetaItem).values(
        items.map((i) => ({
          productoId,
          ingredienteId: i.ingredienteId,
          cantidad: i.cantidad,
        })),
      );
    }
  }

  async obtenerProductoIdsPorIngrediente(ingredienteId: string, executor: Executor = this.db) {
    const filas = await executor
      .select({ productoId: recetaItem.productoId })
      .from(recetaItem)
      .where(eq(recetaItem.ingredienteId, ingredienteId));
    return filas.map((f) => f.productoId);
  }

  // --- Menú POS (GET /catalogo/menu) ---

  async obtenerMenuPos(executor: Executor = this.db) {
    const categoriasActivas = await executor
      .select()
      .from(categoria)
      .where(eq(categoria.activa, true))
      .orderBy(asc(categoria.orden), asc(categoria.nombre));

    const productosActivos = await executor
      .select()
      .from(producto)
      .where(eq(producto.activo, true))
      .orderBy(asc(producto.orden), asc(producto.nombre));

    const productosPorCategoria = new Map<string, typeof productosActivos>();
    for (const p of productosActivos) {
      const lista = productosPorCategoria.get(p.categoriaId) ?? [];
      lista.push(p);
      productosPorCategoria.set(p.categoriaId, lista);
    }

    return categoriasActivas.map((cat) => ({
      id: cat.id,
      nombre: cat.nombre,
      orden: cat.orden,
      productos: (productosPorCategoria.get(cat.id) ?? []).map((p) => ({
        id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        precio: p.precio,
        imagenUrl: p.imagenUrl,
        agotado: p.agotado,
        orden: p.orden,
      })),
    }));
  }
}
