import { expect, type Page } from '@playwright/test';
import { crearSesionDirecta } from './db.helper';

export const USUARIOS = {
  ADMIN: { username: 'admin', password: 'admin123', rutaEsperada: '/admin' },
  CAJERO: { username: 'caja1', password: 'caja1234', rutaEsperada: '/pos' },
  COCINA: { username: 'cocina1', password: 'cocina1234', rutaEsperada: '/cocina' },
} as const;

export async function loginComo(
  page: Page,
  rol: keyof typeof USUARIOS,
): Promise<void> {
  const usuario = USUARIOS[rol];
  await page.goto('/login');

  if (page.url().includes(usuario.rutaEsperada)) {
    return;
  }

  await page.getByLabel('Usuario', { exact: true }).fill(usuario.username);
  await page.getByLabel('Contraseña', { exact: true }).fill(usuario.password);
  await page.getByRole('button', { name: 'Ingresar' }).click();

  await expect(page).toHaveURL(new RegExp(usuario.rutaEsperada));
}

/** Inicia sesión inyectando cookie en el contexto, evitando llamadas repetidas a /auth/login */
export async function autenticarComo(
  page: Page,
  rol: keyof typeof USUARIOS,
): Promise<void> {
  const usuario = USUARIOS[rol];
  const token = await crearSesionDirecta(usuario.username);
  await page.context().addCookies([
    {
      name: 'mb_session',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  await page.goto(usuario.rutaEsperada);
  await expect(page).toHaveURL(new RegExp(usuario.rutaEsperada));
}

export async function cerrarSesion(page: Page): Promise<void> {
  const botonCerrar = page.getByRole('button', { name: /Cerrar sesión/i }).filter({ visible: true }).first();
  await botonCerrar.scrollIntoViewIfNeeded();
  await botonCerrar.click();
  await expect(page).toHaveURL(/\/login/);
}
