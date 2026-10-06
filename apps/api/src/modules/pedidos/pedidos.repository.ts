import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DB, type Db } from '../../shared-kernel/db/db';
import { mesa } from './pedidos.schema';

export type MesaFila = typeof mesa.$inferSelect;
export type NuevaMesaFila = typeof mesa.$inferInsert;

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
}
