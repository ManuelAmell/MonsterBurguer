import path from 'node:path';
import { expect, test } from '@playwright/test';
import { autenticarComo } from './helpers/auth.helper';
import { limpiarDatosOperativos, obtenerStockIngrediente } from './helpers/db.helper';

test.describe('Flujos de anulación de pedidos y deshacer en cocina (anular.spec)', () => {
  test.beforeEach(async () => {
    await limpiarDatosOperativos();
  });

  test('admin anula un pedido confirmado con comanda PENDIENTE -> stock devuelto (verlo en inventario) -> mesa libre', async ({
    page,
  }) => {
    // 1. Obtener stock inicial del ingrediente base de la Monster Clásica
    const stockInicial = await obtenerStockIngrediente('Pan de Hamburguesa');

    // 2. Iniciar sesión como ADMIN
    await autenticarComo(page, 'ADMIN');

    // 3. Ir a POS, seleccionar Mesa 1 y agregar Monster Clásica
    await page.goto('/pos');
    await expect(page.getByRole('heading', { name: 'Ventas', level: 1 })).toBeVisible();

    const mesa1Option = page.locator('#mesa-sel option', { hasText: 'Mesa 1' });
    await expect(mesa1Option).toBeAttached();
    const mesa1Val = await mesa1Option.getAttribute('value');
    await page.getByLabel('Mesa del pedido').selectOption(mesa1Val ?? '');

    await page.getByRole('button', { name: /Monster Clásica/i }).click();
    const ticket = page.getByRole('complementary', { name: 'Ticket' });
    await expect(ticket.getByText('Monster Clásica')).toBeVisible();

    // 4. Confirmar y enviar a cocina (pedido CONFIRMADO, comanda PENDIENTE)
    await ticket.getByRole('button', { name: 'Enviar a cocina' }).click();
    await expect(page.getByText(/enviado a cocina/i).first()).toBeVisible();

    // El stock debió descontarse inmediatamente por el consumo de la receta
    const stockTrasConfirmar = await obtenerStockIngrediente('Pan de Hamburguesa');
    expect(stockTrasConfirmar).toBe(stockInicial - 1);

    // 5. Admin abre pedidos activos y selecciona el pedido recién enviado
    await page.getByRole('button', { name: /Pedidos activos/i }).click();
    const modalActivos = page.getByRole('dialog');
    await expect(modalActivos).toBeVisible();
    await modalActivos.getByRole('button', { name: 'Cobrar' }).click();
    await expect(modalActivos).not.toBeVisible();

    // 6. Ahora en el ticket del POS aparece el botón "Anular pedido" (visible para ADMIN en pedido CONFIRMADO)
    const botonAnular = page.getByRole('button', { name: /Anular pedido/i }).first();
    await expect(botonAnular).toBeVisible();
    await botonAnular.click();

    // 6. Verificar diálogo accesible y mensaje de reversión de stock
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByText(/devolverán al inventario/i)).toBeVisible();

    // Guardar captura para verificación visual
    const shotsDir = path.join(process.env.TEMP || 'C:/Users/manue/AppData/Local/Temp', 'mb-qa-shots');
    await page.screenshot({ path: path.join(shotsDir, '30-anular-pedido-dialog.png') });

    // Ingresar motivo de al menos 5 caracteres
    await dialogo.locator('#motivo-anulacion').fill('Cancelación solicitada por el cliente');
    await dialogo.getByRole('button', { name: /Sí, anular pedido/i }).click();

    // El diálogo se cierra y el pedido queda anulado
    await expect(dialogo).not.toBeVisible();

    // 7. Verificar que el stock fue devuelto en la base de datos
    const stockTrasAnular = await obtenerStockIngrediente('Pan de Hamburguesa');
    expect(stockTrasAnular).toBe(stockInicial);

    // 8. Verificar que el inventario en la UI del módulo administrativo muestra el stock restablecido
    await page.goto('/admin/inventario');
    await expect(page.getByRole('heading', { name: 'Inventario', level: 1 })).toBeVisible();
    const filaPan = page.locator('tr', { hasText: 'Pan de Hamburguesa' });
    await expect(filaPan).toBeVisible();
    await expect(filaPan.getByText(`${stockInicial} UND`)).toBeVisible();

    // 9. Verificar que la Mesa 1 queda libre nuevamente en el POS
    await page.goto('/pos');
    const opcionMesa1 = page.locator('#mesa-sel option', { hasText: 'Mesa 1' });
    await expect(opcionMesa1).toContainText('Libre');
  });

  test('cocina puede deshacer una transición de comanda dentro de los 10 segundos', async ({
    browser,
  }) => {
    const shotsDir = path.join(process.env.TEMP || 'C:/Users/manue/AppData/Local/Temp', 'mb-qa-shots');
    const contextCajero = await browser.newContext();
    const contextCocina = await browser.newContext();

    const pageCajero = await contextCajero.newPage();
    const pageCocina = await contextCocina.newPage();

    try {
      // 1. Iniciar KDS en cocina
      await autenticarComo(pageCocina, 'COCINA');
      await pageCocina.goto('/cocina');
      await expect(pageCocina.getByText('En vivo')).toBeVisible();

      // 2. Crear pedido en Mesa 2 desde el POS
      await autenticarComo(pageCajero, 'CAJERO');
      await pageCajero.goto('/pos');
      const mesa2Option = pageCajero.locator('#mesa-sel option', { hasText: 'Mesa 2' });
      await expect(mesa2Option).toBeAttached();
      const mesa2Val = await mesa2Option.getAttribute('value');
      await pageCajero.getByLabel('Mesa del pedido').selectOption(mesa2Val ?? '');

      await pageCajero.getByRole('button', { name: /Monster Clásica/i }).click();
      const ticket = pageCajero.getByRole('complementary', { name: 'Ticket' });
      await ticket.getByRole('button', { name: 'Enviar a cocina' }).click();

      // 3. En cocina: comanda aparece en tiempo real en la columna "Pendientes"
      await expect(pageCocina.getByText('Monster Clásica')).toBeVisible();
      const botonIniciar = pageCocina.getByRole('button', { name: 'Iniciar' });
      await expect(botonIniciar).toBeVisible();

      // 4. Iniciar preparación: la comanda pasa a "Preparando"
      await botonIniciar.click();
      await expect(pageCocina.getByRole('button', { name: 'Marcar LISTA' })).toBeVisible();

      // 5. Barra flotante de deshacer aparece inmediatamente con cuenta regresiva
      const botonDeshacer = pageCocina.getByRole('button', { name: /Deshacer/i });
      await expect(botonDeshacer).toBeVisible();

      // Guardar captura para verificación visual
      await pageCocina.screenshot({ path: path.join(shotsDir, '31-cocina-deshacer-barra.png') });

      // 6. Hacer clic en deshacer dentro de los 10 segundos
      await botonDeshacer.click();

      // 7. Notificación de éxito y la comanda vuelve al estado inicial (PENDIENTE)
      await expect(pageCocina.getByText(/Transición deshecha/i)).toBeVisible();
      await expect(pageCocina.getByRole('button', { name: 'Iniciar' })).toBeVisible();
    } finally {
      await contextCajero.close();
      await contextCocina.close();
    }
  });
});
