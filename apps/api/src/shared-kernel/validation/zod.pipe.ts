import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

/** Valida el argumento con un esquema Zod de @mb/shared. Un ZodError lo traduce el filtro global a 400. */
export class ZodPipe<S extends z.ZodType> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    return this.schema.parse(value);
  }
}
