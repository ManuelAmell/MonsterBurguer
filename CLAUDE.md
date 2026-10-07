# CLAUDE.md — MonsterBurguer POS

POS para restaurante (hamburguesería). Monorepo TypeScript: NestJS 12 + Drizzle + PostgreSQL (17 local / compatible PG 18) (backend), React 19 + Vite 8 + React Router 8 + Tailwind v4 + shadcn/ui (frontend), `@mb/shared` (Zod 4, tipos, dinero).

## Leer antes de trabajar

| Si vas a… | Lee |
|---|---|
| Tocar cualquier cosa | [ARCHITECTURE.md](./ARCHITECTURE.md) (módulos, eventos, fronteras) |
| Conocer el mapa de docs | [docs/README.md](./docs/README.md) (índice maestro) |
| Implementar una regla o caso de uso | [docs/BUSINESS_RULES.md](./docs/BUSINESS_RULES.md) — cita el `RN-xx` en tests y PR |
| Crear/cambiar tablas | [docs/DATA_MODEL.md](./docs/DATA_MODEL.md) |
| Crear/cambiar endpoints | [docs/API.md](./docs/API.md) |
| Guiarte en convenciones o agregar código | [docs/DESARROLLO.md](./docs/DESARROLLO.md) |
| Desplegar u operar en producción | [docs/OPERACION.md](./docs/OPERACION.md) |
| Consultar decisiones arquitectónicas | [docs/adr/README.md](./docs/adr/README.md) |
| Cualquier UI | [DESIGN.md](./DESIGN.md) **+ skill `/ui-ux-pro-max`** |
| Saber qué sigue | [docs/ROADMAP.md](./docs/ROADMAP.md) y [docs/PRD.md](./docs/PRD.md) |

## UI: uso obligatorio de `/ui-ux-pro-max`

- **Toda** pantalla, componente o cambio visual se trabaja invocando la skill `/ui-ux-pro-max` (nombre exacto: `ui-ux-pro-max`).
- DESIGN.md es la fuente de verdad; `design-system/MASTER.md` y `design-system/pages/*.md` (generados por la skill con `--persist`) la complementan. Si hay conflicto, manda DESIGN.md.
- Antes de cerrar una tarea de UI: checklist de pre-entrega de la skill (contraste, foco, táctil ≥ 48 px, estados con icono + texto, `prefers-reduced-motion`, claro/oscuro, 1024 y 1920 px).
- Nada de emoji como icono (solo `lucide-react`), nada de hex crudo en componentes (solo tokens semánticos).

## Reglas de código

- **Fronteras de módulo:** un módulo solo importa de otro su `*.public.ts` y solo consulta sus propias tablas. `administracion` lee por vistas SQL.
- **Dinero** siempre entero en pesos COP; cálculos solo vía `@mb/shared/money.ts`. Nunca `float` para dinero.
- **Inventario** en enteros de unidad base (G, ML, UND). El stock solo cambia con un `movimiento_inventario`.
- **Transacciones:** casos de uso que cruzan módulos registran handlers explícitamente vía `EventBus.alPublicarEnTx` (en transacción) y `EventBus.despuesDeCommit` (post-commit para SSE, alertas y estadísticas).
- **Validación** con Zod de `@mb/shared/schemas` en front y back; no dupliques esquemas.
- **Idioma:** dominio en español (`Pedido`, `Comanda`, `confirmar()`), sufijos técnicos en inglés (`PedidosService`, `pedidos.controller.ts`). Tablas/columnas `snake_case`; JSON `camelCase`. Textos de UI en `apps/web/src/i18n/es.ts`.
- **Fechas** `timestamptz` UTC; mostrar en `America/Bogota`. Usar la "fecha operativa" (RN-16) para todo lo diario.
- Sin `any`; sin `console.log` (usar el logger pino; seed puede usar console.info).

## Delegar a subagentes: instrucciones detalladas + skills de ECC

Quien orquesta (Claude principal) es responsable del resultado. Cada tarea que se delega a un subagente (Claude Sonnet/Opus vía Agent, o agy/Codex vía Orca) cumple esto:

### 0. Agente y modelo por defecto

- **Por defecto**, cada subagente orquestado es **agy (Antigravity) con el modelo `gemini-3.8-flash-high`** (Gemini 3.8 Flash, High), lanzado vía Orca:
  `orca orchestration worker-start --agent antigravity --model gemini-3.8-flash-high --spec "<tarea>" --worktree <...> --timeout-ms 240000 --json`
- Solo se usa otro agente, proveedor o modelo cuando el usuario lo indica explícitamente. Por ejemplo, "usa Sonnet" (Agent con `model: sonnet`) o "usa Codex". La indicación vale para esa tarea, no cambia el valor por defecto.
- Si `gemini-3.8-flash-high` no está disponible o agy agotó su cuota, se le informa al usuario y se le pregunta qué usar. No se cambia de modelo ni de agente por cuenta propia. Los modelos disponibles se listan con `agy models`.

