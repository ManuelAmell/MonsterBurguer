# Roadmap del MVP — MonsterBurguer POS

Cada hito termina con algo **demostrable** y sigue el recorrido del pedido del documento de Enfoque de Sistemas: cada hito agrega una flecha del diagrama.

**Definición de terminado (aplica a cada tarea):** tipado estricto sin errores · lint limpio · tests de la regla de negocio que toca (citando `RN-xx`) · UI revisada con `/ui-ux-pro-max` contra [DESIGN.md](../DESIGN.md) · documentación actualizada si cambió un contrato.

---

## Hito 0 — Fundaciones

Demo: `pnpm dev` levanta api + web; login funciona; CI en verde.

- [x] Monorepo pnpm: `apps/api`, `apps/web`, `packages/shared`; TS strict, ESLint, Prettier
- [x] `docker-compose.yml` con PostgreSQL (+ volumen) y `.env.example`
- [x] NestJS base: config validada con Zod, `nestjs-pino`, filtro de errores con formato único, health check `/api/v1/health`
- [x] Drizzle: cliente, helper de transacción, migración inicial (`usuario`, `sesion_usuario`, `configuracion`, `evento_sistema`)
- [x] `shared-kernel/events`: `EventBus` (`alPublicarEnTx`, `despuesDeCommit`), handlers en transacción y post-commit, dispatcher del outbox
- [x] Módulo `identidad`: login/logout/me, guard de sesión y de roles, throttling, seed `admin`
- [x] `@mb/shared`: `money.ts` con tests (RN-01..06, incluido el ejemplo de $49.700), `enums.ts`
- [x] Web: Vite 8 + Tailwind v4 + shadcn/ui con tokens de DESIGN §3 (claro/oscuro), fuentes, router por rol, layout con barra lateral, pantalla de login
- [x] Base de datos de test (`DATABASE_URL_TEST`) configurada + 10 tests de integración de autenticación (login, me, logout, throttling, roles)
- [x] dependency-cruiser con reglas de frontera entre módulos
- [x] GitHub Actions: lint → typecheck → test → build
- [ ] Ejecutar `/ui-ux-pro-max` con `--persist` para generar `design-system/MASTER.md` (requiere reparar la instalación de la skill, ver DESIGN §9)

## Hito 1 — Catálogo + Inventario

Demo: el admin crea el menú con recetas e ingredientes con stock.

- [ ] Migraciones: `categoria`, `producto`, `receta_item`, `ingrediente`, `movimiento_inventario`
- [ ] API catálogo (categorías, productos, receta, agotado manual) + `GET /catalogo/menu`
- [ ] API inventario: ingredientes, entradas, ajustes, mermas, kardex (RN-30, RN-34)
- [ ] `inventario.public.ts`: `consumir(tx, items)`, `revertir(tx, …)`, `registrarMerma(tx, …)` con `FOR UPDATE` ordenado (RN-32)
- [ ] Admin UI: categorías, productos con editor de receta, inventario con nivel de stock, kardex
- [ ] Seed de demo (PRD §7)

## Hito 2 — Pedidos (POS)

Demo: el cajero arma un ticket para mesa o para llevar y lo envía a cocina; el stock baja.

- [ ] Migraciones: `mesa`, `cliente`, `pedido`, `pedido_item`, `contador_dia`
- [ ] API pedidos: crear, ítems, confirmar (RN-10..17), anular (RN-50); índice de mesa ocupada
- [ ] Al confirmar: `PedidoConfirmado` → handler en transacción de inventario (consumo)
- [ ] Test de integración de **concurrencia**: dos confirmaciones compiten por el último stock → exactamente una gana
- [ ] POS UI: rail de categorías, grilla de productos, búsqueda, ticket con stepper/notas, selector mesa/llevar, enviar a cocina, errores de stock legibles
- [ ] Lista de pedidos activos

## Hito 3 — Cocina (KDS) en tiempo real

Demo: un pedido confirmado aparece en ≤ 2 s en la pantalla de cocina; al marcarlo listo el POS avisa.

- [ ] Migraciones: `comanda`, `comanda_item`
- [ ] Handler en transacción: `PedidoConfirmado` → crear comanda (RN-20); `PedidoAnulado` → anular + reversión/merma (RN-35)
- [ ] API comandas: iniciar, lista, entregar, deshacer (RN-21..23)
- [ ] Módulo `realtime`: SSE con canales por rol, heartbeat, `Last-Event-ID`
- [ ] Web: hook `useEventStream` que invalida queries; indicador "Reconectando…"
- [ ] KDS UI (tema oscuro, pantalla completa): columnas, temporizadores con umbrales, botón de avance, deshacer
- [ ] Toast en POS "Pedido #NNN listo"

## Hito 4 — Caja y cobro

Demo: turno completo: abrir caja, cobrar con pago mixto, imprimir recibo, cerrar caja con diferencia.

- [ ] Migraciones: `sesion_caja`, `movimiento_caja`, `recibo` (+ secuencia), `pago`
- [ ] API caja: abrir, movimientos, cobrar (RN-40..45, idempotente), cerrar (RN-47..48)
- [ ] Cobro de pedido `ABIERTO` = confirmar + cerrar en una transacción (RN-44)
- [ ] UI: abrir caja con teclado numérico, diálogo de cobro (métodos, recibido, cambio, propina), cierre con sobrante/faltante
- [ ] Recibo imprimible 80 mm (`@media print`) con leyenda "Documento no fiscal"

## Hito 5 — Administración y retroalimentación

Demo: el dashboard muestra ventas en vivo; al agotarse un ingrediente, sus productos se desactivan solos en el POS y aparece la alerta.

- [ ] Reglas post-commit: `StockBajoMinimo`, `IngredienteAgotado`/`Repuesto` → re-evaluar `producto.agotado` (RN-36)
- [ ] Vistas SQL de reportes (DATA_MODEL "Vistas")
- [ ] API: dashboard, alertas, reporte de ventas, bitácora de eventos, configuración
- [ ] UI: KPIs, ventas por hora, top 5, tiempos de cocina, alertas con acción, reportes por rango, bitácora de interacciones, configuración, usuarios
- [ ] Gráficos con leyenda, tooltip, tabla alternativa y estado vacío (DESIGN §7.6)

## Hito 6 — Endurecimiento y piloto

Demo: un turno de prueba completo con datos semilla, sin errores críticos.

- [ ] E2E Playwright: "venta completa" (login → ticket → KDS → cobro → recibo → cierre de caja) y "agotado automático"
- [ ] Revisión de seguridad (`/security-review`) y de accesibilidad (checklist de `/ui-ux-pro-max`)
- [ ] Prueba de carga ligera (10 usuarios concurrentes, p95 < 200 ms)
- [ ] Imagen de producción: `docker compose` con api + nginx/web + postgres, HTTPS con Caddy
- [ ] `ops/backup.sh` (`pg_dump` diario) + prueba de restauración
- [ ] Manual corto de usuario por rol (`docs/MANUAL.md`)
- [ ] Turno piloto y lista de ajustes → backlog v1.1 (PRD §4)
