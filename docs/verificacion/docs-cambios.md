# Registro de Cambios y Verificación de Documentación — MonsterBurguer POS

- **Fecha:** 2026-10-07
- **Tarea:** Reestructuración, alineación y redacción de la documentación arquitectónica y técnica reflejando el código real del MVP.
- **Autor / Agente:** Worker de Documentación (Task `task_40d3498ea76a`, Dispatch `ctx_5167a9e5044c`).
- **Estado de Aceptación:** **COMPLETADO Y CONFORME**

---

## 1. Resumen Ejecutivo

Se completó una auditoría exhaustiva de toda la documentación previa del repositorio contrastándola directamente con el código fuente implementado en `apps/api/src`, `apps/web/src`, `packages/shared/src` y las migraciones relacionales de `apps/api/drizzle/`.

Se constató que la documentación inicial fue redactada de forma especulativa previa a la implementación, lo que generó divergencias sustanciales:
1. Endpoints descritos como activos que no existen en los controladores de NestJS.
2. Tablas del modelo de datos no implementadas en las migraciones de base de datos (`movimiento_caja`).
3. Vistas SQL presentes en migraciones omitidas en los documentos (`v_productos_agotados`).
4. Contradicciones arquitectónicas en el flujo de confirmación de pedidos (llamadas a servicios públicos con `tx` vs. handlers transaccionales de eventos).
5. Reglas de negocio catalogadas como completas cuando el código impone restricciones de alcance (ej. un solo pago por cobro en lugar de pagos mixtos).
6. Un roadmap desactualizado que marcaba como pendientes módulos ya construidos y testeados.

Toda la documentación ha sido reescrita, estructurada bajo estándares de arquitectura de software (Modelo C4 en Mermaid, registro formal de ADRs, contratos API 1:1, ERD fiel a Drizzle y guías de operación y desarrollo) y enlazada de forma bidireccional sin enlaces rotos.

---

## 2. Inventario de Archivos Creados y Modificados

### Archivos Modificados
| Archivo | Resumen de Cambios |
|---|---|
| `README.md` | Actualizado con qué incluye y qué NO incluye el MVP, puesta en marcha local paso a paso con PostgreSQL 17 local y rol `mb`, credenciales demo completas (`admin`, `caja1`, `cocina1`), tabla de comandos, árbol de directorios y enlaces. |
| `ARCHITECTURE.md` | Reestructurado con Modelo C4 (Contexto, Contenedores, Componentes) en Mermaid, detalle de monolito modular, reglas de dependencia estricta `*.public.ts`, bus de eventos con Outbox en `evento_sistema`, diagrama de secuencia exacto de una venta completa reflejando llamadas con `tx`, seguridad en profundidad y tabla de ADRs vinculada a archivos individuales. |
| `CLAUDE.md` | Enlaces actualizados con el nuevo mapa de documentación (`docs/README.md`, `OPERACION.md`, `DESARROLLO.md`, `adr/`), comandos verificados. |
| `docs/API.md` | Alineado 1:1 con los controladores reales de `apps/api/src/modules/`. Removidos endpoints ficticios (usuarios, anular pedidos, movimientos de caja, reportes avanzados), documentados métodos, rutas, roles, esquemas Zod de entrada/salida y códigos HTTP reales. Endpoints diferidos clasificados en sección de Backlog. |
| `docs/DATA_MODEL.md` | Alineado 1:1 con los esquemas de Drizzle y migraciones `0000..0003`. Removida la tabla inexistente `movimiento_caja`, incorporada la vista SQL `v_productos_agotados`, y actualizado el diagrama ERD Mermaid. |
| `docs/BUSINESS_RULES.md` | Cada regla de negocio (`RN-01` a `RN-61`) cuenta ahora con su estado explícito (**Implementada**, **Parcial** o **Pendiente**) y la cita exacta del archivo y función que la valida o implementa en el código. |
| `docs/ROADMAP.md` | Actualizado el estado real de los Hitos 0 a 6 reflejando el MVP construido. Sección detallada de pendientes y backlog técnico conocido. |

