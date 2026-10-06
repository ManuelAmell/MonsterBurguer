import { Inject, Injectable } from '@nestjs/common';
import { and, gt, sql } from 'drizzle-orm';
import { DB, type Db } from '../../shared-kernel/db/db';
import { cliente } from './clientes.schema';

export type ClienteFila = typeof cliente.$inferSelect;
export type NuevoClienteFila = typeof cliente.$inferInsert;

function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

@Injectable()
export class ClientesRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async crear(datos: NuevoClienteFila): Promise<ClienteFila> {
    const [fila] = await this.db.insert(cliente).values(datos).returning();
    return fila!;
  }

  async buscarPorId(id: string): Promise<ClienteFila | undefined> {
    const [fila] = await this.db.select().from(cliente).where(sql`${cliente.id} = ${id}`).limit(1);
    return fila;
  }

  async buscarPorTelefono(telefono: string): Promise<ClienteFila | undefined> {
    const [fila] = await this.db
      .select()
      .from(cliente)
      .where(sql`${cliente.telefono} = ${telefono}`)
      .limit(1);
    return fila;
  }

  async listarYBuscar(filtros: {
    q?: string;
    limit: number;
    cursor?: string;
  }): Promise<{ items: ClienteFila[]; nextCursor: string | null }> {
    const condiciones = [];

    if (filtros.cursor) {
      condiciones.push(gt(cliente.id, filtros.cursor));
    }

    if (filtros.q && filtros.q.trim().length > 0) {
      const qNorm = normalizarTexto(filtros.q.trim());
      const patron = `%${qNorm}%`;

      // Insensible a mayúsculas y tildes en nombre, y búsqueda por teléfono y documento
      condiciones.push(
        sql`(
          translate(lower(coalesce(${cliente.nombre}, '')), 'áéíóúüàèìòù', 'aeiouuaeiou') LIKE ${patron}
          OR translate(lower(coalesce(${cliente.telefono}, '')), 'áéíóúüàèìòù', 'aeiouuaeiou') LIKE ${patron}
          OR translate(lower(coalesce(${cliente.documento}, '')), 'áéíóúüàèìòù', 'aeiouuaeiou') LIKE ${patron}
        )`,
      );
    }

    const consulta = this.db
      .select()
      .from(cliente)
      .orderBy(cliente.id)
      .limit(filtros.limit + 1);

    const filas =
      condiciones.length > 0 ? await consulta.where(and(...condiciones)) : await consulta;

    const tieneMas = filas.length > filtros.limit;
    const items = tieneMas ? filas.slice(0, filtros.limit) : filas;
    const nextCursor = tieneMas ? items[items.length - 1]!.id : null;

    return { items, nextCursor };
  }
}