### 1. Instrucciones detalladas: el subagente no asume nada

El prompt debe ser autosuficiente. El subagente no ve esta conversación. Incluye siempre:

- **Contexto:** qué es el proyecto, la rama o worktree y los archivos exactos en juego. Indica qué leer primero (este CLAUDE.md, ARCHITECTURE.md y la sección de docs que aplique).
- **Objetivo:** el resultado concreto esperado, paso a paso si hay más de uno.
- **Alcance:** qué archivos puede crear o editar y qué NO puede tocar (código de otros módulos, reportes de otros agentes, git commit/checkout/reset, `pnpm install`).
- **Entorno:** base de datos y puertos propios (nunca `monsterburguer`/`monsterburguer_test` ni 3000/5173 del usuario), `NODE_OPTIONS=--max-old-space-size=1024` y detener los servidores al terminar.
- **Reglas del repo que aplican:** RN-xx, fronteras de módulo, dinero en enteros, textos en `es.ts`, etc.
- **Criterio de aceptación verificable:** comando, test o evidencia que prueba que terminó.
- **Skills a cargar** (ver tabla).
- Esta instrucción literal: *"No asumas nada. Si algo es ambiguo, falta información o encuentras un conflicto con las reglas, DETENTE y pregunta al orquestador (Orca: `orchestration ask`; Agent: termina y repórtalo) en lugar de inventar o decidir por tu cuenta."*

### 2. Rendición de cuentas al orquestador

El subagente reporta al orquestador, no al usuario, y su reporte final incluye:

- Lo que hizo, con la lista de archivos modificados.
- Cómo lo verificó, con comandos y resultados reales. Si algo no se probó, lo dice.
- Lo que NO hizo o dejó pendiente, y los supuestos que tuvo que hacer (deberían ser cero).
- Problemas o riesgos encontrados.

En Orca: `worker_done` con `--outcome succeeded|failed`, más `--report-path` si hay informe. El orquestador **valida** cada entrega (diff, tests, enlaces, puertos liberados) antes de aceptarla e integrarla. Nunca la da por buena solo por el mensaje del subagente.

### 3. Skills de ECC según el tipo de tarea

En el prompt se incluye una línea: `Skills: <lista> — cárgalas y síguelas antes de empezar.`

- **Subagentes Claude:** invocan la skill `ecc:<nombre>` con la herramienta Skill.
- **agy/Codex:** no tienen las skills de Claude. Se les pasa la ruta para que la lean: `~/.claude/plugins/cache/ecc/ecc/<versión>/skills/<nombre>/SKILL.md` (versión actual: 2.2.3).

| Tarea | Skills ECC | Revisor ECC recomendado |
|---|---|---|
| Backend NestJS / endpoints | `nestjs-patterns`, `backend-patterns`, `api-design`, `error-handling` | `ecc:typescript-reviewer` |
| BD / migraciones Drizzle | `postgres-patterns`, `database-migrations` | `ecc:database-reviewer` |
| UI React | `react-patterns`, `vite-patterns`, `frontend-a11y` + **`ui-ux-pro-max`** (obligatoria) | `ecc:react-reviewer` |
| Tests / TDD | `tdd-workflow`, `react-testing`, `e2e-testing` | `ecc:tdd-guide`, `ecc:e2e-runner` |
| QA / verificación | `verification-loop`, `browser-qa` | `ecc:silent-failure-hunter` |
| Seguridad | `security-review` | `ecc:security-reviewer` |
| Documentación / ADR | `living-docs-governance`, `architecture-decision-records` | `ecc:doc-updater` |
| Docker / despliegue | `docker-patterns`, `deployment-patterns` | — |
| Siempre | `coding-standards` | — |

**Prioridad:** si una skill de ECC contradice este CLAUDE.md o DESIGN.md, mandan los documentos del proyecto. ECC es guía general y las reglas del repo tienen prioridad.

## Comandos

```bash
pnpm install
pnpm --filter api db:migrate       # PostgreSQL 17 local o Docker
pnpm --filter api db:seed          # Usuarios demo, catálogo e inventario
pnpm dev                           # api :3000 + web :5173
pnpm test                          # unit tests de @mb/shared
pnpm --filter api test             # integración (contra DATABASE_URL_TEST en PostgreSQL)
pnpm --filter web test:e2e         # Playwright
pnpm lint && pnpm depcruise && pnpm typecheck
```

## Tests

- Toda regla `RN-xx` implementada tiene al menos un test que la nombra (`it('RN-33: rechaza confirmar sin stock', …)`).
- Casos de uso con BD → test de integración contra DATABASE_URL_TEST (PostgreSQL real, no mocks de BD).
- Golden path E2E: venta completa (ver ROADMAP Hito 6).

## Contexto académico

El proyecto parte de `Etapa1_Definicion_del_Sistema_Restaurante.docx` (Enfoque de Sistemas). Los módulos son los subsistemas de ese documento y `evento_sistema` registra sus interacciones; la retroalimentación (Administración → Productos/Inventario) es un requisito, no un extra.