### Archivos Nuevos Creados
| Archivo | Propósito y Contenido |
|---|---|
| `docs/README.md` | **Índice maestro de la documentación.** Organiza todo el compendio documental por categorías, perfiles de lectura (arquitecto, desarrollador, frontend, operador, auditor) y enlaces relativos. |
| `docs/OPERACION.md` | **Guía de operación y despliegue.** Arquitectura de producción en LAN, puesta en marcha con Docker Compose, variables de entorno validadas con Zod (`env.ts`), ciclo de migraciones, estrategia de backups diarios con `pg_dump`/cron, restauración y guía de solución de problemas (troubleshooting). |
| `docs/DESARROLLO.md` | **Guía de desarrollo para ingenieros.** Convenciones de código (sin `any`, sin `console.log`, dominio en español), guías paso a paso para agregar módulos, endpoints, migraciones y pantallas, estrategia de pruebas (unitarias, integración en PostgreSQL real, front) y glosario formal del dominio. |
| `docs/adr/README.md` | Índice formal de Architectural Decision Records. |
| `docs/adr/0001-typescript-fullstack.md` | ADR-001: TypeScript Full-Stack (NestJS + React). |
| `docs/adr/0002-postgresql-como-base-de-datos.md` | ADR-002: PostgreSQL 17 (Dev Local) / Compatible PG 18 como Base de Datos. |
| `docs/adr/0003-drizzle-orm.md` | ADR-003: Drizzle ORM como Capa de Acceso a Datos. |
| `docs/adr/0004-monolito-modular.md` | ADR-004: Arquitectura de Monolito Modular. |
| `docs/adr/0005-eventos-de-dominio-con-outbox-en-postgresql.md` | ADR-005: Eventos de Dominio con Patrón Outbox en PostgreSQL (`evento_sistema`). |
| `docs/adr/0006-server-sent-events-sse.md` | ADR-006: Server-Sent Events (SSE) para Tiempo Real. |
| `docs/adr/0007-sesiones-opacas-en-base-de-datos-con-cookies-httponly.md` | ADR-007: Sesiones Opacas en Base de Datos con Cookies HttpOnly y Hashes Argon2id. |
| `docs/adr/0008-dinero-en-enteros-pesos-cop.md` | ADR-008: Manejo de Dinero en Enteros (Pesos Colombianos - COP). |
| `docs/adr/0009-cantidades-de-inventario-en-enteros-de-unidad-base.md` | ADR-009: Cantidades de Inventario en Enteros de Unidad Base (`G`, `ML`, `UND`). |
| `docs/adr/0010-spa-con-react-19-y-vite-8.md` | ADR-010: Frontend SPA con React 19, Vite 8 y React Router. |
| `docs/adr/0011-regimen-no-responsable-y-recibo-no-fiscal.md` | ADR-011: Régimen NO_RESPONSABLE Parametrizable y Recibo Interno No Fiscal. |
| `docs/verificacion/docs-cambios.md` | Este informe de cambios y verificación de coherencia. |

---

## 3. Matriz de Discrepancias Detectadas (Docs Antiguos vs. Código Real)

| # | Área | Documento Antiguo | Código Real Implementado | Resolución Adoptada |
|---|---|---|---|---|
| **1** | **API: Identidad** | Listaba `GET /usuarios`, `POST /usuarios`, `PATCH /usuarios/:id` como endpoints activos. | En `apps/api/src/modules/identidad/` solo existe `auth.controller.ts` (`login`, `logout`, `me`). No existe `usuarios.controller.ts`. | Eliminados de la tabla de endpoints activos de `API.md`. Documentados en la sección de backlog diferido para v1.1. |
| **2** | **API: Pedidos** | Listaba `POST /pedidos/:id/anular` con `{ motivo, version }`. | `pedidos.controller.ts` solo implementa `listar`, `crear`, `detalle`, `agregarItem`, `editarItem`, `quitarItem`, `confirmar`. No existe endpoint de anular. | Removido de endpoints activos de `API.md`. Regla RN-50 marcada como **Pendiente** en `BUSINESS_RULES.md` y priorizada en `ROADMAP.md`. |
| **3** | **API: Cocina** | Listaba `POST /comandas/:id/deshacer`. | `cocina.controller.ts` solo implementa `listar`, `iniciar`, `lista`, `entregar`. No existe endpoint de deshacer. | Removido de `API.md`. Regla RN-22 marcada como **Pendiente** en `BUSINESS_RULES.md` y documentada en `ROADMAP.md`. |
| **4** | **API: Caja** | Listaba `POST /caja/sesiones/:id/movimientos` (ingresos/retiros) y `GET /caja/sesiones` (historial). | `caja.controller.ts` solo implementa `sesion-actual`, `abrir`, `cerrar`, `cobrar` y `recibo`. No hay movimientos manuales ni historial de cierres. | Removidos de `API.md`. Regla RN-46 marcada como **Pendiente** en `BUSINESS_RULES.md` y documentada en `ROADMAP.md`. |
| **5** | **API: Admin** | Listaba `GET /admin/alertas`, `GET /admin/reportes/ventas` y `GET/PUT /admin/configuracion`. | `administracion.controller.ts` únicamente expone `GET /admin/dashboard` y `GET /admin/eventos`. | Alineado `API.md` con los 2 endpoints reales. Las alertas están anidadas dentro de la respuesta de `dashboard`. |
| **6** | **Base de Datos** | `DATA_MODEL.md` antiguo definía la tabla `movimiento_caja` (`id`, `sesion_caja_id`, `tipo`, `monto`, `motivo`, etc.). | `caja.schema.ts` y las migraciones `0000..0003` no contienen la tabla `movimiento_caja`. Los arqueos solo calculan `montoApertura + ventasEfectivo`. | Removida `movimiento_caja` del ERD Mermaid y de las tablas de `DATA_MODEL.md`. Agregada nota explicativa. |
| **7** | **Base de Datos** | No mencionaba la vista SQL `v_productos_agotados`. | La migración `0003_hito2_4_pedidos_cocina_caja.sql` crea expresamente la vista `v_productos_agotados`. | Agregada la vista `v_productos_agotados` a `DATA_MODEL.md` en la sección de vistas para reportes. |
| **8** | **Reglas: Cobro** | RN-42 afirmaba que los pagos mixtos estaban plenamente soportados en el cobro del MVP. | `caja.service.ts` línea 138 valida explícitamente `if (input.pagos.length !== 1)` arrojando error 400 Bad Request. | RN-42 clasificada como **Parcial** en `BUSINESS_RULES.md` y aclarada en `API.md`. |
| **9** | **Arquitectura** | `ARCHITECTURE.md` §5 afirmaba que el descuento de inventario se ejecutaba mediante handlers transaccionales de eventos (`alPublicarEnTx`). | En `pedidos.service.ts:confirmarBloqueado`, el servicio invoca directamente `inventario.consumir(tx, ...)` y `cocina.crearComanda(tx, ...)` pasando `tx`, para retornar 409 con detalles de faltantes y obtener `comandaId`. Luego publica `PedidoConfirmado` para el outbox post-commit. | Rediseñado el diagrama de secuencia en `ARCHITECTURE.md` y la descripción del flujo para reflejar con precisión el código. |
| **10**| **Credenciales** | `README.md` solo citaba `admin / admin123`. | `seed.ts` crea usuarios demo para cada rol: `admin/admin123` (ADMIN), `caja1/caja1234` (CAJERO), `cocina1/cocina1234` (COCINA). | Agregadas las credenciales completas de todos los roles a `README.md`. |
| **11**| **Roadmap** | `ROADMAP.md` mostraba Hito 0 completado y Hitos 1 a 6 con casillas vacías `[ ]`. | Gran parte de los hitos 1 a 4 ya está implementada y funcional tanto en backend como en frontend. | Marcado el estado real por hito (Hitos 0 a 4 completados con sus salvedades, Hito 5 parcial, Hito 6 en progreso) en `ROADMAP.md`. |

