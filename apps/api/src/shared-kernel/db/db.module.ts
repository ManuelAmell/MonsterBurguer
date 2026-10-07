import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import type { Pool } from 'pg';
import { ENV, type Env } from '../../config/env';
import { crearDb, crearPool, DB, PG_POOL } from './db';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ENV],
      useFactory: (env: Env) => crearPool(env.DATABASE_URL, env.DB_POOL_MAX),
    },
    {
      provide: DB,
      inject: [PG_POOL],
      useFactory: crearDb,
    },
  ],
  exports: [DB, PG_POOL],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
