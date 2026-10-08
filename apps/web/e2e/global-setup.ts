import { execSync } from 'node:child_process';
import path from 'node:path';

export default async function globalSetup(): Promise<void> {
  const apiDir = path.resolve(import.meta.dirname, '../../api');
  process.stdout.write('[E2E Global Setup] Ejecutando db:migrate contra mb_qa_final...\n');
  execSync('pnpm db:migrate', { cwd: apiDir, stdio: 'inherit', shell: 'cmd.exe' });
  process.stdout.write('[E2E Global Setup] Ejecutando db:seed contra mb_qa_final...\n');
  execSync('pnpm db:seed', { cwd: apiDir, stdio: 'inherit', shell: 'cmd.exe' });
  process.stdout.write('[E2E Global Setup] Base de datos mb_qa_final lista para pruebas E2E.\n');
}
