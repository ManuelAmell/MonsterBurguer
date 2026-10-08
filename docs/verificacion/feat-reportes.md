# Verificación feat/reportes-alertas (Feature D: Reportes por rango y alertas)

Fecha: 2026-10-07. Rama `feat/reportes-alertas`. BD `mb_reportes` / `mb_reportes_test`, API :3042, Web :5212.

## Alcance

- `GET /admin/reportes/ventas?desde&hasta&agrupar=dia|producto|metodo|cajero`: consolidado analítico de ventas de pedidos cerrados en rango de fechas operativas (máximo 92 días inclusivo, RN-16). Respuesta estructurada con items agrupados, totales acumulados y conteo de pedidos anulados. Todos los montos en enteros COP (@mb/shared/money).
- `GET /admin/reportes/ventas.csv`: exportación en CSV con BOM UTF-8 (`\uFEFF`), delimitador `;` y encabezado `Content-Disposition: attachment; filename="reporte-ventas-${desde}-a-${hasta}.csv"`.
- `GET /admin/alertas`: alertas operativas activas del restaurante (pedidos abiertos olvidados > 12 h sin actividad [RN-17], ingredientes con stock bajo o agotados [RN-36], y productos agotados en catálogo).
- UI completa en `/admin/reportes`: selector de rango (presets: Hoy, Últimos 7 días, Mes actual, Personalizado con inputs date nativos y validación ≤ 92 días), pestañas de agrupación accesible, tarjetas de KPI con valores monetarios formateados, gráfico de barras interactivo y accesible en SVG nativo, tabla detallada con fila de totales y botón de exportación CSV.
- Widget de alertas en `/admin` (dashboard): visualización de alertas operativas con badges de severidad (`INFO`, `ADVERTENCIA`, `CRITICA`), descripción clara de cada ítem, enlaces directos a las vistas de inventario, catálogo y POS, y estado vacío positivo ("Sin alertas pendientes").

## Commits realizados

1. `14a7562` — `feat(shared): esquemas y validaciones para reportes de ventas y alertas`
2. `c165755` — `feat(api): vistas sql 0006 y endpoints de reportes y alertas`
3. `2d87f1a` — `feat(web): pantalla de reportes por rango con csv y widget de alertas`
4. `9fd6a1f` — `docs: documentacion de reportes, alertas y reporte de verificacion`

## Decisiones del orquestador aplicadas

1. **Estructura de respuesta de alertas:** Contrato `{ items: Alerta[] }` con unión discriminada `tipo` (`PEDIDO_OLVIDADO`, `STOCK_BAJO`, `STOCK_AGOTADO`, `PRODUCTO_AGOTADO`), severidad en mayúsculas (`INFO | ADVERTENCIA | CRITICA`), timestamp ISO y payload dinámico `datos` por tipo de alerta.
2. **Estructura de respuesta de reportes:** Contrato `{ desde, hasta, agrupar, items: [...], totales: { ... } }`, donde cada ítem contiene `{ clave, etiqueta, pedidos, ventas, propinas, ticketPromedio, unidades? }`.
3. **Manejo de pedidos anulados:** Se reflejan en el campo `totales.pedidosAnulados` del reporte, consultando la vista `v_reporte_pedidos_anulados`.

## Archivos modificados y creados

