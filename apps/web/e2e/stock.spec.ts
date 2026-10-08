import { expect, test } from '@playwright/test';
import { autenticarComo } from './helpers/auth.helper';
import { ajustarStockIngrediente, limpiarDatosOperativos } from './helpers/db.helper';

test.describe('Control y validación de stock insuficiente (stock.spec)', () => {
  test.beforeEach(async () => {
    await limpiarDatosOperativos();
  });

  test.afterEach(async () => {
    await ajustarStockIngrediente('Pan de Hamburguesa', 100);
  });

  test('stock insuficiente bloquea confirmación (409) -> muestra modal con faltantes -> pedido permanece ABIERTO -> tras reabastecer se confirma', async ({
    page,
  }) => {
    // 1. Iniciar sesión como cajero
    await autenticarComo(page, 'CAJERO');

    // 2. Ir a POS y seleccionar Mesa 1
    await page.goto('/pos');
    await expect(page.getByRole('heading', { name: 'Ventas' })).toBeVisible();

    const mesa1Option = page.locator('#mesa-sel option', { hasText: 'Mesa 1' });
    await expect(mesa1Option).toBeAttached();
    const mesa1Val = await mesa1Option.getAttribute('value');
    await page.getByLabel('Mesa del pedido').selectOption(mesa1Val ?? '');

    // 3. Agregar Monster Clásica
    await page.getByRole('button', { name: /Monster Clásica/i }).click();
    const ticket = page.getByRole('complementary', { name: 'Ticket' });
    await expect(ticket.getByText('Monster Clásica')).toBeVisible();

    // 4. Agotar deliberadamente el stock del ingrediente requerido en la receta
    await ajustarStockIngrediente('Pan de Hamburguesa', 0);

    // 5. Intentar enviar a cocina -> debe fallar con 409 STOCK_INSUFICIENTE
    await ticket.getByRole('button', { name: 'Enviar a cocina' }).click();

    // 6. Validar que el modal de faltantes de stock aparece (RN-12, RN-32)
    const modalStock = page.getByRole('alertdialog');
    await expect(modalStock).toBeVisible();
    await expect(modalStock.getByText('No hay stock suficiente')).toBeVisible();
    await expect(modalStock.getByText(/Pan de Hamburguesa/i)).toBeVisible();

    // Cerrar modal de advertencia con "Entendido"
    await modalStock.getByRole('button', { name: 'Entendido' }).click();
    await expect(modalStock).not.toBeVisible();

    // 7. El pedido no se canceló ni se confirmó: permanece ABIERTO con sus ítems intactos
    await expect(ticket.getByText('Monster Clásica')).toBeVisible();
    await expect(ticket.getByRole('button', { name: 'Enviar a cocina' })).toBeVisible();

    // 8. Reabastecer stock de inventario
    await ajustarStockIngrediente('Pan de Hamburguesa', 50);

    // 9. Reintentar enviar a cocina -> ahora debe tener éxito
    await ticket.getByRole('button', { name: 'Enviar a cocina' }).click();
    await expect(page.getByText(/enviado a cocina/i).first()).toBeVisible();
  });
});
