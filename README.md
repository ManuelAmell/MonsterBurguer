# MonsterBurguer POS

Sistema POS (Point of Sale) integral para restaurante: toma de pedidos, pantalla de cocina en tiempo real, inventario por recetas, caja/cobro y panel administrativo con retroalimentación.

Nace del documento académico [`Etapa1_Definicion_del_Sistema_Restaurante.docx`](./Etapa1_Definicion_del_Sistema_Restaurante.docx) (Enfoque de Sistemas): cada subsistema del documento es un módulo del código y cada interacción entre subsistemas es un evento de dominio trazable.

## Documentación

| Documento | Contenido |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Stack, módulos, eventos, estados, seguridad, decisiones |
| [DESIGN.md](./DESIGN.md) | Sistema de diseño UI/UX, pantallas y wireframes |
| [docs/PRD.md](./docs/PRD.md) | Alcance del MVP, roles, historias de usuario y criterios de aceptación |
| [docs/BUSINESS_RULES.md](./docs/BUSINESS_RULES.md) | Reglas de dinero, impuestos, inventario, caja y anulaciones |
| [docs/DATA_MODEL.md](./docs/DATA_MODEL.md) | Modelo de datos (ERD) y tablas |
| [docs/API.md](./docs/API.md) | Contrato REST + stream de eventos en tiempo real |
| [docs/ROADMAP.md](./docs/ROADMAP.md) | Hitos del MVP y tareas |
| [CLAUDE.md](./CLAUDE.md) | Reglas para agentes de IA que trabajen en el repo |

## Stack (resumen)

TypeScript de punta a punta.

- **Backend:** Node.js 24 LTS · NestJS 11 · Drizzle ORM · Zod
- **Base de datos:** PostgreSQL 18
- **Frontend:** React 19 · Vite · Tailwind CSS v4 · shadcn/ui · TanStack Query · Zustand · React Router
- **Compartido:** paquete `@mb/shared` (esquemas Zod, tipos, utilidades de dinero)
- **Tiempo real:** Server-Sent Events (SSE)
- **Diseño UI/UX:** skill `/ui-ux-pro-max` (ver [DESIGN.md](./DESIGN.md))
- **Tests:** Vitest · Testcontainers · Playwright
- **Infra:** pnpm workspaces · Docker Compose · GitHub Actions

## Estructura del repositorio (objetivo)

```
MonsterBurguer/
├── apps/
│   ├── api/            # NestJS (backend)
│   └── web/            # React + Vite (POS, cocina, admin)
├── packages/
│   └── shared/         # esquemas Zod, tipos, dinero
├── docs/               # PRD, reglas de negocio, datos, API, roadmap
├── docker-compose.yml  # postgres (+ api + web en producción)
├── pnpm-workspace.yaml
├── ARCHITECTURE.md
├── DESIGN.md
└── CLAUDE.md
```

## Arranque rápido (cuando exista el código — Hito 0)

```bash
pnpm install
docker compose up -d postgres
pnpm --filter api db:migrate && pnpm --filter api db:seed
pnpm dev                     # api :3000 + web :5173
```

Usuario semilla: `admin / admin123` (solo en entorno `development`).