---

## 4. Verificación de Integridad y Enlaces

Se realizó una verificación estricta de resolución de hipervínculos relativos y existencia de archivos citados:
- **`docs/README.md`:** Resuelve todos los enlaces a `../ARCHITECTURE.md`, `../DESIGN.md`, `../CLAUDE.md`, `./PRD.md`, `./BUSINESS_RULES.md`, `./API.md`, `./DATA_MODEL.md`, `./ROADMAP.md`, `./OPERACION.md`, `./DESARROLLO.md`, `./adr/README.md`, `./critica/*` y `./verificacion/*`.
- **`README.md` (raíz):** Resuelve los enlaces hacia `docs/README.md`, `ARCHITECTURE.md`, `DESIGN.md`, `CLAUDE.md`, y los documentos de `docs/`.
- **`ARCHITECTURE.md`:** Resuelve los enlaces a cada uno de los 11 archivos ADR en `docs/adr/` (`0001-*.md` a `0011-*.md`) y a `docs/BUSINESS_RULES.md`.
- **`docs/adr/README.md`:** Resuelve los 11 enlaces hacia los archivos individuales de decisión y hacia `../../ARCHITECTURE.md`.
- **Archivos de QA:** Se verificó que los archivos `docs/verificacion/qa-backend.md` y `docs/verificacion/qa-frontend.md` **NO fueron modificados ni alterados**, cumpliendo estrictamente la directiva del coordinador.

---

## 5. Notas y Dudas para el Equipo de Desarrollo

1. **Endpoint de Anulación de Pedidos (`POST /pedidos/:id/anular`):**
   - El esquema Zod `anularPedidoSchema` ya existe en `packages/shared/src/schemas/pedidos.ts` y las columnas `anulado_at`, `anulado_por`, `motivo_anulacion` ya existen en la base de datos. Se sugiere priorizar en el siguiente ciclo la creación del método en `pedidos.controller.ts` para cerrar el ciclo completo de la regla RN-50.
2. **Habilitación de Pagos Mixtos:**
   - La base de datos ya soporta múltiples pagos por recibo (relación 1:N entre `recibo` y `pago`, con la única restricción de máximo un pago en efectivo). Habilitar pagos mixtos requiere únicamente remover la validación `pagos.length !== 1` en `caja.service.ts` y agregar la interfaz de múltiples filas en `CobroDialog`.
3. **Paginación en Inventario:**
   - En `inventario.repository.ts`, la consulta ordena por nombre de ingrediente pero el cursor evalúa el ID (`lt(ingrediente.id, cursor)`). Al superar 100 ingredientes, se recomienda paginar mediante `(nombre, id)` o migrar a paginación estándar por página/offset.
