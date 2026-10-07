import { HttpStatus, Injectable } from '@nestjs/common';
import type { BuscarClientesQuery, CrearClienteInput } from '@mb/shared';
import { esViolacionUnicidad } from '../../shared-kernel/db/db';
import { DomainError } from '../../shared-kernel/errors/domain-error';
import { nuevoId } from '../../shared-kernel/ids';
import { ClientesRepository, type ClienteFila } from './clientes.repository';

@Injectable()
export class ClientesService {
  constructor(private readonly repo: ClientesRepository) {}

  async crear(input: CrearClienteInput): Promise<ClienteFila> {
    const telefono = input.telefono ? input.telefono.trim() : null;
    if (telefono) {
      const existente = await this.repo.buscarPorTelefono(telefono);
      if (existente) {
        throw new DomainError(
          'TELEFONO_DUPLICADO',
          'Ya existe un cliente con este teléfono.',
          HttpStatus.CONFLICT,
        );
      }
    }

    try {
      return await this.repo.crear({
        id: nuevoId(),
        nombre: input.nombre.trim(),
        telefono: telefono || null,
        documento: input.documento ? input.documento.trim() : null,
        email: input.email ? input.email.trim() : null,
      });
    } catch (err: unknown) {
      if (esViolacionUnicidad(err)) {
        throw new DomainError(
          'TELEFONO_DUPLICADO',
          'Ya existe un cliente con este teléfono.',
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
  }

  async buscar(query: BuscarClientesQuery): Promise<{
    items: ClienteFila[];
    nextCursor: string | null;
  }> {
    return this.repo.listarYBuscar({
      q: query.q,
      limit: query.limit ?? 50,
      cursor: query.cursor,
    });
  }

  async buscarPorId(id: string): Promise<ClienteFila | undefined> {
    return this.repo.buscarPorId(id);
  }
}
