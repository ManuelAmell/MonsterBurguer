# Verificación feat/ux-pos-pagos-mixtos (Feature E: Pagos mixtos y UX POS)

Fecha: 2026-10-08. Rama `feat/ux-pos-pagos-mixtos`. BD `mb_ux` / `mb_ux_test`, API :3061, Web :5231.

## Alcance

1. **Pagos mixtos (RN-42, RN-43):**
   - Esquema Zod en `@mb/shared/schemas/caja.ts` que permite de 1 a 3 líneas de pago (`pagos.length` entre 1 y 3), métodos no repetidos (`unique`), y máximo 1 pago en `EFECTIVO`.
   - `caja.service.ts`: validación de que la suma de los montos de pago coincide exactamente con `total + propina`, validación de `recibido >= monto` en efectivo con cálculo exacto de `cambio = recibido - monto`, y registro detallado en `pago` y `recibo`.
   - `caja.service.ts:cerrar`: arqueo de sesión de caja donde `ventasEfectivo` contabiliza estrictamente la porción pagada en `EFECTIVO` de cada cobro, sin contaminarse con pagos en tarjeta o transferencia (RN-47).
   - Migración `0007_reporte_metodo_pagos.sql`: actualización de la vista `v_reporte_ventas_metodo` para desglosar ventas reales por método, distribuir propinas proporcionalmente con asignación del residuo al método mayor, incluir columna `cobrado` (`ventas + propinas`) y contar recibos únicos sin duplicidad ante pagos mixtos.
   - `apps/web/src/features/pos/cobro-dialog.tsx`: interfaz de cobro con hasta 3 métodos dinámicos (`MAX_LINEAS = 3`), campos editables de monto y recibido para todas las líneas, teclado numérico sincronizado con el campo activo, botones de acceso rápido `Resto en [método]` por línea y en el resumen de balance, indicador en tiempo real de saldo pendiente o sobrante, y deshabilitación del método `Efectivo` si ya existe una línea de efectivo.
   - Recibo POS (`recibo.tsx`): desglose transparente de todos los métodos pagados, efectivo recibido y cambio.

2. **Búsqueda de productos en POS (`apps/web/src/features/pos/pos-page.tsx`):**
   - Barra de búsqueda responsiva en el encabezado del POS con icono, placeholder y atajo `/`.
   - Debounce de 200 ms con hook `useEffect`.
   - Atajo de teclado `/` que enfoca y selecciona el texto de búsqueda desde cualquier parte de la pantalla (evitando activarse cuando el foco está en un input editable).
   - Búsqueda insensible a mayúsculas y acentos (`normalize('NFD')`) a través de **todas** las categorías del menú.
   - Vista de resultados con encabezado de coincidencias, botón para limpiar búsqueda y renderizado de tarjetas de producto interactivas.
   - Estado vacío amigable cuando ningún producto coincide, con botón táctil para limpiar el filtro.

3. **Trampa de foco accesible (`useFocusTrap`) en diálogos modales:**
   - Implementado en `apps/web/src/components/ui/dialog.tsx`, `apps/web/src/components/ui/alert-dialog.tsx` y `apps/web/src/components/ui/sheet.tsx`.
   - Foco automático en el primer elemento interactivo (`autofocus` o primer botón/input/select) o `initialFocus` configurable.
   - Atrapamiento cíclico de teclado (`Tab` y `Shift + Tab`) dentro del contenedor modal.
   - Cierre inmediato con la tecla `Escape`.
   - Restauración automática del foco al elemento disparador (opener) al desmontarse o cerrarse el diálogo.
   - Cumplimiento de estándares WAI-ARIA: `role="dialog"`, `aria-modal="true"` y vinculación a `aria-labelledby`.

4. **Paginación determinista de ingredientes en inventario (`apps/web/src/features/admin/inventario-page.tsx`):**
   - `inventario.repository.ts`: cursor keyset compuesto `(nombre, id)` coherente con el ordenamiento alfabético `ORDER BY nombre ASC, id ASC`, mediante la condición `(nombre > :nombre) OR (nombre = :nombre AND id > :id)` y cursor serializado en base64 opaco.
   - `apps/web/src/features/admin/inventario-page.tsx`: integración de `useInfiniteQuery` con tamaño de página de 50 ítems.
   - Botón táctil accesible "Cargar más" con spinner de carga, estado deshabilitado durante la petición y ocultación automática cuando no hay más páginas (`hasNextPage === false`).
   - Verificado con más de 100 ingredientes (123 ingredientes en la prueba).

---

## Commits Realizados