- `packages/shared/src/schemas/reportes.ts`: Esquemas Zod para query de reportes, items, totales, respuesta y unión discriminada de alertas.
- `packages/shared/src/schemas/reportes.test.ts`: 10 pruebas unitarias para validación de rango (≤ 92 días, formato, desde <= hasta) y esquemas de alertas.
- `packages/shared/src/schemas/administracion.ts`: Re-exportación y alias de esquemas para administración.
- `packages/shared/src/index.ts`: Exportación de esquemas y tipos de reportes y alertas en `@mb/shared`.
- `apps/api/drizzle/0006_vistas_reportes.sql`: Migración SQL con vistas `v_reporte_ventas_dia`, `v_reporte_ventas_producto`, `v_reporte_ventas_metodo`, `v_reporte_ventas_cajero`, `v_reporte_pedidos_anulados` y `v_pedidos_olvidados`.
- `apps/api/drizzle/meta/_journal.json`: Registro de la migración `0006_vistas_reportes`.
- `apps/api/src/modules/administracion/administracion.service.ts`: Métodos `reporteVentas`, `reporteVentasCsv` y `obtenerAlertas` consumiendo vistas SQL y tipado estricto.
- `apps/api/src/modules/administracion/administracion.controller.ts`: Endpoints `GET /admin/reportes/ventas`, `GET /admin/reportes/ventas.csv` y `GET /admin/alertas` protegidos por rol `ADMIN`.
- `apps/api/test/reportes.spec.ts`: 12 pruebas de integración en API cubriendo RBAC, RN-16, RN-17, RN-36, RN-61, agrupaciones, CSV con BOM y anulados.
- `apps/web/src/i18n/es.ts`: Traducciones para reportes (presets, agrupaciones, KPIs, columnas) y alertas (títulos, severidades, descripciones y enlaces).
- `apps/web/src/app/app-shell.tsx`: Enlace de navegación `/admin/reportes` con icono `BarChart3`.
- `apps/web/src/features/admin/routes.tsx`: Ruta `/admin/reportes` vinculada a `ReportesPage`.
- `apps/web/src/features/admin/reportes-page.tsx`: Pantalla completa de reportes con filtros, gráfico SVG accesible, tabla y exportación CSV.
- `apps/web/src/features/admin/dashboard-page.tsx`: Integración del widget de alertas del sistema con recuentos por tipo y badges de severidad.
- `docs/API.md`: Documentación de los endpoints `GET /admin/reportes/ventas`, `GET /admin/reportes/ventas.csv` y `GET /admin/alertas`.
- `docs/DATA_MODEL.md`: Documentación de las 6 vistas creadas por la migración `0006`.
- `docs/BUSINESS_RULES.md`: Actualización del estado de RN-17 a Implementada con referencias de código.
- `docs/ROADMAP.md`: Actualización de estado en Hito 5 y Backlog técnico 7.
- `docs/verificacion/feat-reportes.md`: Este documento de verificación.

## Endpoints y Vistas Nuevos

### Endpoints
- `GET /api/v1/admin/reportes/ventas?desde&hasta&agrupar=dia|producto|metodo|cajero` (Solo `ADMIN`)
- `GET /api/v1/admin/reportes/ventas.csv?desde&hasta&agrupar=dia|producto|metodo|cajero` (Solo `ADMIN`)
- `GET /api/v1/admin/alertas` (Solo `ADMIN`)

### Vistas SQL
- `v_reporte_ventas_dia`: Ventas, pedidos, propinas y ticket promedio por fecha operativa.
- `v_reporte_ventas_producto`: Unidades, pedidos, ventas y ticket promedio por producto y fecha operativa.
- `v_reporte_ventas_metodo`: Ventas, pedidos y propinas por método de pago y fecha operativa.
- `v_reporte_ventas_cajero`: Ventas, pedidos y propinas por cajero y fecha operativa.
- `v_reporte_pedidos_anulados`: Recuento de pedidos anulados por fecha operativa.
- `v_pedidos_olvidados`: Pedidos en estado ABIERTO con más de 12 horas sin actividad (RN-17).

## Tests Añadidos

### Unitarios (`packages/shared/src/schemas/reportes.test.ts`)
10 tests validando esquemas Zod:
- `reportesVentasQuerySchema`: fechas válidas, defaults, rango > 92 días rechazado, `desde > hasta` rechazado, agrupaciones válidas e inválidas.
- `alertaItemSchema`: unión discriminada correcta para `PEDIDO_OLVIDADO`, `STOCK_BAJO`, `STOCK_AGOTADO` y `PRODUCTO_AGOTADO`.

### Integración (`apps/api/test/reportes.spec.ts`)
12 tests de integración cubriendo:
1. `GET /admin/reportes/ventas`: rechaza acceso sin autenticación o con rol `CAJERO` (401/403).
2. Valida parámetros de rango (formato, `desde > hasta`, rango mayor a 92 días → 400).
3. RN-16: agrupa ventas por fecha operativa correcta considerando cortes 05:00 a 04:59.
4. Agrupa por producto con unidades vendidas y montos correctos.
5. Agrupa por método de pago (`EFECTIVO`, `TARJETA`, `TRANSFERENCIA`).
6. Agrupa por cajero con nombre y métricas asociadas.
7. Refleja pedidos anulados en `totales.pedidosAnulados`.
8. `GET /admin/reportes/ventas.csv`: genera CSV con BOM UTF-8 (`\uFEFF`), delimitador `;`, encabezados y totales.
9. `GET /admin/alertas`: rechaza acceso a no administradores.
10. RN-17: detecta pedidos abiertos con > 12 h sin actividad como `PEDIDO_OLVIDADO`.
11. RN-36: detecta ingredientes con stock bajo o agotado (`STOCK_BAJO`, `STOCK_AGOTADO`).
12. Detecta productos agotados activos (`PRODUCTO_AGOTADO`).

## Comandos (Resultados Reales)

