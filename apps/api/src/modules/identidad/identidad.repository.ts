import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, inArray, lt, sql } from 'drizzle-orm';
import { DB, type Db, type Executor } from '../../shared-kernel/db/db';
import { sesionUsuario, usuario } from './identidad.schema';

export type Usuario = typeof usuario.$inferSelect;

@Injectable()
export class IdentidadRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async nombresPorIds(ids: string[], ex: Executor = this.db): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const filas = await ex
      .select({ id: usuario.id, nombre: usuario.nombre })
      .from(usuario)
      .where(inArray(usuario.id, ids));
    const mapa = new Map<string, string>();
    for (const f of filas) {
      mapa.set(f.id, f.nombre);
    }
    return mapa;
  }

  async buscarPorUsername(username: string): Promise<Usuario | undefined> {
    const [fila] = await this.db.select().from(usuario).where(eq(usuario.username, username)).limit(1);
    return fila;
  }

  async crearSesion(ex: Executor, sesion: typeof sesionUsuario.$inferInsert): Promise<void> {
    await ex.insert(sesionUsuario).values(sesion);
  }

  async borrarSesionesExpiradas(ex: Executor, usuarioId: string): Promise<void> {
    await ex
      .delete(sesionUsuario)
      .where(and(eq(sesionUsuario.usuarioId, usuarioId), lt(sesionUsuario.expiraAt, new Date())));
  }

  /** Sesión vigente de un usuario activo, por hash de token. */
  async buscarSesionVigente(tokenHash: string) {
    const [fila] = await this.db
      .select({
        sesionId: sesionUsuario.id,
        ultimoUsoAt: sesionUsuario.ultimoUsoAt,
        usuarioId: usuario.id,
        nombre: usuario.nombre,
        username: usuario.username,
        rol: usuario.rol,
      })
      .from(sesionUsuario)
      .innerJoin(usuario, eq(usuario.id, sesionUsuario.usuarioId))
      .where(
        and(
          eq(sesionUsuario.tokenHash, tokenHash),
          gt(sesionUsuario.expiraAt, new Date()),
          eq(usuario.activo, true),
        ),
      )
      .limit(1);
    return fila;
  }

  async extenderSesion(sesionId: string, expiraAt: Date): Promise<void> {
    await this.db
      .update(sesionUsuario)
      .set({ expiraAt, ultimoUsoAt: new Date() })
      .where(eq(sesionUsuario.id, sesionId));
  }

  async borrarSesion(tokenHash: string): Promise<string | undefined> {
    const [fila] = await this.db
      .delete(sesionUsuario)
      .where(eq(sesionUsuario.tokenHash, tokenHash))
      .returning({ usuarioId: sesionUsuario.usuarioId });
    return fila?.usuarioId;
  }

  async listarUsuarios(): Promise<Omit<Usuario, 'passwordHash'>[]> {
    return this.db
      .select({
        id: usuario.id,
        nombre: usuario.nombre,
        username: usuario.username,
        rol: usuario.rol,
        activo: usuario.activo,
        createdAt: usuario.createdAt,
        updatedAt: usuario.updatedAt,
      })
      .from(usuario)
      .orderBy(usuario.createdAt);
  }

  async buscarPorId(id: string): Promise<Usuario | undefined> {
    const [fila] = await this.db.select().from(usuario).where(eq(usuario.id, id)).limit(1);
    return fila;
  }

  async crearUsuario(datos: typeof usuario.$inferInsert): Promise<Omit<Usuario, 'passwordHash'>> {
    const [insertado] = await this.db
      .insert(usuario)
      .values(datos)
      .returning({
        id: usuario.id,
        nombre: usuario.nombre,
        username: usuario.username,
        rol: usuario.rol,
        activo: usuario.activo,
        createdAt: usuario.createdAt,
        updatedAt: usuario.updatedAt,
      });
    if (!insertado) {
      throw new Error('Error al insertar el usuario.');
    }
    return insertado;
  }

  async actualizarUsuario(
    id: string,
    datos: Partial<Pick<Usuario, 'nombre' | 'rol' | 'activo'>>,
  ): Promise<Omit<Usuario, 'passwordHash'> | undefined> {
    const [actualizado] = await this.db
      .update(usuario)
      .set({ ...datos, updatedAt: new Date() })
      .where(eq(usuario.id, id))
      .returning({
        id: usuario.id,
        nombre: usuario.nombre,
        username: usuario.username,
        rol: usuario.rol,
        activo: usuario.activo,
        createdAt: usuario.createdAt,
        updatedAt: usuario.updatedAt,
      });
    return actualizado;
  }

  async actualizarPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.db
      .update(usuario)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(usuario.id, id));
  }

  async contarAdminsActivos(): Promise<number> {
    const [resultado] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(usuario)
      .where(and(eq(usuario.rol, 'ADMIN'), eq(usuario.activo, true)));
    return resultado?.total ?? 0;
  }

  async invalidarSesionesUsuario(usuarioId: string): Promise<void> {
    await this.db.delete(sesionUsuario).where(eq(sesionUsuario.usuarioId, usuarioId));
  }
}
