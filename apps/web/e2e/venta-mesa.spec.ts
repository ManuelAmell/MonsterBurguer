import { expect, test } from '@playwright/test';
import { autenticarComo } from './helpers/auth.helper';
import { limpiarDatosOperativos } from './helpers/db.helper';

test.describe('Flujo de venta en mesa con KDS y propina (venta-mesa.spec)', () => {
  test.beforeEach(async () => {
    await limpiarDatosOperativos();
  });

  test('cajero crea pedido en Mesa 1 con nota -> cocina recibe via SSE -> cocina avanza estados -> cajero cobra con propina sugerida -> mesa queda libre', async ({
    browser,
  }) => {
    // 1. Crear dos contextos: cajero y cocina
    const contextCajero = await browser.newContext();
    const contextCocina = await browser.newContext();

    const pageCajero = await contextCajero.newPage();
    const pageCocina = await contextCocina.newPage();

    try {
      // 2. Autenticar cocina y esperar conexión SSE en KDS
      await autenticarComo(pageCocina, 'COCINA');
      await pageCocina.goto('/cocina');
      await expect(pageCocina.getByText('En vivo')).toBeVisible();

      // 3. Autenticar cajero y abrir caja
      await autenticarComo(pageCajero, 'CAJERO');
      await pageCajero.goto('/caja');
      await expect(pageCajero.getByRole('heading', { name: /Abrir caja/i })).toBeVisible();
      await pageCajero.getByRole('button', { name: '50k' }).click();
      await pageCajero.getByRole('button', { name: 'Abrir caja' }).click();
      await expect(pageCajero.getByText('Caja abierta')).toBeVisible();

      // 4. Cajero va al POS, selecciona Mesa 1 y agrega ítem con nota
      await pageCajero.goto('/pos');
      await expect(pageCajero.getByRole('heading', { name: 'Ventas' })).toBeVisible();

      // Seleccionar Mesa 1
      const mesa1Option = pageCajero.locator('#mesa-sel option', { hasText: 'Mesa 1' });
      await expect(mesa1Option).toBeAttached();
      const mesa1Val = await mesa1Option.getAttribute('value');
      await pageCajero.getByLabel('Mesa del pedido').selectOption(mesa1Val ?? '');

      // Agregar Monster Clásica
      await pageCajero.getByRole('button', { name: /Monster Clásica/i }).click();

      const ticket = pageCajero.getByRole('complementary', { name: 'Ticket' });
      await expect(ticket.getByText('Monster Clásica')).toBeVisible();

      // Agregar nota al ítem
      await ticket.getByRole('button', { name: /Agregar nota/i }).click();
      await expect(pageCajero.getByRole('dialog')).toBeVisible();
      await pageCajero.getByLabel('Nota del producto').fill('sin cebolla');
      await pageCajero.getByRole('button', { name: 'Guardar nota' }).click();
      await expect(ticket.getByText('sin cebolla')).toBeVisible();

      // Enviar a cocina
      await ticket.getByRole('button', { name: 'Enviar a cocina' }).click();

      // 5. En KDS (Cocina): Comanda recibida por SSE en tiempo real sin recargar página
      await expect(pageCocina.getByText('Monster Clásica')).toBeVisible();
      await expect(pageCocina.getByText(/sin cebolla/i)).toBeVisible();

      // Avanzar comanda: Iniciar -> Marcar LISTA -> Marcar entregada
      const botonIniciar = pageCocina.getByRole('button', { name: 'Iniciar' });
      await expect(botonIniciar).toBeVisible();
      await botonIniciar.click();

      const botonLista = pageCocina.getByRole('button', { name: 'Marcar LISTA' });
      await expect(botonLista).toBeVisible();
      await botonLista.click();

      const botonEntregada = pageCocina.getByRole('button', { name: 'Marcar entregada' });
      await expect(botonEntregada).toBeVisible();
      await botonEntregada.click();

      // La comanda sale de la vista activa de KDS
      await expect(pageCocina.getByText('Monster Clásica')).not.toBeVisible();

      // 6. En POS (Cajero): Abrir pedidos activos y cobrar con propina
      await pageCajero.goto('/pos');
      await pageCajero.getByRole('button', { name: /Pedidos activos/i }).click();

      const modalActivos = pageCajero.getByRole('dialog');
      await expect(modalActivos).toBeVisible();
      await modalActivos.getByRole('button', { name: 'Cobrar' }).click();
      await expect(modalActivos).not.toBeVisible();

      // El pedido se abre en POS para cobro
      const ticketCobro = pageCajero.getByRole('complementary', { name: 'Ticket' });
      await ticketCobro.getByRole('button', { name: 'Cobrar' }).click();

      const modalCobro = pageCajero.getByRole('dialog');
      await expect(modalCobro).toBeVisible();
      await expect(modalCobro.getByText('¿Incluir propina voluntaria?')).toBeVisible();

      // Seleccionar propina sugerida (10%)
      await modalCobro.getByRole('radio', { name: /^Sí/i }).click();

      // Ingresar efectivo con atajo de $50.000
      await modalCobro.getByRole('button', { name: '50k' }).click();

      // Confirmar cobro
      await modalCobro.getByRole('button', { name: /Confirmar cobro/i }).click();

      // 7. Verificar recibo emitido y cerrar
      const modalRecibo = pageCajero.getByRole('dialog');
      await expect(modalRecibo.getByText('Documento no fiscal')).toBeVisible();
      await expect(modalRecibo.getByText(/Propina voluntaria/i)).toBeVisible();
      await modalRecibo.getByRole('button', { name: 'Cerrar', exact: true }).click();
      await expect(modalRecibo).not.toBeVisible();

      // 8. Verificar que Mesa 1 queda LIBRE nuevamente
      await pageCajero.goto('/pos');
      const opcionMesa1 = pageCajero.locator('#mesa-sel option', { hasText: 'Mesa 1' });
      await expect(opcionMesa1).toContainText('Libre');
    } finally {
      await contextCajero.close();
      await contextCocina.close();
    }
  });
});
