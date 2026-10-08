# Reporte de Verificación: Feature C · Anular Pedidos y Deshacer en Cocina

- **Rama:** `feat/anular-deshacer`
- **Worktree:** `.worktrees/feat-pedidos`
- **Fecha:** 2026-10-07
- **Base de datos:** `mb_pedidos` (tests en `mb_pedidos_test`)
- **Puertos:** API `3041`, Web `5211`

---

## 1. Archivos Modificados y Creados

- `apps/api/src/modules/cocina/cocina.controller.ts`: Endpoint `POST /comandas/:id/deshacer` protegido para ADMIN y COCINA.
- `apps/api/src/modules/cocina/cocina.service.ts`: Lógica de deshacer con verificación <= 10s en servidor, limpieza de marcas de tiempo y evento `ComandaDeshecha`; soporte de anular en cualquier estado no ANULADA.
- `apps/api/src/modules/pedidos/pedidos.controller.ts`: Endpoint `POST /pedidos/:id/anular` protegido por `@Roles('ADMIN')`.
- `apps/api/src/modules/pedidos/pedidos.service.ts`: Transacción atómica de anulación con control optimista, reversión o merma en inventario (RN-35), anulación de comanda, liberación de mesa y eventos.
- `apps/api/src/modules/realtime/realtime-mapa.ts`: Mapeo de `ComandaDeshecha` a `comanda.estado` y `ComandaAnulada` a `comanda.anulada` para canales `cocina` y `pos`.
- `apps/api/test/pedidos-anular-deshacer.spec.ts`: Suite de 16 tests de integración para RN-50, RN-35, RN-60 y RN-22.
- `apps/web/src/features/cocina/cocina-page.tsx`: Barra flotante con temporizador regresivo de 10 s, botón de deshacer (>= 48 px), icono `RotateCcw` y mutación `deshacer`.
- `apps/web/src/features/pos/anular-pedido-dialog.tsx`: Diálogo accesible de confirmación con explicación de impacto en stock, conteo de caracteres (mín 5, máx 500) y botón táctil.
- `apps/web/src/features/pos/pos-page.tsx`: Integración del diálogo de anulación y botones "Anular pedido" en cabecera y ticket aside para pedidos ABIERTO o CONFIRMADO.
- `apps/web/src/features/pos/queries.ts`: Hook `useAnularPedido` con invalidación de queries de pedidos, comandas, mesas y pedidos activos.
- `apps/web/src/i18n/es.ts`: Textos en español bajo `pos` y `cocinaKds` para anulación y deshacer.
- `docs/API.md`: Documentación de `POST /api/v1/pedidos/:id/anular` y `POST /api/v1/comandas/:id/deshacer`.
- `docs/BUSINESS_RULES.md`: Actualización del estado de RN-22, RN-35 y RN-50 a **Implementada** con enlaces a archivos.
- `docs/ROADMAP.md`: Actualización del backlog completado para RN-22, RN-35 y RN-50.
- `docs/verificacion/feat-pedidos.md`: Este documento de verificación.

---

## 2. Endpoints y Tablas Nuevos

- **Endpoints Nuevos:**
  - `POST /api/v1/pedidos/:id/anular`: Rol `ADMIN` (RN-50). Valida estado `ABIERTO` o `CONFIRMADO`, control optimista `version`, motivo (5-500 caracteres).
  - `POST /api/v1/comandas/:id/deshacer`: Roles `ADMIN`, `COCINA` (RN-22). Valida límite de 10 segundos, control optimista `version`, revierte estados `EN_PREPARACION -> PENDIENTE`, `LISTA -> EN_PREPARACION` y `ENTREGADA -> LISTA`.
- **Tablas:** Ninguna tabla ni migración nueva requerida; el esquema base ya contaba con `anulado_at`, `anulado_por`, `motivo_anulacion` en `pedido` y `anulada_at` en `comanda`.

---

## 3. Tests Añadidos

Archivo `apps/api/test/pedidos-anular-deshacer.spec.ts` (16 tests de integración con PostgreSQL real):
- `RN-50: anular pedido requiere rol ADMIN (cajero recibe 403 SIN_PERMISO)`
- `RN-50: anular pedido requiere motivo de al menos 5 caracteres`
- `RN-50: anular pedido requiere version para control de concurrencia optimista`
- `RN-50: anular pedido en version desactualizada falla con 409 VERSION_CONFLICT`
- `RN-50: anular pedido en estado ABIERTO sin comanda no toca inventario y libera la mesa`
- `RN-35 / RN-50: anular pedido CONFIRMADO con comanda PENDIENTE revierte el stock (movimiento REVERSION)`
- `RN-35: reversión de stock emite IngredienteRepuesto si el ingrediente supera el mínimo`
- `RN-35 / RN-50: anular pedido con comanda EN_PREPARACION registra MERMA (par REVERSION+MERMA, stock neto no cambia)`
- `RN-50: anular pedido con comanda LISTA registra MERMA y marca comanda y pedido como ANULADO`
- `RN-50: anular pedido CERRADO está prohibido y responde 409 ESTADO_INVALIDO`
- `RN-50: anular pedido ya ANULADO responde 409 ESTADO_INVALIDO`
- `RN-60: la anulación emite PedidoAnulado y ComandaAnulada en evento_sistema`
- `RN-22: deshacer revierte EN_PREPARACION a PENDIENTE y limpia iniciadaAt si ocurre en <= 10 segundos`
- `RN-22: deshacer revierte LISTA a EN_PREPARACION y limpia listaAt`
- `RN-22: deshacer falla con 409 TIEMPO_EXPIRADO si han pasado más de 10 segundos`
- `RN-22: deshacer falla con 409 VERSION_CONFLICT si la versión no coincide`