1. `feat(shared): soporte de pagos mixtos (1-3 metodos) en esquemas de caja`
2. `feat(api): pagos mixtos, reporte metodo de pagos 0007 y cursor keyset de inventario`
3. `feat(web): pagos mixtos en cobro, busqueda en pos, focus trap y paginacion de inventario`
4. `docs: documentacion de negocio, api, modelo y reporte de verificacion feat-ux`

---

## Archivos Modificados y Creados

- `packages/shared/src/schemas/caja.ts`: Esquema Zod `cobroSchema` para 1 a 3 métodos, validación de unicidad y máximo 1 efectivo.
- `packages/shared/src/schemas/caja.test.ts`: Pruebas unitarias para pagos mixtos, unicidad de métodos y rechazo de montos no positivos.
- `packages/shared/src/schemas/reportes.ts`: Adición del campo `cobrado` a `reporteVentasMetodoFilaSchema` para el desglose de ventas por método.
- `apps/api/drizzle/0007_reporte_metodo_pagos.sql`: Migración SQL que actualiza `v_reporte_ventas_metodo` con soporte para pagos mixtos, distribución de propinas y columna `cobrado`.
- `apps/api/drizzle/meta/_journal.json`: Registro de la migración 0007.
- `apps/api/src/modules/caja/caja.service.ts`: Lógica de cobro con 1-3 pagos mixtos y conteo estricto de efectivo en arqueo de caja.
- `apps/api/src/modules/administracion/administracion.service.ts`: Mapeo del campo `cobrado` en reportes de ventas por método.
- `apps/api/src/modules/inventario/inventario.repository.ts`: Paginación keyset `(nombre, id)` con cursor opaco en base64.
- `apps/api/test/caja.spec.ts`: Pruebas de integración para RN-42 (pagos mixtos, recibo, sumas incorrectas, métodos repetidos) y RN-47 (arqueo de caja).
- `apps/api/test/reportes.spec.ts`: Pruebas de integración para `v_reporte_ventas_metodo` con pagos mixtos y exportación CSV con `Cobrado`.
- `apps/api/test/catalogo-inventario.spec.ts`: Prueba de paginación determinista con 110 ingredientes sin duplicados ni pérdidas.
- `apps/web/src/components/ui/dialog.tsx`: Hook `useFocusTrap` (foco inicial, Tab/Shift+Tab, Escape, restore focus, `aria-modal`).
- `apps/web/src/components/ui/alert-dialog.tsx`: Hook `useFocusTrap` en diálogos de alerta.
- `apps/web/src/components/ui/sheet.tsx`: Hook `useFocusTrap` en paneles laterales.
- `apps/web/src/features/pos/cobro-dialog.tsx`: Diálogo de cobro con hasta 3 métodos, keypad, atajos de resto y resumen de balance.
- `apps/web/src/features/pos/pos-page.tsx`: Barra de búsqueda en POS, debounce 200 ms, atajo `/`, filtro insensible a mayúsculas/acentos y estado vacío.
- `apps/web/src/features/admin/inventario-page.tsx`: Paginación infinita por cursor keyset con botón "Cargar más".
- `apps/web/src/i18n/es.ts`: Textos en español para búsqueda, pagos mixtos y saldo pendiente.
- `docs/API.md`: Documentación de `POST /caja/cobros` con pagos mixtos y `GET /ingredientes` con cursor keyset.
- `docs/DATA_MODEL.md`: Documentación de la actualización de `v_reporte_ventas_metodo` en migración 0007.
- `docs/BUSINESS_RULES.md`: Actualización del estado de RN-42 a Implementada.
- `docs/ROADMAP.md`: Actualización de estado en el backlog técnico (ítems 2, 5 y 6 completados).
- `docs/verificacion/feat-ux.md`: Este reporte de verificación.

---

## Endpoints y Tablas Nuevos / Modificados

### Endpoints Modificados
- `POST /api/v1/caja/cobros`: Acepta `pagos` como arreglo de 1 a 3 elementos con métodos únicos (`EFECTIVO`, `TARJETA`, `TRANSFERENCIA`), máximo 1 en efectivo.
- `GET /api/v1/ingredientes`: Soporta paginación determinista mediante cursor keyset en base64 `(nombre, id)` ordenado alfabéticamente.
- `GET /api/v1/admin/reportes/ventas` y `.csv`: Incluye columna `cobrado` en agrupación por método.

### Vistas SQL Modificadas
- `v_reporte_ventas_metodo`: Actualizada en la migración `0007_reporte_metodo_pagos.sql`.

---

## Tests Añadidos

### Unitarios (`packages/shared/src/schemas/caja.test.ts`)
- `RN-42`: Valida cobro con 1, 2 o 3 métodos de pago válidos.
- `RN-42`: Rechaza cobro con más de 3 métodos de pago.
- `RN-42`: Rechaza cobro con métodos repetidos (ej. dos tarjetas).
- `RN-42`: Rechaza cobro con dos pagos en efectivo.
- Rechaza pagos con montos no positivos o no enteros.
- Valida montos de efectivo recibido y cálculo de cambio.

