import { expect, test } from '@playwright/test';
import { autenticarComo, cerrarSesion, loginComo } from './helpers/auth.helper';

test.describe('Autenticación, roles y control de acceso (auth.spec)', () => {
  test('login de los 3 roles y redirección correcta por rol (ADMIN, CAJERO, COCINA)', async ({ page }) => {
    // 1. Rol ADMIN -> /admin
    await loginComo(page, 'ADMIN');
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole('heading', { name: /Panel del día/i })).toBeVisible();
    await cerrarSesion(page);

    // 2. Rol CAJERO -> /pos
    await loginComo(page, 'CAJERO');
    await expect(page).toHaveURL(/\/pos/);
    await expect(page.getByRole('heading', { name: /Ventas/i })).toBeVisible();
    await cerrarSesion(page);

    // 3. Rol COCINA -> /cocina
    await loginComo(page, 'COCINA');
    await expect(page).toHaveURL(/\/cocina/);
    await expect(page.getByText('Cocina 1')).toBeVisible();
    await cerrarSesion(page);
  });

  test('bloqueo de rutas no autorizadas por rol con mensaje accesible', async ({ page }) => {
    // Cajero intentando ingresar a /admin
    await autenticarComo(page, 'CAJERO');
    await page.goto('/admin');
    await expect(
      page.getByRole('heading', { name: /Tu rol no tiene acceso a esta pantalla/i }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Volver al inicio/i })).toBeVisible();
    await cerrarSesion(page);

    // Cocinero intentando ingresar a /pos
    await autenticarComo(page, 'COCINA');
    await page.goto('/pos');
    await expect(
      page.getByRole('heading', { name: /Tu rol no tiene acceso a esta pantalla/i }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Volver al inicio/i })).toBeVisible();
    await cerrarSesion(page);
  });

  test('cierre de sesión limpia estado y redirige a /login', async ({ page }) => {
    await autenticarComo(page, 'ADMIN');
    await page.getByRole('button', { name: /Cerrar sesión/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();

    // Intentar volver a /admin sin sesión debe rebotar al login
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });
});
