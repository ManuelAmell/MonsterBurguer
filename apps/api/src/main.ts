import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { crearApp } from './app.factory';
import { cargarEnv } from './config/env';

async function bootstrap(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const env = cargarEnv();
  const app = await crearApp(env);
  await app.listen(env.PORT);
}

void bootstrap();