### Integración API (`apps/api/test/caja.spec.ts`)
- `RN-42: cobro mixto exitoso con 2 metodos (efectivo + tarjeta) desglosados en recibo`: Venta de $59.100 pagada con $30.000 en efectivo (recibido $50.000 -> cambio $20.000) y $29.100 en tarjeta. Verifica estado `CERRADO`, dos registros en tabla `pago`, recibo con desglose y cambio exacto.
- `RN-42: cobro mixto exitoso con 3 metodos (efectivo + tarjeta + transferencia)`: Venta pagada con los tres métodos simultáneos.
- `RN-43: rechaza cobro mixto si la suma de pagos no coincide exactamente con total + propina (409 SUMA_PAGOS_INVALIDA)`.
- `RN-42: rechaza cobro mixto con dos lineas de efectivo (400 VALIDACION)`.
- `RN-42: rechaza cobro mixto con metodos repetidos (400 VALIDACION)`.
- `RN-42: rechaza cobro mixto con mas de 3 metodos (400 VALIDACION)`.
- `RN-47: arqueo de caja cuenta unicamente la porcion en efectivo de pagos mixtos`: Apertura $100.000 + cobro mixto ($30.000 efectivo + $29.100 tarjeta) -> ventas en efectivo exactamente $30.000 y efectivo esperado $130.000.

### Integración Reportes (`apps/api/test/reportes.spec.ts`)
- Validación de `v_reporte_ventas_metodo` con pedidos de pago mixto: ventas y propinas proporcionales, sin duplicar conteo de pedidos (`COUNT(DISTINCT r.id)`), columna `Cobrado` en JSON y exportación CSV.

### Integración Inventario (`apps/api/test/catalogo-inventario.spec.ts`)
- `Paginacion keyset de ingredientes (>100 items)`: Inserción de 110 ingredientes y verificación de recorrido página a página con cursor compuesto `(nombre, id)` en base64, garantizando orden alfabético estricto, 0 duplicados y 0 ítems omitidos.

---

## Comandos (Resultados Reales)

| Comando | Resultado |
|---|---|
| `pnpm --filter @mb/shared build` | OK (0 errores) |
| `pnpm --filter web typecheck` | OK (0 errores) |
| `pnpm --filter api typecheck` | OK (0 errores) |
| `pnpm lint` | OK (0 errores en todo el monorepo) |
| `pnpm depcruise` | OK (0 violaciones, 115 módulos analizados) |
| `pnpm --filter web build` | OK (dist generado en 1.67s) |
| `pnpm --filter @mb/shared test` | 13 suites, 159 tests verdes |
| `pnpm exec vitest run --no-file-parallelism` (apps/api) | 11 suites, 155 tests verdes |
| `pnpm db:migrate && pnpm db:seed` x2 | Idempotencia verificada: migraciones aplicadas y seed exitoso en ambas ejecuciones |

---

## Recorrido en el Navegador (Chrome DevTools MCP)

Recorrido visual y funcional ejecutado en Chromium real conectado a `http://localhost:5231` (Web) y `http://localhost:3061` (API):

1. **POS - Vista inicial:**
   - Carga limpia del catálogo y categorías.
   - **Captura:** `%TEMP%\mb-ux-shots\01-pos-inicial.png`.
2. **POS - Búsqueda de productos con atajo `/` y debounce:**
   - Atajo `/` probado con teclado real (`press_key: /`), enfoca de inmediato el input de búsqueda.
   - Búsqueda "bacon" encuentra productos a través de múltiples categorías: "Monster Bacon" (Hamburguesas) y "Papas Monster Cheddar & Bacon" (Acompañamientos).
   - **Captura:** `%TEMP%\mb-ux-shots\02-pos-busqueda-bacon.png`.
3. **POS - Estado vacío de búsqueda:**
   - Búsqueda "inexistente" muestra el estado vacío amigable con botón "Limpiar búsqueda".
   - Al pulsar "Limpiar búsqueda", el filtro se restablece y reaparece el menú categorizado.
   - **Captura:** `%TEMP%\mb-ux-shots\03-pos-busqueda-vacia.png`.
4. **POS - Diálogo de cobro inicial y trampa de foco:**
   - Pedido de $ 52.800 (1x Monster Bacon + 1x Crispy Chicken Burger).
   - Apertura del diálogo con foco inicial automático en el primer método de pago (`initialFocus`).
   - Atributos `role="dialog"`, `aria-modal="true"` y `aria-labelledby` presentes.
   - **Captura:** `%TEMP%\mb-ux-shots\04-pos-cobro-dialog-inicial.png`.
