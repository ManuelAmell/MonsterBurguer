# Verificación feat/caja-completa (Caja completa: RN-46, RN-47, historial)

Fecha: 2026-10-07. Rama `feat/caja-completa`. BD `mb_caja` / `mb_caja_test`, API :3031, web :5201.

## Alcance

- RN-46: movimientos manuales de caja (`INGRESO` / `RETIRO`), tabla `movimiento_caja` (migración `0004_movimientos_caja.sql`).
- RN-47: efectivo esperado = apertura + ventas en efectivo + ingresos − retiros; resumen de cierre e impresión con ingresos y retiros.
- Historial de cierres paginado por cursor y detalle de sesión.
- UI en `/caja`: pestañas "Turno actual" e "Historial de cierres", diálogo de movimiento, lista de movimientos, detalle.

## Endpoints nuevos

- `POST /caja/sesiones/:id/movimientos`
- `GET /caja/sesiones/:id/movimientos`
- `GET /caja/sesiones?desde&hasta&cursor&limit`
- `GET /caja/sesiones/:id`

## Decisiones del orquestador aplicadas

1. Retiro que deja el efectivo esperado negativo: `409 EFECTIVO_INSUFICIENTE` (documentado en `docs/API.md`).
2. Columna de fecha `created_at`.
3. `desde` y `hasta` son fechas operativas YYYY-MM-DD inclusivas, aplicadas a la fecha de apertura. `sesion_caja` no tiene `fecha_operativa`, así que el filtro usa los límites del día operativo de RN-16 (05:00 America/Bogota, sin DST) sobre `abierta_at`. Formato inválido o `desde > hasta` → 400.
4. `IdentidadPublicService.nombresPorIds(ids, tx?)` expuesto por `identidad.public.ts`; historial y detalle devuelven `cajero: { id, nombre }`.

## Trabajo previo de agy: validación y correcciones

- Revisado: migración, esquema Drizzle, servicio, controlador, esquemas shared, `caja.spec.ts`. Lógica correcta (bloqueo `FOR UPDATE` de la sesión al registrar, evento en transacción, permisos por rol).
- Corregido: agy había borrado la clave i18n `caja.cerradaAt`, que usa `caja-page.tsx` (se restauró).
- Corregido: `normalizarSesion` en el front ignoraba el resumen porque la API devuelve los campos planos; ahora los lee también del objeto raíz (se ven ingresos y retiros en vivo).
- Añadidos tests: paginación por cursor, filtro por fecha operativa, formato de fecha inválido.
- La UI (diálogo, lista, historial, detalle, pestañas) no existía: se construyó.

## Archivos

- `apps/api/drizzle/0004_movimientos_caja.sql`, `meta/_journal.json`: migración.
- `apps/api/src/modules/caja/*`: esquema, servicio, controlador, módulo.
- `apps/api/src/modules/identidad/*` (`public-service`, `public`, `module`, `repository`): `nombresPorIds`.
- `apps/api/test/caja.spec.ts`: 18 tests de integración.
- `packages/shared/src/schemas/caja.ts` y `caja.test.ts`: esquemas de movimiento, historial y detalle.
- `apps/web/src/features/caja/{caja-page,movimientos,historial-cierres,entrada-monto,queries}.ts(x)`: UI.
- `apps/web/src/i18n/es.ts`: solo la clave `caja`.
- `docs/API.md`, `DATA_MODEL.md`, `BUSINESS_RULES.md`, `ROADMAP.md`.

## Tests añadidos (apps/api/test/caja.spec.ts)

RN-46: ingreso, retiro, retiro negativo → 409 `EFECTIVO_INSUFICIENTE`, cajero ajeno → 403, ADMIN permitido, listado, sesión cerrada → 409, evento `MovimientoCajaRegistrado`. RN-47: cierre con movimientos cuadra (diferencia 0). Historial: ADMIN ve todo, CAJERO solo lo suyo, nombre del cajero, cursor, filtros de fecha, 400 por rango/formato, detalle y 403.

## Comandos (resultados reales)

| Comando | Resultado |
|---|---|
| `pnpm typecheck` | 0 errores (shared, api, web; ejecutados en secuencia) |
| `pnpm lint` | 0 errores |
| `pnpm depcruise` | 0 violaciones (108 módulos) |
| `pnpm --filter web build` | OK (solo aviso de tamaño de chunk) |
| `pnpm --filter api test` | 7 archivos, 89 tests verdes (con `--no-file-parallelism`) |
| `pnpm --filter @mb/shared test` | 10 archivos, 132 tests verdes |
| `db:migrate` + `db:seed` x2 | idempotentes ("Seed listo" dos veces) |

Nota: con la RAM disponible, `vitest` en paralelo y `pnpm -r typecheck` caen por OOM y llegaron a dejar PostgreSQL en recuperación; en secuencia todo pasa.

## Recorrido en el navegador (capturas en `%TEMP%\mb-caja-shots`)

caja1: abrir con $50.000 → ingreso $20.000 ("Base para cambio") → retiro $5.000 ("Compra de hielo") → venta en efectivo desde /pos (Monster Clásica $24.900, recibo R-000001) → esperado $89.900 → contado $89.900 → "Caja cuadrada" → pestaña Historial: fila con esperado, contado y diferencia (icono + texto) → detalle con totales por método y movimientos. 0 errores o avisos de consola.

Capturas: `02-dialogo-ingreso`, `03-turno-con-movimientos`, `04-cierre-cuadrado`, `05-historial-detalle`, `06-historial-1024`.

## Checklist de UI

- Hecho y verificado: sin emoji (solo lucide), tokens de color, estados con icono + texto (sobrante, faltante, cuadrada; ingreso, retiro), tabs con roles ARIA, labels visibles, 1024 px y 1920 px, 0 errores de consola, claro.
- Táctil: botones de movimiento y "Ver detalle" a 48 px (el botón "Ver detalle" se subió de 44 a 48 px tras la revisión; no se volvió a capturar).
- No verificado en navegador: modo oscuro y `prefers-reduced-motion` (el navegador de pruebas se colgó por falta de RAM). Los componentes usan solo tokens, y el app aplica el oscuro con la clase `.dark`; falta una pasada visual.

## Pendientes, supuestos y riesgos

- `Dialog` propio (`components/ui/dialog.tsx`, fuera de alcance) no atrapa ni mueve el foco al abrir; el foco queda en el botón disparador. Mejora recomendada.
- Filtro de fecha del historial con límites fijos de 05:00 Bogotá (Colombia sin DST). Si se añade `fecha_operativa` a `sesion_caja`, conviene usarla.
- Test de venta en efectivo dentro del cierre se cubrió por el recorrido manual; el test automático de RN-47 cubre apertura, ingresos y retiros.
- Pagos mixtos y otros pendientes de caja siguen fuera de alcance.