---

## 4. Salida Resumida de Comandos de Verificación

1. **Shared package:**
   - `pnpm --filter @mb/shared build`: 0 errores.
   - `pnpm --filter @mb/shared test`: 12 test files passed, 147 passed (147).
2. **Typecheck:**
   - `pnpm --filter api typecheck`: 0 errores (`tsc --noEmit`).
   - `pnpm --filter web typecheck`: 0 errores (`tsc --noEmit`).
3. **Lint:**
   - `pnpm lint`: 0 errores, 0 warnings en todo el monorepo.
4. **Dependency Cruiser:**
   - `pnpm depcruise`: `✔ no dependency violations found (113 modules, 415 dependencies cruised)`.
5. **Web Build:**
   - `pnpm --filter web build`: Compilación Vite client environment exitosa (`dist/` generado, 0 errores).
6. **API Tests:**
   - `pnpm exec vitest run --no-file-parallelism`: 10 passed (10 files), 135 passed (135 tests).
7. **Idempotencia de Migración y Seed:**
   - `pnpm db:migrate` y `pnpm db:seed` ejecutados dos veces consecutivas: ambos idempotentes y sin errores.

---

## 5. Recorrido en Navegador con Capturas

Realizado en Chrome mediante Chrome DevTools MCP en `http://localhost:5211`:
- `01-pos-pedido-confirmado.png`: Pedido #1 en Mesa 1 en estado CONFIRMADO tras ser enviado a cocina. El botón "Anular pedido" se muestra en la cabecera y en el panel lateral de ticket para rol ADMIN.
- `02-pos-anular-dialogo-vacio.png`: Diálogo `AnularPedidoDialog` abierto; explica que los ingredientes se devolverán al inventario (RN-35), muestra contador de caracteres `0 / 500` y mantiene el botón de confirmación deshabilitado.
- `03-pos-anular-dialogo-lleno.png`: Motivo digitado (`Cliente canceló el pedido debido a demora en su mesa`, 52 caracteres), contador actualizado y botón "Sí, anular pedido" habilitado.
- `04-pos-pedido-anulado-exito.png`: Notificación toast "Pedido anulado correctamente", Mesa 1 liberada a estado "Libre", inventario restaurado y producto de nuevo en stock.
- `05-kds-comanda-pendiente.png`: Pedido #2 en pantalla KDS en columna PENDIENTES con botón táctil INICIAR.
- `06-kds-barra-deshacer-activa.png`: Tras presionar INICIAR, se despliega la barra flotante inferior con cuenta regresiva de 10 s, indicador `#002`, botón accesible `Deshacer (7s)` y botón de descartar.
- `07-kds-transicion-deshecha.png`: Al pulsar Deshacer antes de los 10 segundos, la comanda revierte inmediatamente a su estado previo sin errores.
- **Errores de consola:** 0 errores en DevTools Console.

---

## 6. Checklist de Accesibilidad y UI

- [x] **Foco visible:** Indicadores de anillo de foco `--ring` visibles en botones, inputs y selectores.
- [x] **Teclado:** Diálogos navegables y cerrables con Escape; botones accionables con Space/Enter.
- [x] **Objetivos táctiles (>= 48 px):** Botón "Anular pedido" (`h-12 min-h-12 px-4`), botones en diálogo (`min-h-12 min-w-12`), botón de deshacer en KDS (`h-12 min-h-12 min-w-12`).
- [x] **Tema claro / oscuro:** KDS fuerza tema oscuro; diálogo POS soporta tokens semánticos de ambos temas.
- [x] **Reduced motion:** Transiciones y animaciones protegidas con `motion-safe:`.
- [x] **Consola:** 0 errores y advertencias en consola.

---

## 7. Pendientes, Supuestos y Riesgos

- **Pendientes:** Ninguno para esta feature.
- **Supuestos:** Alineado con la instrucción del orquestador: para comanda en `EN_PREPARACION` o posterior se utiliza `reclasificarConsumoComoMerma` (par `REVERSION` + `MERMA`) para garantizar efecto neto de 0 en existencias físicas pero con trazabilidad completa en kardex.
- **Riesgos:** Ninguno identificado. Todos los flujos están protegidos por transacciones atómicas de base de datos y control de concurrencia optimista (`version`).