5. **POS - Pagos mixtos dinámicos y balance:**
   - Pulsación en "Agregar otro método" añade segunda línea (Tarjeta).
   - El selector "Efectivo" queda deshabilitado en la segunda línea (RN-42).
   - Monto en efectivo: $ 30.000, recibido: $ 50.000 -> cambio calculado automáticamente en grande: $ 20.000.
   - Botón de atajo "Resto en Tarjeta" asigna los $ 22.800 restantes con un solo toque.
   - Saldo cuadrado: badge verde "El pago cuadra con el total" ($ 0 pendiente) y botón "Confirmar cobro · $ 52.800" habilitado.
   - **Captura:** `%TEMP%\mb-ux-shots\05-pos-cobro-mixto-cuadrado.png`.
6. **POS - Recibo de pago mixto y restauración de foco:**
   - Cobro confirmado exitosamente generando recibo `R-000001`.
   - Diálogo de recibo modal con trampa de foco centrada en el botón "Cerrar".
   - Desglose visible: Efectivo $ 30.000 (Recibido $ 50.000), Tarjeta $ 22.800, Cambio $ 20.000.
   - Al cerrar el recibo, el foco retorna al contexto del POS.
   - **Captura:** `%TEMP%\mb-ux-shots\06-pos-recibo-pago-mixto.png`.
7. **Caja - Arqueo y ventas por método:**
   - Sesión de caja refleja: Ventas en efectivo = $ 30.000, Ventas con tarjeta = $ 22.800.
   - Efectivo esperado = $ 130.000 (Apertura $ 100.000 + Efectivo $ 30.000). Tarjeta excluida estrictamente (RN-47).
   - **Captura:** `%TEMP%\mb-ux-shots\07-caja-resumen-ventas-mixtas.png`.
8. **Admin - Paginación de inventario (> 100 ingredientes):**
   - Página 1: Carga los primeros 50 ingredientes ordenados alfabéticamente con botón "Cargar más".
   - **Captura:** `%TEMP%\mb-ux-shots\08-admin-inventario-paginacion-pagina1.png`.
   - Página 2: Pulsación de "Cargar más" añade 50 ítems adicionales sin duplicados (100 ítems acumulados) manteniendo el botón "Cargar más".
   - **Captura:** `%TEMP%\mb-ux-shots\09-admin-inventario-paginacion-pagina2.png`.
   - Página 3: Pulsación final carga los 23 ítems restantes (123 ingredientes en total) y el botón "Cargar más" se oculta automáticamente.
   - **Captura:** `%TEMP%\mb-ux-shots\10-admin-inventario-paginacion-completa.png`.
9. **Admin - Trampa de foco y tecla Escape:**
   - Diálogo "Registrar entrada: Tomate Rojo" enfoca automáticamente el input de cantidad.
   - Pulsación de tecla `Escape` cierra el diálogo inmediatamente y restaura el foco al botón de apertura.
10. **Consola del navegador:** 0 errores y 0 advertencias (`<no console messages found>`).

---

## Checklist de UI

- **Tokens de color:** Exclusivamente tokens semánticos del sistema (`--primary`, `--background`, `--card`, `--muted`, `--destructive`, `--ring`).
- **Iconos:** Solo `lucide-react` (`Search`, `X`, `ReceiptText`, `Plus`, `Trash`, `Loader2`, `ArrowDownToLine`). Sin emojis.
- **Tamaño táctil:** Todos los botones interactivos (`CobroDialog`, keypad numérico, "Cargar más", "Limpiar búsqueda") tienen `min-h-[48px]` o padding táctil correspondiente (≥ 48 px).
- **Accesibilidad (a11y):** Roles `dialog`, `alertdialog`, atributos `aria-modal="true"`, `aria-labelledby`, `aria-label` en botones iconográficos, foco inicial visible (`ring-2 ring-ring`) y orden de tabulación atrapado cíclicamente.
- **Soporte de teclado:** Atajo `/` para búsqueda, `Escape` para cerrar diálogos, `Tab`/`Shift+Tab` para navegar controles.
- **Consola limpia:** 0 errores en DevTools.

---

## Pendientes, Supuestos y Riesgos

- **Pendientes:** Ninguno. Todas las funcionalidades requeridas para Feature E fueron implementadas y verificadas.
- **Supuestos:** Según confirmación del orquestador, la vista `v_reporte_ventas_metodo` distribuye las propinas proporcionalmente asignando el residuo al método mayor, y la columna `cobrado` (`ventas + propinas`) se expone en la API y el reporte.
- **Riesgos:** Ninguno. No se agregaron dependencias externas al monorepo; la trampa de foco se resolvió con código nativo y seguro.
