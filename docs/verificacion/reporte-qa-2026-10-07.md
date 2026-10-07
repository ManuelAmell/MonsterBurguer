# Reporte consolidado de QA — MVP MonsterBurguer POS (2026-10-07)

Este reporte consolida tres verificaciones independientes. Las hicieron agentes Antigravity (agy) coordinados con Orca, en la run `run_c7eaf1704d96`:

| Informe | Alcance | Veredicto |
|---|---|---|
| [qa-backend.md](./qa-backend.md) | API REST: suite existente y 119 pruebas HTTP propias sobre 47 endpoints | **APROBADO CON OBSERVACIONES** |
| [qa-frontend.md](./qa-frontend.md) | UI end-to-end en Chrome real: 42 flujos con capturas, accesibilidad y diseño | **APROBADO CON OBSERVACIONES** |
| [docs-cambios.md](./docs-cambios.md) | Reestructuración de la documentación alineada con el código | Completado |

Cada agente usó su propia base de datos (`mb_qa_api`, `mb_qa_web`) y sus propios puertos (3021, 3022, 5192). No modificaron código. La base `monsterburguer` del usuario no se tocó. El orquestador validó cada entrega: archivos cambiados, enlaces y puertos liberados.

## Veredicto global: APROBADO CON OBSERVACIONES

El núcleo del MVP funciona. Se puede vender para llevar y en mesa, enviar a cocina en tiempo real, cobrar en efectivo con cambio y propina, imprimir el recibo no fiscal, abrir y cerrar caja con arqueo y administrar el catálogo y el inventario. Las reglas críticas se cumplen: dinero en enteros COP, stock atómico con rollback total, concurrencia, permisos por rol y SSE.

Un defecto bloquea la operación real en salón (MAY-01, más abajo). Hay que corregirlo antes de usar el sistema con mesas.

## Suite automatizada (verde)

| Comando | Resultado |
|---|---|
| `pnpm --filter @mb/shared test` | 125/125 OK |
| `pnpm --filter api test` (PostgreSQL real) | 71/71 OK |
| `pnpm typecheck` | 0 errores |
| `pnpm lint` | 0 errores |
| `pnpm depcruise` | 0 violaciones (107 módulos, 385 dependencias) |
| Consola del navegador (QA frontend) | 0 errores, 0 peticiones fallidas inesperadas |

## Hallazgos priorizados

### Bugs a corregir

| ID | Sev. | Hallazgo | Dónde | Arreglo propuesto |
|---|---|---|---|---|
| **MAY-01** | **MAYOR** | Un pedido de **mesa** enviado a cocina no se puede volver a abrir en el POS para cobrarlo. `enviarACocina()` reinicia el ticket y el selector solo muestra mesas libres. | `apps/web/src/features/pos/pos-page.tsx` | Mostrar las mesas ocupadas o los pedidos activos (el hook `usePedidosActivos()` ya existe) para abrirlos y cobrarlos. |
| **BE-01** | **MAYOR** | Un nombre duplicado de categoría, producto o ingrediente devuelve **500** en vez de **409 NOMBRE_DUPLICADO**. El código busca `"unique"` en `err.message`, pero Drizzle envuelve el error en `DrizzleQueryError`. | `catalogo.service.ts`, `inventario.service.ts` | Revisar `err.cause?.code === '23505'` (código de violación de unicidad de PostgreSQL). |
| MEN-01 | MENOR | El POS no permite poner una nota a un ítem ("sin cebolla"), aunque `TicketLine` ya tiene `onEditarNota` y el backend ya acepta la nota en el PATCH. | `pos-page.tsx` | Pasar `onEditarNota` y abrir un diálogo de nota de hasta 140 caracteres. |
| MEN-02 | MENOR | La protección CSRF deja pasar peticiones mutantes **sin** cabecera `Origin`. Los navegadores siempre la envían, así que solo afecta a scripts. | `OrigenGuard` | Exigir `Origin` o `Referer` en los métodos mutantes. |
| OBS-01 | Obs. | El recibo muestra "Mesa Mesa 2". | `features/pos/recibo.tsx` | Usar solo `mesa.nombre`. |
| OBS-02 | Obs. | Falta el buscador de productos con el atajo `/` que pide DESIGN.md §7.2. | `pos-page.tsx` | Backlog. |
| OBS-03 | Obs. | En cocina aparece "Sin conexión en vivo" unos 800 ms al conectar. | `use-event-stream.ts` | Agregar un estado "Conectando…". |

### Fuera del MVP (decisión de alcance, no bug)

Estos puntos se recortaron a propósito y ya figuran como pendientes en [ROADMAP.md](../ROADMAP.md):

- Pagos mixtos (RN-42).
- Anular pedidos (RN-50, RN-35).
- Deshacer en el KDS (RN-22).
- Ingresos y retiros de caja (RN-46).
- Historial de cierres.
- Alertas en admin (RN-17).
- Reportes por rango.
- Configuración.
- CRUD de usuarios.
- Trampa de foco en los diálogos.
- Paginación de ingredientes por encima de 100.
- DEE POS de la DIAN.

## Cobertura de reglas de negocio (backend)

Se cumplen RN-01 a 06, RN-10 a 16, RN-20, 21, 23, RN-30 a 34, 36, RN-40, 41, 43 a 45, 47 y 48. RN-17 está parcial. RN-22, 35, 42, 46 y 50 están fuera del MVP. Ver la tabla completa en [qa-backend.md §5](./qa-backend.md).

## Documentación

- La documentación se reestructuró según el código real:
  - [Índice](../README.md).
  - README.
  - ARCHITECTURE.md con C4 y secuencia en Mermaid.
  - 11 ADR en [docs/adr](../adr/README.md).
  - API.md y DATA_MODEL.md con correspondencia 1:1.
  - Estado de cada RN.
  - [OPERACION.md](../OPERACION.md) y [DESARROLLO.md](../DESARROLLO.md).
- Un subagente Sonnet revisó después los diagramas de ARCHITECTURE.md:
  - Corrigió 2 errores de sintaxis Mermaid (paréntesis sin comillas).
  - Corrigió varias infidelidades al código: el SSE directo desde cocina, dependencias que faltaban entre módulos y el orden de los guards.
  - Validó los 5 bloques con `mermaid.parse()`.
- CLAUDE.md suma la sección "Delegar a subagentes": prompts detallados sin supuestos, rendición de cuentas al orquestador y skills de ECC por tipo de tarea.

## Siguientes pasos recomendados

1. **P0:** corregir MAY-01 (cobro de mesas) y BE-01 (500 → 409). Agregar un test para cada uno.
2. **P1:** MEN-01 (notas por ítem), OBS-01 ("Mesa Mesa") y MEN-02 (Origin obligatorio).
3. **P2:** abordar el backlog del MVP según la prioridad del negocio. Lo más probable primero: pagos mixtos y anular pedidos.
