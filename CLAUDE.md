# CLAUDE.md — MonsterBurguer POS

POS para restaurante (hamburguesería). Monorepo TypeScript: NestJS 12 + Drizzle + PostgreSQL (17 local / compatible PG 18) (backend), React 19 + Vite 8 + React Router 8 + Tailwind v4 + shadcn/ui (frontend), `@mb/shared` (Zod 4, tipos, dinero).

## Leer antes de trabajar

| Si vas a… | Lee |
|---|---|
| Tocar cualquier cosa | [ARCHITECTURE.md](./ARCHITECTURE.md) (módulos, eventos, fronteras) |
| Implementar una regla o caso de uso | [docs/BUSINESS_RULES.md](./docs/BUSINESS_RULES.md) — cita el `RN-xx` en tests y PR |
| Crear/cambiar tablas | [docs/DATA_MODEL.md](./docs/DATA_MODEL.md) |
| Crear/cambiar endpoints | [docs/API.md](./docs/API.md) |
| Cualquier UI | [DESIGN.md](./DESIGN.md) **+ skill `/ui-ux-pro-max`** |
| Saber qué sigue | [docs/ROADMAP.md](./docs/ROADMAP.md) y [docs/PRD.md](./docs/PRD.md) |

## UI: uso obligatorio de `/ui-ux-pro-max`

- **Toda** pantalla, componente o cambio visual se trabaja invocando la skill `/ui-ux-pro-max` (nombre exacto: `ui-ux-pro-max`).
- DESIGN.md es la fuente de verdad; `design-system/MASTER.md` y `design-system/pages/*.md` (generados por la skill con `--persist`) la complementan. Si hay conflicto, manda DESIGN.md.
- Antes de cerrar una tarea de UI: checklist de pre-entrega de la skill (contraste, foco, táctil ≥ 48 px, estados con icono + texto, `prefers-reduced-motion`, claro/oscuro, 1024 y 1920 px).
- Nada de emoji como icono (solo `lucide-react`), nada de hex crudo en componentes (solo tokens).

## Reglas de código

- **Fronteras de módulo:** un módulo solo importa de otro su `*.public.ts` y solo consulta sus propias tablas. `administracion` lee por vistas SQL.
- **Dinero** siempre entero en pesos COP; cálculos solo vía `@mb/shared/money.ts`. Nunca `float` para dinero.
- **Inventario** en enteros de unidad base (G, ML, UND). El stock solo cambia con un `movimiento_inventario`.
- **Transacciones:** casos de uso que cruzan módulos registran handlers explícitamente vía `EventBus.alPublicarEnTx` (en transacción) y `EventBus.despuesDeCommit` (post-commit para SSE, alertas y estadísticas).
- **Validación** con Zod de `@mb/shared/schemas` en front y back; no dupliques esquemas.
- **Idioma:** dominio en español (`Pedido`, `Comanda`, `confirmar()`), sufijos técnicos en inglés (`PedidosService`, `pedidos.controller.ts`). Tablas/columnas `snake_case`; JSON `camelCase`. Textos de UI en `apps/web/src/i18n/es.ts`.
- **Fechas** `timestamptz` UTC; mostrar en `America/Bogota`. Usar la "fecha operativa" (RN-16) para todo lo diario.
- Sin `any`; sin `console.log` (usar el logger pino; seed puede usar console.info).

## Comandos

```bash
pnpm install
pnpm --filter api db:migrate       # PostgreSQL 17 local o Docker
pnpm --filter api db:seed
pnpm dev                           # api :3000 + web :5173
pnpm test                          # unit + integración (contra DATABASE_URL_TEST en PostgreSQL)
pnpm --filter web test:e2e         # Playwright
pnpm lint && pnpm depcruise && pnpm typecheck
```

## Tests

- Toda regla `RN-xx` implementada tiene al menos un test que la nombra (`it('RN-33: rechaza confirmar sin stock', …)`).
- Casos de uso con BD → test de integración contra DATABASE_URL_TEST (PostgreSQL real, no mocks de BD).
- Golden path E2E: venta completa (ver ROADMAP Hito 6).

## Contexto académico

El proyecto parte de `Etapa1_Definicion_del_Sistema_Restaurante.docx` (Enfoque de Sistemas). Los módulos son los subsistemas de ese documento y `evento_sistema` registra sus interacciones; la retroalimentación (Administración → Productos/Inventario) es un requisito, no un extra.
