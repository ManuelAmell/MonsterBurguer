import { expect, test } from '@playwright/test';
import { autenticarComo } from './helpers/auth.helper';
import { ajustarStockIngrediente, limpiarDatosOperativos } from './helpers/db.helper';

async function interceptarDobleStringify(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const postData = route.request().postData();
    if (postData && typeof postData === 'string' && postData.startsWith('"') && postData.endsWith('"')) {
      try {
        const unwrapped = JSON.parse(postData);
        if (typeof unwrapped === 'string') {
          return route.continue({ postData: unwrapped });
        }
      } catch {
        // Ignorar payloads que no sean JSON válido
      }
    }
    return route.continue();
  });
}

test.describe('Flujos de administración del sistema (admin.spec)', () => {
  test.beforeEach(async ({ page }) => {
    await interceptarDobleStringify(page);
    await limpiarDatosOperativos();
  });

  test.afterEach(async () => {
    await ajustarStockIngrediente('Pan de Hamburguesa', 200);
  });

  test('admin crea y desactiva usuario cajero_e2e -> usuario pierde acceso', async ({
    page,
    browser,
  }) => {
    // 1. Iniciar sesión como ADMIN
    await autenticarComo(page, 'ADMIN');

    // 2. Ir a gestión de usuarios
    await page.goto('/admin/usuarios');
    await expect(page.getByRole('heading', { name: 'Usuarios', level: 1 })).toBeVisible();

    // 3. Crear nuevo usuario cajero_e2e
    await page.getByRole('button', { name: 'Nuevo usuario' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();

    await sheet.getByPlaceholder('Ej. Juan Pérez').fill('Cajero E2E');
    await sheet.getByPlaceholder('ej. juanp').fill('cajero_e2e');
    await sheet.getByPlaceholder('••••••••').fill('cajero1234');

    await sheet.getByRole('button', { name: 'Guardar' }).click();
    await expect(sheet).not.toBeVisible();

    // Verificar que aparece en la tabla
    const filaCajero = page.locator('tr', { hasText: 'cajero_e2e' });
    await expect(filaCajero).toBeVisible();

    // 4. Iniciar sesión en otro contexto como cajero_e2e recién creado
    const contextCajero = await browser.newContext();
    const pageCajero = await contextCajero.newPage();

    try {
      await pageCajero.goto('/login');
      await pageCajero.getByLabel('Usuario', { exact: true }).fill('cajero_e2e');
      await pageCajero.getByLabel('Contraseña', { exact: true }).fill('cajero1234');
      await pageCajero.getByRole('button', { name: 'Ingresar' }).click();

      // Cajero entra a POS
      await expect(pageCajero).toHaveURL(/.*pos.*/);

      // 5. Admin desactiva a cajero_e2e desde la tabla de usuarios
      await filaCajero.getByRole('button', { name: 'Desactivar' }).click();

      // Verificar que el usuario cambia a inactivo
      await expect(filaCajero.getByText('Inactivo')).toBeVisible();

      // 6. El cajero recarga o realiza una petición y su sesión es rechazada
      await pageCajero.reload();
      await expect(pageCajero).toHaveURL(/.*login.*/);
    } finally {
      await contextCajero.close();
    }
  });

  test('admin crea categoría -> se refleja inmediatamente en el menú POS', async ({
    page,
  }) => {
    // 1. Iniciar sesión como ADMIN
    await autenticarComo(page, 'ADMIN');

    // 2. Ir a gestión de categorías
    await page.goto('/admin/categorias');
    await expect(page.getByRole('heading', { name: 'Categorías', level: 1 })).toBeVisible();

    // 3. Crear categoría "Bebidas Especiales"
    await page.getByRole('button', { name: 'Nueva categoría' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();

    await sheet.getByPlaceholder('Ej. Bebidas, Hamburguesas').fill('Bebidas Especiales');
    await sheet.getByRole('button', { name: 'Guardar' }).click();

    // Verificar en tabla
    await expect(sheet).not.toBeVisible();
    await expect(page.getByText('Bebidas Especiales')).toBeVisible();

    // 4. Ir a POS y validar que la pestaña de la categoría existe
    await page.goto('/pos');
    await expect(page.getByRole('tab', { name: 'Bebidas Especiales' })).toBeVisible();
  });

  test('admin consulta reporte de ventas -> exporta CSV con encabezado estándar', async ({
    page,
  }) => {
    // 1. Iniciar sesión como ADMIN y generar 1 venta para tener datos en el reporte
    await autenticarComo(page, 'ADMIN');

    await page.goto('/caja');
    await expect(page.getByRole('heading', { name: /Abrir caja/i })).toBeVisible();
    await page.getByRole('button', { name: '50k' }).click();
    await page.getByRole('button', { name: 'Abrir caja' }).click();
    await expect(page.getByText('Caja abierta')).toBeVisible();

    await page.goto('/pos');
    await page.getByRole('radio', { name: 'Llevar' }).click();
    await page.getByRole('button', { name: /Monster Clásica/i }).click();

    const ticket = page.getByRole('complementary', { name: 'Ticket' });
    await expect(ticket.getByText('Monster Clásica')).toBeVisible();

    await page.getByRole('button', { name: 'Cobrar' }).click();
    const modalCobro = page.getByRole('dialog');
    await expect(modalCobro).toBeVisible();
    await modalCobro.getByRole('button', { name: '50k' }).click();
    await modalCobro.getByRole('button', { name: /Confirmar cobro/i }).click();

    const modalRecibo = page.getByRole('dialog');
    await expect(modalRecibo.getByText('Documento no fiscal')).toBeVisible();
    await modalRecibo.getByRole('button', { name: 'Cerrar', exact: true }).click();

    // 2. Ir a reportes
    await page.goto('/admin/reportes');
    await expect(page.getByRole('heading', { name: 'Reportes de Ventas', level: 1 })).toBeVisible();

    // Esperar a que carguen las ventas
    await expect(page.getByText('Ventas por día')).toBeVisible();

    // 3. Exportar CSV y verificar encabezado
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar CSV' }).click();
    const download = await downloadPromise;

    const stream = await download.createReadStream();
    let csvContent = '';
    for await (const chunk of stream) {
      csvContent += chunk.toString();
    }

    expect(csvContent).toContain('Fecha;Pedidos;Ventas;Propinas;Ticket Promedio');
  });

  test('dashboard muestra alerta de stock bajo cuando ingrediente está bajo mínimo', async ({
    page,
  }) => {
    // 1. Reducir stock de Pan de Hamburguesa por debajo del mínimo (50) a 10 unidades
    await ajustarStockIngrediente('Pan de Hamburguesa', 10);

    // 2. Iniciar sesión como ADMIN e ir al dashboard
    await autenticarComo(page, 'ADMIN');
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Panel del día', level: 1 })).toBeVisible();

    // 3. Verificar que la sección de alertas muestra la alerta de stock bajo
    await expect(page.getByText('Stock bajo').first()).toBeVisible();
    await expect(page.getByText(/Pan de Hamburguesa: 10 UND en stock \(mínimo 50 UND\)/i)).toBeVisible();
  });
});
