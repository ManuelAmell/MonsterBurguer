import { HttpStatus, Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { Unidad } from '@mb/shared';
import { DB, type Db } from '../../shared-kernel/db/db';
import { DomainError } from '../../shared-kernel/errors/domain-error';
import { EventBus } from '../../shared-kernel/events/event-bus';
import { nuevoId } from '../../shared-kernel/ids';
import { InventarioService } from '../inventario/inventario.public';
import { CatalogoRepository } from './catalogo.repository';

export interface RecetaItemDetalleDto {
  ingredienteId: string;
  nombre: string;
  unidad: Unidad;
  cantidad: number;
}

@Injectable()
export class CatalogoService implements OnModuleInit {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly repo: CatalogoRepository,
    private readonly inventarioService: InventarioService,
    private readonly eventBus: EventBus,
  ) {}

  onModuleInit(): void {
    // RN-36: Suscripciones post-commit explícitas para retroalimentación
    this.eventBus.despuesDeCommit('IngredienteAgotado', async (evento) => {
      const payload = evento.payload as { ingredienteId?: string };
      if (payload?.ingredienteId) {
        await this.recalcularProductosPorIngrediente(payload.ingredienteId);
      }
    });

    this.eventBus.despuesDeCommit('IngredienteRepuesto', async (evento) => {
      const payload = evento.payload as { ingredienteId?: string };
      if (payload?.ingredienteId) {
        await this.recalcularProductosPorIngrediente(payload.ingredienteId);
      }
    });
  }

  // --- Categorías ---

  async listarCategorias() {
    return this.repo.listarCategorias();
  }

  async crearCategoria(datos: { nombre: string; orden?: number; activa?: boolean }) {
    const id = nuevoId();
    try {
      return await this.repo.crearCategoria({
        id,
        nombre: datos.nombre,
        orden: datos.orden,
        activa: datos.activa,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('unique')) {
        throw new DomainError(
          'NOMBRE_DUPLICADO',
          'Ya existe una categoría con ese nombre.',
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
  }

  async editarCategoria(
    id: string,
    datos: { nombre?: string; orden?: number; activa?: boolean },
  ) {
    const existente = await this.repo.obtenerCategoriaPorId(id);
    if (!existente) throw DomainError.noEncontrado('Categoría no encontrada.');

    try {
      const actualizada = await this.repo.editarCategoria(id, datos);
      if (!actualizada) throw DomainError.noEncontrado('Categoría no encontrada.');
      return actualizada;
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('unique')) {
        throw new DomainError(
          'NOMBRE_DUPLICADO',
          'Ya existe una categoría con ese nombre.',
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
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
  ) {
    return this.repo.listarProductos(filtros);
  }

  async obtenerProductoPorId(id: string) {
    const prod = await this.repo.obtenerProductoPorId(id);
    if (!prod) throw DomainError.noEncontrado('Producto no encontrado.');

    const itemsReceta = await this.repo.obtenerItemsReceta(id);
    const ingIds = itemsReceta.map((r) => r.ingredienteId);
    const ingredientes = await this.inventarioService.obtenerIngredientesPorIds(ingIds);
    const mapaIng = new Map(ingredientes.map((i) => [i.id, i]));

    const receta: RecetaItemDetalleDto[] = itemsReceta.map((r) => {
      const ing = mapaIng.get(r.ingredienteId);
      return {
        ingredienteId: r.ingredienteId,
        nombre: ing?.nombre ?? 'Desconocido',
        unidad: (ing?.unidad as Unidad) ?? 'UND',
        cantidad: r.cantidad,
      };
    });

    return {
      ...prod,
      receta,
    };
  }

  async crearProducto(datos: {
    categoriaId: string;
    nombre: string;
    descripcion?: string | null;
    precio: number;
    imagenUrl?: string | null;
    activo?: boolean;
    orden?: number;
  }) {
    const cat = await this.repo.obtenerCategoriaPorId(datos.categoriaId);
    if (!cat) throw DomainError.noEncontrado('Categoría no encontrada.');

    const id = nuevoId();
    try {
      return await this.repo.crearProducto({
        id,
        categoriaId: datos.categoriaId,
        nombre: datos.nombre,
        descripcion: datos.descripcion,
        precio: datos.precio,
        imagenUrl: datos.imagenUrl,
        activo: datos.activo,
        orden: datos.orden,
      });
    } catch (err: unknown) {
      if (err instanceof Error && (err.message.includes('unique') || err.message.includes('lower'))) {
        throw new DomainError(
          'NOMBRE_DUPLICADO',
          'Ya existe un producto con ese nombre.',
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
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
  ) {
    const prod = await this.repo.obtenerProductoPorId(id);
    if (!prod) throw DomainError.noEncontrado('Producto no encontrado.');

    if (datos.categoriaId) {
      const cat = await this.repo.obtenerCategoriaPorId(datos.categoriaId);
      if (!cat) throw DomainError.noEncontrado('Categoría no encontrada.');
    }

    try {
      const actualizado = await this.repo.editarProducto(id, datos);
      if (!actualizado) throw DomainError.noEncontrado('Producto no encontrado.');
      return actualizado;
    } catch (err: unknown) {
      if (err instanceof Error && (err.message.includes('unique') || err.message.includes('lower'))) {
        throw new DomainError(
          'NOMBRE_DUPLICADO',
          'Ya existe un producto con ese nombre.',
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
  }

  /**
   * PUT /productos/:id/receta: Reemplaza la receta completa en una transacción.
   */
  async actualizarReceta(id: string, items: Array<{ ingredienteId: string; cantidad: number }>) {
    return this.db.transaction(async (tx) => {
      const prod = await this.repo.obtenerProductoPorId(id, tx);
      if (!prod) throw DomainError.noEncontrado('Producto no encontrado.');

      if (items.length > 0) {
        const ingIds = items.map((i) => i.ingredienteId);
        const existentes = await this.inventarioService.obtenerIngredientesPorIds(ingIds);
        if (existentes.length !== ingIds.length) {
          throw DomainError.noEncontrado('Uno o más ingredientes especificados no existen.');
        }
      }

      await this.repo.guardarReceta(id, items, tx);

      // Si no tiene override manual, re-evaluar si está agotado
      if (prod.agotadoManual === null || prod.agotadoManual === undefined) {
        await this.evaluarDisponibilidadProducto(id, tx);
      }

      return this.obtenerProductoPorId(id);
    });
  }

  /**
   * PUT /productos/:id/agotado: Actualiza override de agotado manual o lo resetea a automático (null).
   */
  async actualizarAgotadoManual(id: string, agotadoManual: boolean | null) {
    const prod = await this.repo.obtenerProductoPorId(id);
    if (!prod) throw DomainError.noEncontrado('Producto no encontrado.');

    if (agotadoManual === true) {
      return this.repo.actualizarAgotado(id, true, true);
    }
    if (agotadoManual === false) {
      return this.repo.actualizarAgotado(id, false, false);
    }

    // null = automático: recalcular
    const agotado = await this.evaluarDisponibilidadProducto(id);
    return this.repo.actualizarAgotado(id, agotado, null);
  }

  // --- Menú POS ---

  async obtenerMenuPos() {
    return this.repo.obtenerMenuPos();
  }

  // --- Retroalimentación RN-36 ---

  /**
   * Recalcula `producto.agotado` para todos los productos que usan un ingrediente modificado.
   * Respeta `agotado_manual` (RN-36).
   */
  async recalcularProductosPorIngrediente(ingredienteId: string): Promise<void> {
    const productoIds = await this.repo.obtenerProductoIdsPorIngrediente(ingredienteId);
    for (const pId of productoIds) {
      const prod = await this.repo.obtenerProductoPorId(pId);
      if (!prod) continue;
      // RN-36: respetar agotado_manual (si es true o false, no se toca automáticamente)
      if (prod.agotadoManual !== null && prod.agotadoManual !== undefined) {
        continue;
      }
      await this.evaluarDisponibilidadProducto(pId);
    }
  }

  private async evaluarDisponibilidadProducto(productoId: string, tx = this.db): Promise<boolean> {
    const itemsReceta = await this.repo.obtenerItemsReceta(productoId, tx);
    if (itemsReceta.length === 0) {
      await this.repo.actualizarAgotado(productoId, false, undefined, tx);
      return false;
    }

    const ingIds = itemsReceta.map((r) => r.ingredienteId);
    const ingredientes = await this.inventarioService.obtenerIngredientesPorIds(ingIds);
    const mapaIng = new Map(ingredientes.map((i) => [i.id, i]));

    let estaAgotado = false;
    for (const item of itemsReceta) {
      const ing = mapaIng.get(item.ingredienteId);
      const stock = ing ? Number(ing.stockActual) : 0;
      if (stock < item.cantidad) {
        estaAgotado = true;
        break;
      }
    }

    await this.repo.actualizarAgotado(productoId, estaAgotado, undefined, tx);
    return estaAgotado;
  }
}
