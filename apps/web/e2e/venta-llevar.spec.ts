import { expect, test } from '@playwright/test';
import { autenticarComo } from './helpers/auth.helper';
import { limpiarDatosOperativos } from './helpers/db.helper';

test.describe('Flujo de venta para llevar completa (venta-llevar.spec)', () => {
  test.beforeEach(async () => {
    await limpiarDatosOperativos();
  });

  test('caja abre caja -> pedido LLEVAR -> agrega ítems -> cobra efectivo con cambio -> recibo con Documento no fiscal', async ({
    page,
  }) => {
    // 1. Iniciar sesión como cajero
    await autenticarComo(page, 'CAJERO');

    // 2. Abrir caja con monto base
    await page.goto('/caja');
    await expect(page.getByRole('heading', { name: /Abrir caja/i })).toBeVisible();

    // Seleccionar atajo de $50.000 en el teclado numérico y abrir
    await page.getByRole('button', { name: '50k' }).click();
    await page.getByRole('button', { name: 'Abrir caja' }).click();
    await expect(page.getByText('Caja abierta')).toBeVisible();

    // 3. Ir a terminal POS y configurar tipo LLEVAR (radio "Llevar")
    await page.goto('/pos');
    await expect(page.getByRole('heading', { name: 'Ventas' })).toBeVisible();

    await page.getByRole('radio', { name: 'Llevar' }).click();

    const ticket = page.getByRole('complementary', { name: 'Ticket' });

    // 4. Agregar productos al pedido
    await page.getByRole('button', { name: /Monster Clásica/i }).click();
    // Esperar a que el producto aparezca en el ticket
    await expect(ticket.getByText('Monster Clásica')).toBeVisible();

    // Cambiar a categoría Bebidas
    const tabBebidas = page.getByRole('tab', { name: 'Bebidas' });
    if (await tabBebidas.isVisible()) {
      await tabBebidas.click();
    }
    await page.getByRole('button', { name: /Coca-Cola Original 400ml/i }).click();
    await expect(ticket.getByText('Coca-Cola Original 400ml')).toBeVisible();

    // Verificar total acumulado ($24.900 + $5.500 = $30.400)
    await expect(ticket.getByText('$ 30.400')).toBeVisible();

    // 5. Cobrar en efectivo con cambio
    await page.getByRole('button', { name: 'Cobrar' }).click();

    // Modal de cobro visible
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Cobrar pedido/i })).toBeVisible();

    // Ingresar $50.000 recibido con atajo 50k
    await page.getByRole('button', { name: '50k' }).click();

    // Verificar cálculo de cambio ($19.600)
    await expect(page.getByText('$ 19.600')).toBeVisible();

    // Confirmar cobro
    await page.getByRole('button', { name: /Confirmar cobro/i }).click();

    // 6. Recibo emitido con leyenda no fiscal
    await expect(page.getByText('Documento no fiscal')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('MonsterBurguer')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('$ 30.400').first()).toBeVisible();

    // Cerrar modal de recibo
    await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
