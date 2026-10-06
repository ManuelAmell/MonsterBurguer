import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, lt } from 'drizzle-orm';
import { DB, type Db, type Executor } from '../../shared-kernel/db/db';
import { sesionUsuario, usuario } from './identidad.schema';

export type Usuario = typeof usuario.$inferSelect;

@Injectable()
export class IdentidadRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

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
}
