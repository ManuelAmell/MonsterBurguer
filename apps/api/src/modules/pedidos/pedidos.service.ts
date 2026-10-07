import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  CrearMesaInput,
  EditarMesaInput,
  Mesa,
  MesaConEstado,
  ReordenarMesasInput,
} from '@mb/shared';
import { DomainError } from '../../shared-kernel/errors/domain-error';
import { nuevoId } from '../../shared-kernel/ids';
import { PedidosRepository, type MesaFila } from './pedidos.repository';

@Injectable()
export class PedidosService {
  constructor(private readonly repo: PedidosRepository) {}

  async crearMesa(input: CrearMesaInput): Promise<Mesa> {
    const existente = await this.repo.buscarMesaPorNombre(input.nombre.trim());
    if (existente) {
      throw new DomainError(
        'MESA_DUPLICADA',
        `Ya existe una mesa con el nombre "${input.nombre}".`,
        HttpStatus.CONFLICT,
      );
    }

    try {
      const fila = await this.repo.crearMesa({
        id: nuevoId(),
        nombre: input.nombre.trim(),
        capacidad: input.capacidad ?? 4,
        activa: input.activa ?? true,
        orden: input.orden ?? 0,
      });
      return this.mapearMesa(fila);
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        err.code === '23505'
      ) {
        throw new DomainError(
          'MESA_DUPLICADA',
          `Ya existe una mesa con el nombre "${input.nombre}".`,
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
  }

  async listarMesas(): Promise<MesaConEstado[]> {
    const filas = await this.repo.listarMesas();
    return filas.map((fila) => ({
      ...this.mapearMesa(fila),
      // TODO: calcular ocupada y pedidoId cuando exista la tabla pedido (agente del Hito 2)
      ocupada: false,
      pedidoId: null,
    }));
  }

  async buscarMesaPorId(id: string): Promise<Mesa> {
    const fila = await this.repo.buscarMesaPorId(id);
    if (!fila) {
      throw DomainError.noEncontrado(`No se encontró la mesa con ID "${id}".`);
    }
    return this.mapearMesa(fila);
  }

  async editarMesa(id: string, input: EditarMesaInput): Promise<Mesa> {
    const actual = await this.repo.buscarMesaPorId(id);
    if (!actual) {
      throw DomainError.noEncontrado(`No se encontró la mesa con ID "${id}".`);
    }

    if (input.nombre && input.nombre.trim() !== actual.nombre) {
      const colision = await this.repo.buscarMesaPorNombre(input.nombre.trim());
      if (colision && colision.id !== id) {
        throw new DomainError(
          'MESA_DUPLICADA',
          `Ya existe otra mesa con el nombre "${input.nombre}".`,
          HttpStatus.CONFLICT,
        );
      }
    }

    const fila = await this.repo.actualizarMesa(id, {
      ...(input.nombre !== undefined ? { nombre: input.nombre.trim() } : {}),
      ...(input.capacidad !== undefined ? { capacidad: input.capacidad } : {}),
      ...(input.activa !== undefined ? { activa: input.activa } : {}),
      ...(input.orden !== undefined ? { orden: input.orden } : {}),
    });

    return this.mapearMesa(fila!);
  }

  async reordenarMesas(input: ReordenarMesasInput): Promise<MesaConEstado[]> {
    await this.repo.reordenarMesas(input.mesas);
    return this.listarMesas();
  }

  private mapearMesa(fila: MesaFila): Mesa {
    return {
      id: fila.id,
      nombre: fila.nombre,
      capacidad: fila.capacidad,
      activa: fila.activa,
      orden: fila.orden,
    };
  }
}
