import { Injectable } from '@nestjs/common';
import type { Executor } from '../../shared-kernel/db/db';
import { IdentidadRepository } from './identidad.repository';

@Injectable()
export class IdentidadPublicService {
  constructor(private readonly repo: IdentidadRepository) {}

  async nombresPorIds(ids: string[], tx?: Executor): Promise<Map<string, string>> {
    return this.repo.nombresPorIds(ids, tx);
  }
}