| Comando | Resultado |
|---|---|
| `pnpm --filter @mb/shared typecheck` | 0 errores (TypeScript limpio) |
| `pnpm --filter api typecheck` | 0 errores (TypeScript limpio) |
| `pnpm --filter web typecheck` | 0 errores (TypeScript limpio) |
| `pnpm lint` | 0 errores (ESLint limpio en todo el monorepo) |
| `pnpm depcruise` | 0 violaciones (115 módulos, 422 dependencias analizadas) |
| `pnpm --filter web build` | OK (built in 3.10s) |
| `pnpm --filter @mb/shared test` | 13 suites, 157 tests verdes (1.65s) |
| `pnpm exec vitest run --no-file-parallelism` (apps/api) | 10 suites, 131 tests verdes (49.92s) |
| `pnpm db:migrate` + `pnpm db:seed` x2 | Idempotentes: migraciones aplicadas y seed exitoso en ambas corridas |

## Recorrido en el Navegador (Chrome DevTools MCP)

Recorrido visual y funcional ejecutado en Chromium real conectado a `http://localhost:5212`:
1. **Inicio de sesión:** Login exitoso con usuario `admin` / `admin123`.
2. **Apertura de caja:** Se abrió el turno con base en efectivo de $ 50.000.
3. **Flujo de ventas POS:**
   - Venta 1: Para llevar · 1x Monster Clásica ($ 24.900) + 1x Monster Bacon ($ 28.900) = $ 53.800 pagado en Efectivo exacto. Recibo generado R-000001.
   - Venta 2: Para llevar · 1x Crispy Chicken Burger ($ 23.900) + 1x Coca-Cola Original 400ml ($ 5.500) = $ 29.400 pagado con Tarjeta. Recibo generado R-000002.
4. **Pantalla `/admin/reportes`:**
   - KPI de Ventas: $ 83.200 (suma exacta de $ 53.800 + $ 29.400).
   - KPI de Pedidos: 2.
   - KPI de Ticket Promedio: $ 41.600.
   - Gráfico de barras SVG renderizado interactivamente con etiquetas monetarias COP.
   - Selector de agrupación interactivo:
     - Por Día: desglose con fila del día 2026-10-07 y fila de TOTALES.
     - Por Producto: desglose detallado (Monster Bacon, Monster Clásica, Crispy Chicken Burger, Coca-Cola) con unidades y montos.
     - Por Método: desglose de $ 53.800 en Efectivo y $ 29.400 en Tarjeta.
   - Botón "Exportar CSV" habilitado y descarga validada con BOM UTF-8 y `;`.
   - **Captura guardada:** `%TEMP%\mb-reportes-shots\reportes-dashboard.png`.
5. **Generación de alertas operativas:**
   - Registro de merma en inventario: 50 unidades de "Agua Cristal 500ml" (stock restante 10 und < mínimo 15 und → `STOCK_BAJO`).
   - Registro de merma de 40 unidades de "Brownie de Chocolate" (stock restante 0 und → `STOCK_AGOTADO` e impacto en producto `PRODUCTO_AGOTADO`).
6. **Widget de alertas en `/admin` (dashboard):**
   - Recuentos consolidados: 1 Stock bajo, 1 Ingrediente agotado, 1 Producto agotado.
   - Tarjetas de alerta con badges de severidad (`Advertencia`, `Crítico`), textos descriptivos y enlaces directos a `/admin/inventario` y `/admin/productos`.
   - **Captura guardada:** `%TEMP%\mb-reportes-shots\admin-alertas.png`.
7. **Consola del navegador:** 0 errores y 0 advertencias registradas (`<no console messages found>`).

## Checklist de UI

- **Tokens de color:** Exclusivamente tokens del sistema de diseño (sin colores arbitrarios).
- **Iconos:** Solo `lucide-react` (`BarChart3`, `Download`, `AlertTriangle`, `TrendingUp`, `Calendar`, `DollarSign`, `ShoppingBag`, etc.). Sin emojis.
- **Tamaño táctil:** Todos los botones, pestañas y disparadores interactivos cuentan con `min-h-[48px]` o padding táctil equivalente.
- **Accesibilidad (a11y):** Roles semánticos `tablist`, `tab`, `table`, `aria-label`, leyendas explícitas, tablas con encabezados `scope="col"`, gráfico SVG con título accesible (`role="img"`).
- **Estados vacíos y de carga:** Diseños amigables con indicaciones claras cuando no existen registros en el rango.
- **Consola limpia:** 0 errores de JavaScript en navegación real.

## Pendientes, Supuestos y Riesgos

- **Supuestos:** Se asumió que los pedidos anulados se reflejan en el conteo total acumulado de pedidos cerrados y en un indicador específico `pedidosAnulados` dentro del objeto `totales`.
- **Riesgos:** Ninguno detectado. El impacto sobre la base de datos es exclusivamente mediante vistas agregadas de solo lectura sin lock contention.
