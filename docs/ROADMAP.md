# Roadmap del Proyecto — MonsterBurguer POS

> **Seguimiento del estado de desarrollo por hito y backlog técnico.**  
> Refleja el estado real del código implementado en el repositorio (rama `main`), documentando lo completado, lo parcial y los pendientes identificados.

---

## 1. Estado Actual de los Hitos del MVP

### Hito 0 — Fundaciones Arquitecturales
**Objetivo:** Monorepo, persistencia, bus de eventos, seguridad base y puesta en marcha.  
**Estado:** ✅ **Completado**
- [x] Monorepo con `pnpm workspaces`: `apps/api`, `apps/web`, `packages/shared`; TypeScript estricto, ESLint, Prettier.
- [x] Contenedor de base de datos `docker-compose.yml` con PostgreSQL y archivo `.env.example`.
- [x] NestJS base con configuración Zod (`env.ts`), logger estructurado Pino, filtro global de excepciones y endpoint `/api/v1/health`.
- [x] Drizzle ORM: cliente relacional, helper transaccional y migraciones SQL versionadas (`0000_inicial.sql`).
- [x] `EventBus` (`apps/api/src/shared-kernel/events`): `publicarEnTx`, `alPublicarEnTx`, `despuesDeCommit` y `OutboxDispatcher` con `LISTEN/NOTIFY` sobre `evento_sistema`.
- [x] Módulo `identidad`: login con rate limiting (5 req/min), logout, me, guards de sesión y roles, argon2id y seed inicial (`admin`).
- [x] Paquete `@mb/shared`: utilidades de dinero (`money.ts`), fecha operativa (`fecha-operativa.ts`), enums y esquemas Zod compartidos con 99 tests unitarios.
- [x] Frontend base: React 19 + Vite 8 + Tailwind v4 + shadcn/ui con tokens de diseño, router por rol y pantalla de login.
- [x] Base de datos de test (`DATABASE_URL_TEST`) y tests de integración en `apps/api/test/auth.spec.ts`.
- [x] Fronteras modulares verificadas con `dependency-cruiser` (`pnpm depcruise`).

---

### Hito 1 — Catálogo e Inventario
**Objetivo:** Gestión de ingredientes, recetas por producto, stock y kardex auditable.  
**Estado:** ✅ **Completado (con CRUD de categorías diferido en UI)**
- [x] Migración de base de datos `0001_hito1_catalogo_inventario.sql` (`categoria`, `producto`, `receta_item`, `ingrediente`, `movimiento_inventario`).
- [x] API de catálogo: categorías, productos con receta y override de agotado manual (`PUT /productos/:id/agotado`).
- [x] Endpoint POS de menú: `GET /api/v1/catalogo/menu` con categorías activas y productos con flag `agotado`.
- [x] API de inventario: ingredientes, entradas (`/inventario/entradas`), ajustes físicos (`/inventario/ajustes`), mermas (`/inventario/mermas`) y kardex paginado (`/ingredientes/:id/movimientos`).
- [x] Fachada pública `inventario.public.ts` con consumo atómico `consumir(tx, items, ...)` con bloqueo `SELECT ... FOR UPDATE` ordenado por ID (RN-32).
- [x] Pantallas de administración: `/admin/productos` (edición y recetas) y `/admin/inventario` (control de stock y acciones).
- [x] Datos semilla completos en `apps/api/src/db/seed.ts` con categorías, ingredientes, hamburguesas, acompañamientos y bebidas.
- [ ] *Pendiente menor:* Pantalla web dedicada para CRUD de categorías (actualmente gestionadas por API y seed).

---

### Hito 2 — Pedidos y Terminal POS
**Objetivo:** Toma de pedidos para mesa o llevar, ticket reactivo, confirmación atómica y reserva de stock.  
**Estado:** ✅ **Completado (con anulación de pedidos en backlog)**
- [x] Migración `0002_mesas_clientes.sql` (`mesa`, `cliente`) y `0003_hito2_4_pedidos_cocina_caja.sql` (`pedido`, `pedido_item`, `contador_dia`).
- [x] API de pedidos: creación (`POST /pedidos`), gestión de ítems (`/pedidos/:id/items`), confirmación (`POST /pedidos/:id/confirmar`) y mesas (`/mesas`).
- [x] Consecutivo diario por fecha operativa (`numero_dia`, RN-15 y RN-16) con reinicio automático diario.
- [x] Confirmación atómica: valida estado `ABIERTO` → descuenta inventario → crea comanda en cocina → cambia a `CONFIRMADO` → emite `PedidoConfirmado` al outbox.
- [x] Terminal POS web (`/pos`): rail de categorías, grilla táctil de productos, buscador con debounce, ticket en curso con stepper de cantidades, selector de mesa/llevar y diálogo de envío.
- [x] Indicador de mesas ocupadas en tiempo real para evitar asignaciones duplicadas (RN-11).
- [ ] *Pendiente conocido:* Endpoint y botón de anulación de pedidos (`POST /pedidos/:id/anular`, RN-50).

---

