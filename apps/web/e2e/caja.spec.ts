import { expect, test } from '@playwright/test';
import { autenticarComo } from './helpers/auth.helper';
import { limpiarDatosOperativos } from './helpers/db.helper';

test.describe('Flujo de operaciones de caja (caja.spec)', () => {
  test.beforeEach(async () => {
    await limpiarDatosOperativos();
  });

  test('cajero abre caja -> ingreso manual -> retiro manual -> cierre cuadrado con teclado numérico -> verifica historial con Caja cuadrada', async ({
    page,
  }) => {
    // 1. Iniciar sesión como cajero
    await autenticarComo(page, 'CAJERO');

    // 2. Ir al módulo de caja
    await page.goto('/caja');
    await expect(page.getByRole('heading', { name: 'Caja', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Abrir caja/i })).toBeVisible();

    // 3. Abrir caja con monto base de $50.000
    await page.getByRole('button', { name: '50k' }).click();
    await page.getByRole('button', { name: 'Abrir caja' }).click();
    await expect(page.getByText('Caja abierta')).toBeVisible();

    // 4. Registrar movimiento manual: INGRESO ($20.000, "Base extra")
    await page.getByRole('button', { name: /Registrar ingreso/i }).click();
    const modalIngreso = page.getByRole('dialog');
    await expect(modalIngreso).toBeVisible();
    await expect(modalIngreso.getByRole('heading', { name: /Registrar ingreso/i })).toBeVisible();

    await modalIngreso.getByRole('button', { name: '20k' }).click();
    await modalIngreso.getByLabel('Motivo').fill('Base extra');
    await modalIngreso.getByRole('button', { name: 'Registrar movimiento' }).click();
    await expect(modalIngreso).not.toBeVisible();

    // Verificar que el ingreso aparece en la lista de movimientos
    await expect(page.getByText('Base extra')).toBeVisible();
    await expect(page.getByText('+$ 20.000')).toBeVisible();

    // 5. Registrar movimiento manual: RETIRO ($10.000, "Compra insumos")
    await page.getByRole('button', { name: /Registrar retiro/i }).click();
    const modalRetiro = page.getByRole('dialog');
    await expect(modalRetiro).toBeVisible();
    await expect(modalRetiro.getByRole('heading', { name: /Registrar retiro/i })).toBeVisible();

    // Digitar 10k: usamos el botón 1 y cuatro ceros o 1 y 00 dos veces
    await modalRetiro.getByRole('button', { name: '1', exact: true }).click();
    await modalRetiro.getByRole('button', { name: '00', exact: true }).click();
    await modalRetiro.getByRole('button', { name: '00', exact: true }).click();

    await modalRetiro.getByLabel('Motivo').fill('Compra insumos');
    await modalRetiro.getByRole('button', { name: 'Registrar movimiento' }).click();
    await expect(modalRetiro).not.toBeVisible();

    // Verificar que el retiro aparece en la lista de movimientos
    await expect(page.getByText('Compra insumos')).toBeVisible();
    await expect(page.getByText('−$ 10.000')).toBeVisible();

    // 6. Efectivo esperado calculado: 50.000 + 20.000 - 10.000 = $60.000
    await expect(page.getByText('$ 60.000')).toBeVisible();

    // 7. Cierre cuadrado: Digitar exactamente $60.000 en la sección de cierre
    const seccionCerrar = page.locator('section', { hasText: 'Cerrar caja' });
    await seccionCerrar.getByRole('button', { name: '6', exact: true }).click();
    await seccionCerrar.getByRole('button', { name: '00', exact: true }).click();
    await seccionCerrar.getByRole('button', { name: '00', exact: true }).click();

    // Verificar indicador de caja cuadrada en tiempo real
    await expect(seccionCerrar.getByText('Caja cuadrada')).toBeVisible();

    // Click en Cerrar caja
    await seccionCerrar.getByRole('button', { name: 'Cerrar caja' }).click();

    // Modal de confirmación irreversible
    const confirmModal = page.getByRole('alertdialog');
    await expect(confirmModal).toBeVisible();
    await expect(confirmModal.getByText('¿Cerrar la caja?')).toBeVisible();
    await confirmModal.getByRole('button', { name: 'Sí, cerrar caja' }).click();
    await expect(confirmModal).not.toBeVisible();

    // 8. Resumen de cierre mostrado en pantalla
    await expect(page.getByRole('heading', { name: 'Resumen de cierre' })).toBeVisible();
    await expect(page.getByText('Caja cuadrada')).toBeVisible();

    // 9. Cambiar a pestaña "Historial de cierres" y verificar la sesión cerrada
    await page.getByRole('tab', { name: /Historial/i }).click();
    await expect(page.locator('#panel-caja').getByText('Caja cuadrada').first()).toBeVisible();
  });
});
