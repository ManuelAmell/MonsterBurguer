import { Controller, Get, HttpStatus, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DB, type Db } from '../shared-kernel/db/db';
import { DomainError } from '../shared-kernel/errors/domain-error';
import { Publico } from '../modules/identidad/identidad.public';

@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Publico()
  @Get()
  async check(): Promise<{ status: 'ok'; db: 'ok' }> {
    try {
      await this.db.execute(sql`select 1`);
    } catch {
      throw new DomainError('DB_NO_DISPONIBLE', 'La base de datos no responde.', HttpStatus.SERVICE_UNAVAILABLE);
    }
    return { status: 'ok', db: 'ok' };
  }
}