### Hito 3 — Cocina (KDS) en Tiempo Real
**Objetivo:** Pantalla KDS para personal de cocina, avance de estados y difusión SSE.  
**Estado:** ✅ **Completado (con reversión rápida en backlog)**
- [x] Migración de comanda y comanda_item en `0003_hito2_4_pedidos_cocina_caja.sql`.
- [x] Creación automática de comanda en estado `PENDIENTE` al confirmar pedidos en `pedidos.service.ts`.
- [x] Máquina de estados de cocina: `PENDIENTE` → `EN_PREPARACION` → `LISTA` → `ENTREGADA`.
- [x] Módulo `realtime`: endpoint SSE `GET /api/v1/stream` con filtrado por canales (`cocina`, `pos`, `admin`), reconexión con `Last-Event-ID` y búfer en memoria.
- [x] Pantalla KDS web (`/cocina`): tema oscuro nativo, columnas por estado, tarjetas legibles a distancia con ítems y notas culinarias resaltadas, temporizadores con umbrales de alerta (8 min warning, 12 min grave, RN-23).
- [x] Reactividad en frontend: hook `useEventStream` que invalida queries de TanStack Query al recibir eventos SSE.
- [ ] *Pendiente conocido:* Reversión de avance "Deshacer" dentro de los 10 segundos posteriores (RN-22).

---

### Hito 4 — Caja, Cobro y Liquidación
**Objetivo:** Apertura y cierre de sesión de caja, liquidación de cuenta, emisión de recibo y balance.  
**Estado:** ✅ **Completado (con pagos mixtos y movimientos manuales en backlog)**
- [x] Migración de `sesion_caja`, `recibo` (con secuencia global `recibo_numero_seq`) y `pago`.
- [x] Control de sesiones: apertura con monto base (`POST /caja/sesiones`), verificación de sesión única activa (RN-40) y cierre con arqueo (`POST /caja/sesiones/:id/cerrar`).
- [x] Cobro de pedidos: `POST /caja/cobros`. Si el pedido está en `ABIERTO`, lo confirma y cierra de forma atómica (RN-44); si está `CONFIRMADO`, valida y cierra.
- [x] Soporte de propina voluntaria en pedidos de mesa (RN-06), cálculo de cambio en efectivo y emisión de `recibo`.
- [x] Interfaz de cobro (`CobroDialog` en POS) con teclado numérico táctil (`NumericKeypad`), opciones de propina y cálculo de vueltas.
- [x] Recibo imprimible en formato térmico de 80 mm (`@media print`) con leyendas "Documento no fiscal" y "No responsable de INC" (RN-45).
- [x] Pantalla de caja (`/caja`): resumen del turno, ventas acumuladas en efectivo y diálogo de cierre con cálculo de sobrante/faltante.
- [ ] *Pendiente conocido:* Pagos mixtos (actualmente el cobro exige exactamente 1 método de pago en `caja.service.ts`).
- [x] Movimientos manuales de caja (`INGRESO` / `RETIRO`, RN-46), efectivo esperado con ingresos y retiros (RN-47) e historial de cierres con detalle (`GET /caja/sesiones`).

---

### Hito 5 — Administración y Retroalimentación
**Objetivo:** Dashboard gerencial, vistas SQL de reportes y retroalimentación reactiva de stock.  
**Estado:** 🟡 **Parcialmente Completado**
- [x] Vistas SQL en base de datos: `v_ventas_dia`, `v_ventas_producto`, `v_ventas_hora`, `v_tiempos_cocina`, `v_stock_alertas`, `v_productos_agotados`.
- [x] Endpoint `GET /api/v1/admin/dashboard` que agrega KPIs, ventas por hora, top productos, desempeño de cocina y alertas.
- [x] Endpoint `GET /api/v1/admin/eventos` para auditar la bitácora de eventos del sistema (`evento_sistema`).
- [x] Retroalimentación automática de stock: al agotarse un ingrediente, los productos que lo requieren se marcan `agotado = true` en base de datos y se notifica vía SSE al POS (RN-36).
- [x] Pantalla `/admin`: tarjetas de KPIs principales (ventas, pedidos, ticket promedio, tiempos KDS) y estado del inventario.
- [x] Pantalla de reportes analíticos con filtro por rango de fechas y exportación CSV (`/admin/reportes`, endpoints `GET /api/v1/admin/reportes/ventas`, `GET /api/v1/admin/reportes/ventas.csv` y alertas operativas `GET /api/v1/admin/alertas`).
- [ ] *Pendiente:* Interfaz web para visualizar la bitácora de eventos de `evento_sistema`.
- [ ] *Pendiente:* Interfaz web para editar parámetros de configuración (`/admin/configuracion`).

---

### Hito 6 — Endurecimiento y Preparación para Piloto
**Objetivo:** Pruebas E2E, imagen de despliegue en LAN, backups y estabilidad general.  
**Estado:** ✅ **Completado**
- [x] Dockerfile multicapa para API (`apps/api/Dockerfile`) y Nginx/Frontend (`apps/web/Dockerfile`).
- [x] Orquestación local con `docker-compose.yml` (Postgres, API, Nginx).
- [x] Scripts de migraciones y carga de datos semilla listos para puesta en marcha.
- [x] Suite de pruebas E2E con Playwright ("Venta completa": login → ticket → KDS → cobro → recibo) (7 specs, 13 tests, 100% verde).
- [x] Script de backup programado (`ops/backup.sh`) con `pg_dump` y prueba de restauración.
- [x] Auditoría formal de accesibilidad y trampa de foco en modales (`useFocusTrap`).

