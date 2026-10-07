import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    APP_ORIGIN: z.url(),
    DATABASE_URL: z.url(),
    SESSION_TTL_HORAS: z.coerce.number().int().positive().default(12),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    DB_POOL_MAX: z.coerce.number().int().positive().default(20),
    COOKIE_SECURE: z.preprocess((val) => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') {
        if (val.toLowerCase() === 'true' || val === '1') return true;
        if (val.toLowerCase() === 'false' || val === '0') return false;
      }
      return undefined;
    }, z.boolean().optional()),
    TRUST_PROXY: z.preprocess((val) => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') {
        if (val.toLowerCase() === 'true' || val === '1') return true;
        if (val.toLowerCase() === 'false' || val === '0') return false;
        return val;
      }
      return false;
    }, z.union([z.boolean(), z.string()]).default(false)),
    MIGRAR_AL_ARRANCAR: z.preprocess((val) => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') {
        return val.toLowerCase() === 'true' || val === '1';
      }
      return false;
    }, z.boolean().default(false)),
  })
  .transform((data) => ({
    ...data,
    COOKIE_SECURE: data.COOKIE_SECURE ?? data.APP_ORIGIN.startsWith('https://'),
  }));

export type Env = z.infer<typeof envSchema>;

/** Valida las variables de entorno al arrancar; si algo falta, el proceso no inicia. */
export function cargarEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const resultado = envSchema.safeParse(source);
  if (!resultado.success) {
    const detalle = resultado.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Variables de entorno inválidas:\n${detalle.join('\n')}`);
  }
  return resultado.data;
}

export const ENV = Symbol('ENV');
