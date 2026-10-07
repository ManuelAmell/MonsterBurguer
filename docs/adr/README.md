# Architectural Decision Records (ADR) — MonsterBurguer POS

Registro de decisiones arquitectónicas relevantes del proyecto MonsterBurguer POS. Cada ADR documenta el contexto, la decisión adoptada, las consecuencias técnicas y operativas, y su estado actual.

## Índice de Decisiones

| ID | Título | Estado | Fecha |
|---|---|:---:|---|
| [ADR-001](./0001-typescript-fullstack.md) | TypeScript Full-Stack (NestJS + React) | Aceptado | 2026-10-06 |
| [ADR-002](./0002-postgresql-como-base-de-datos.md) | PostgreSQL 17 (Dev Local) / Compatible PG 18 como Base de Datos | Aceptado | 2026-10-06 |
| [ADR-003](./0003-drizzle-orm.md) | Drizzle ORM como Capa de Acceso a Datos | Aceptado | 2026-10-06 |
| [ADR-004](./0004-monolito-modular.md) | Arquitectura de Monolito Modular | Aceptado | 2026-10-06 |
| [ADR-005](./0005-eventos-de-dominio-con-outbox-en-postgresql.md) | Eventos de Dominio con Patrón Outbox en PostgreSQL (`evento_sistema`) | Aceptado | 2026-10-06 |
| [ADR-006](./0006-server-sent-events-sse.md) | Server-Sent Events (SSE) para Tiempo Real | Aceptado | 2026-10-06 |
| [ADR-007](./0007-sesiones-opacas-en-base-de-datos-con-cookies-httponly.md) | Sesiones Opacas en Base de Datos con Cookies HttpOnly y Hashes Argon2id | Aceptado | 2026-10-06 |
| [ADR-008](./0008-dinero-en-enteros-pesos-cop.md) | Manejo de Dinero en Enteros (Pesos Colombianos - COP) | Aceptado | 2026-10-06 |
| [ADR-009](./0009-cantidades-de-inventario-en-enteros-de-unidad-base.md) | Cantidades de Inventario en Enteros de Unidad Base (`G`, `ML`, `UND`) | Aceptado | 2026-10-06 |
| [ADR-010](./0010-spa-con-react-19-y-vite-8.md) | Frontend SPA con React 19, Vite 8 y React Router | Aceptado | 2026-10-06 |
| [ADR-011](./0011-regimen-no-responsable-y-recibo-no-fiscal.md) | Régimen NO_RESPONSABLE Parametrizable y Recibo Interno No Fiscal | Aceptado | 2026-10-06 |

---
*Para más detalles sobre la arquitectura del sistema, consultar [ARCHITECTURE.md](../../ARCHITECTURE.md).*