---

## 2. Backlog Técnico y Funcional Conocido

Lista de ítems técnicos y funcionales identificados que deben abordarse en las siguientes iteraciones:

1. **Anulación de Pedidos (`POST /pedidos/:id/anular` — RN-50 y RN-35)** (completado en `feat/anular-deshacer`):
   - Exponer endpoint en `pedidos.controller.ts` restringido a rol `ADMIN` con motivo de al menos 5 caracteres.
   - Conectar con `cocina.public.ts` para marcar la comanda `ANULADA` y con `inventario.public.ts` para emitir `REVERSION` (si la comanda estaba `PENDIENTE`) o `MERMA` (si ya estaba en cocina).
   - Agregar botón de anulación en el ticket del POS y diálogo de confirmación accesible.

2. **Pagos Mixtos en Cobro (RN-42 y RN-43)** (completado en `feat/ux-pos-pagos-mixtos`):
   - Soporte para 1 a 3 métodos de pago (`pagos.length` entre 1 y 3) en `caja.service.ts` y esquema Zod compartido.
   - Validación de métodos no repetidos y máximo 1 en efectivo con vuelto exacto (`recibido - monto`).
   - `CobroDialog` con hasta 3 líneas dinámicas, botones de atajo `Resto en [método]` y keypad numérico accesible.
   - Vista `v_reporte_ventas_metodo` (migración 0007) con distribución proporcional de propina y columna `cobrado`.
   - Arqueo de caja contando estrictamente las ventas en efectivo para el efectivo esperado (RN-47).

3. **Movimientos Manuales de Caja (RN-46)** (completado en `feat/caja-completa`):
   - Crear tabla `movimiento_caja` (`id`, `sesion_caja_id`, `tipo IN ('INGRESO', 'RETIRO')`, `monto`, `motivo`, `usuario_id`, `created_at`).
   - Implementar endpoints `POST /caja/sesiones/:id/movimientos`.
   - Incluir los ingresos y retiros en el cálculo del `efectivo_esperado` al cerrar caja (`montoApertura + ventasEfectivo + ingresos - retiros`).

4. **Gestión Administrativa de Categorías y Usuarios en Frontend** (completado en `feat/admin-usuarios-config`):
   - Pantalla en `/admin/categorias` para reordenar, activar/desactivar y crear categorías.
   - Módulo `/admin/usuarios` para crear cajeros y cocineros, cambiar contraseñas y desactivar cuentas (HU-02).
   - Módulo `/admin/configuracion` para editar parámetros del negocio (nombre, NIT, dirección, teléfono, IVA, propina).

5. **Paginación Robusta de Ingredientes (> 100 ítems)** (completado en `feat/ux-pos-pagos-mixtos`):
   - Cursor keyset compuesto `(nombre, id)` coherente con el ordenamiento alfabético (`nombre ASC, id ASC`) en `inventario.repository.ts`.
   - Cursor opaco serializado en base64 y probado con > 100 ingredientes deterministas sin duplicados.
   - Botón táctil accesible "Cargar más" con indicador de carga en `/admin/inventario`.

6. **Accesibilidad y Trampa de Foco en Diálogos Modales** (completado en `feat/ux-pos-pagos-mixtos`):
   - Implementación de `useFocusTrap` en `Dialog`, `AlertDialog` y `Sheet`:
     - Foco automático en el primer elemento interactivo o `initialFocus`.
     - Trampa cíclica con `Tab` y `Shift+Tab`.
     - Cierre inmediato con tecla `Escape`.
     - Restauración de foco al elemento disparador al cerrarse el diálogo.
     - Atributos accesibles `aria-modal="true"` y vinculación a `aria-labelledby`.

7. **Reportes Analíticos y Filtro por Fechas (Feature D — completado en `feat/reportes-alertas`):**
   - Endpoints `GET /api/v1/admin/reportes/ventas` y `GET /api/v1/admin/reportes/ventas.csv` con parámetros de rango (`desde`, `hasta`) y agrupación (`dia`, `producto`, `metodo`, `cajero`).
   - Pantalla analítica en frontend (`/admin/reportes`) con tarjetas KPI, gráfico de barras accesible en SVG nativo, tabla interactiva y descarga directa de CSV con BOM UTF-8 y delimitador `;`.
   - Endpoint `GET /api/v1/admin/alertas` y widget consolidado de alertas del sistema en el panel administrativo (`/admin`).

8. **Documento Equivalente Electrónico POS (DEE POS DIAN — v2.0):**
   - Integración con Proveedor Tecnológico autorizado por la DIAN para generar código CUDE, firma digital y código QR en el recibo.
   - Soporte de Factura Electrónica de Venta para clientes que la soliciten expresamente.
