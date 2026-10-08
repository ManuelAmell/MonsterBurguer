# Plan de Cierre MVP MonsterBurguer POS: Pagos Mixtos, E2E y Entregables UdeC

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar las features pendientes del MVP (Feature E: Pagos Mixtos y UX POS; Feature F: Suite E2E Playwright), cerrar los marcadores de capturas en la documentación académica UdeC, e integrar todo en la rama `main` cumpliendo con la orquestación supervisada de Orca.

**Architecture:** Monorepo TypeScript (NestJS 12 + Drizzle ORM + PostgreSQL 17/18 en `apps/api`, React 19 + Vite 8 + Tailwind v4 + shadcn/ui en `apps/web`, `@mb/shared` para contratos Zod y lógica de dominio). Orquestación modular por ramas en worktrees dedicados (`.worktrees/feat-ux` y `.worktrees/feat-qa`), coordinados mediante el CLI de Orca (`orca orchestration`).

**Tech Stack:** TypeScript 5.8, NestJS 12, Drizzle ORM, PostgreSQL 17/18, React 19, Vite 8, Tailwind CSS v4, Playwright, Vitest, python-docx, Orca CLI.

**Spec:** [CLAUDE.md](file:///C:/Users/manue/Documents/PersonalProjects/MonsterBurguer/CLAUDE.md), [ARCHITECTURE.md](file:///C:/Users/manue/Documents/PersonalProjects/MonsterBurguer/ARCHITECTURE.md), [docs/ROADMAP.md](file:///C:/Users/manue/Documents/PersonalProjects/MonsterBurguer/docs/ROADMAP.md), [docs/BUSINESS_RULES.md](file:///C:/Users/manue/Documents/PersonalProjects/MonsterBurguer/docs/BUSINESS_RULES.md).

---

## Global Constraints

- **Moneda:** Enteros en pesos COP únicamente, operaciones financieras exclusivamente a través de `@mb/shared/money.ts`.
- **Fronteras:** Cada módulo solo expone su fachada `*.public.ts` y solo consulta sus propias tablas.
- **Validación:** Esquemas Zod centralizados en `packages/shared/src/schemas`.
- **UI:** Cumplimiento estricto de [DESIGN.md](file:///C:/Users/manue/Documents/PersonalProjects/MonsterBurguer/DESIGN.md) y `/ui-ux-pro-max`: tokens semánticos (sin hex crudo), iconos de `lucide-react`, área táctil ≥ 48 px, textos en `apps/web/src/i18n/es.ts`.
- **Entornos aislados:** BDs y puertos independientes por worktree (UX: `mb_ux`, puertos 3061/5231; QA: `mb_qa_final`, puertos 3062/5232). Nunca usar los puertos 3000/5173 ni la base principal `monsterburguer`.
- **Memoria:** `NODE_OPTIONS="--max-old-space-size=1024"` debido a los 7 GB de RAM del equipo; un solo proceso pesado a la vez.

---

## Estado Actual de las Tareas

| Módulo / Tarea | Estado | Worktree / Rama | Siguiente Acción |
|---|---|---|---|
| **Hito 0 a 4 (Core POS, KDS, Caja, Catálogo)** | ✅ Completado | `main` | Base estable |
| **Feature A (Caja Completa - RN-46, RN-47)** | ✅ Merged | `feat/caja-completa` → `main` | Integrado |
| **Feature B (Admin Usuarios & Config)** | ✅ Merged | `feat/admin-usuarios-config` → `main` | Integrado |
| **Feature C (Anular y Deshacer - RN-22, RN-35, RN-50)** | ✅ Merged | `feat/anular-deshacer` → `main` | Integrado |
| **Feature D (Reportes analíticos y Alertas)** | ✅ Merged | `feat/reportes-alertas` → `main` | Integrado |
| **Documentación Académica UdeC** | ✅ Completada | `main` | Capturas reales e información UdeC integradas |
| **Feature E (Pagos Mixtos y UX POS)** | ✅ Merged | `feat/ux-pos-pagos-mixtos` → `main` | Integrado (`bd0cc73`) |
| **Feature F (Playwright E2E y Regresión)** | ✅ Merged | `feat/qa-e2e` → `main` | Integrado (`4290740`) |
| **Operación / Ops (Backup script)** | ✅ Completado | `main` (`ops/backup.sh`) | `ops/backup.sh` y `docs/OPERACION.md` |

---

## Tareas Detalladas de Implementación

### Tarea 1: Finalizar Feature E · Pagos Mixtos y Corrección de Vistas (Backend)

**Archivos:**
- Modificar: `apps/api/src/modules/caja/caja.service.ts`
- Modificar: `apps/api/src/modules/caja/caja.repository.ts`
- Modificar: `apps/api/drizzle/meta/_journal.json`
- Crear: `apps/api/drizzle/0007_reporte_metodo_pagos.sql`
- Test: `apps/api/test/caja.spec.ts`

**Interfaces:**
- Consume: `CobroInput` desde `packages/shared/src/schemas/caja.ts` permitiendo array de 1 a 3 pagos.
- Produce: Registro de cobro con desglose de pagos por método (`pago`), cálculo de cambio solo contra `EFECTIVO` (máximo 1 pago en efectivo), y vista `v_reporte_ventas_metodo` ajustada sin duplicar totales.

- [x] **Paso 1.1: Sincronizar rama `feat/ux-pos-pagos-mixtos` con los últimos cambios de `main`**
  Ejecutar en `.worktrees/feat-ux`: `git merge main` para incorporar los merges recientes de reportes y anulación.
- [x] **Paso 1.2: Validar la lógica transaccional de pagos mixtos en `caja.service.ts`**
  Asegurar que la suma de `pagos[].monto` sea idéntica a `total + propina` (RN-43). Validar unicidad de métodos (`Set(pagos.map(p => p.metodo)).size === pagos.length`) y máximo un pago en efectivo.
- [x] **Paso 1.3: Aplicar y verificar migración `0007_reporte_metodo_pagos.sql`**
  Ejecutar `pnpm db:migrate` en `.worktrees/feat-ux` contra `mb_ux`. Verificar que la vista calcula `propina_asignada` y `monto_venta` de forma proporcional por método sin duplicar pedidos ni montos.
- [x] **Paso 1.4: Implementar tests de integración para pagos mixtos**
  Añadir en `apps/api/test/caja.spec.ts`:
  - Test `it('RN-42: liquida pedido con pago mixto EFECTIVO + TARJETA', ...)`
  - Test `it('RN-43: rechaza cobro si la suma no coincide con total + propina', ...)`
  - Test `it('RN-43: rechaza cobro con más de un pago en EFECTIVO', ...)`
- [x] **Paso 1.5: Ejecutar suite de tests del backend en worktree UX**
  Correr `pnpm --filter api test` y verificar 100% verde.

---

### Tarea 2: Keyset Pagination en Inventario y Backend (Feature E)

**Archivos:**
- Modificar: `apps/api/src/modules/inventario/inventario.repository.ts`
- Modificar: `packages/shared/src/schemas/inventario.ts`
- Test: `apps/api/test/inventario.spec.ts`

**Interfaces:**
- Consume: Parámetro `cursor` codificado en base64 `{"nombre": string, "id": string}`.
- Produces: Listado de ingredientes ordenado estrictamente por `nombre ASC, id ASC` con condición `(nombre > :nombre) OR (nombre = :nombre AND id > :id)`.

- [x] **Paso 2.1: Modificar la consulta de ingredientes en `inventario.repository.ts`**
  Reemplazar la condición `lt(ingrediente.id, cursor)` por comparación lexicográfica compuesta `(nombre, id)`.
- [x] **Paso 2.2: Test de integración con >100 ingredientes**
  Crear test en `apps/api/test/inventario.spec.ts` que inserte 150 ingredientes y recorra todas las páginas validando orden estricto y sin elementos duplicados ni omitidos.

---

### Tarea 3: UX del POS, Diálogo de Cobro Mixto y Accesibilidad (Frontend - Feature E)

**Archivos:**
- Modificar: `apps/web/src/features/pos/cobro-dialog.tsx`
- Modificar: `apps/web/src/features/pos/pos-page.tsx`
- Modificar: `apps/web/src/components/ui/dialog.tsx`
- Modificar: `apps/web/src/features/admin/inventario-page.tsx`
- Modificar: `apps/web/src/i18n/es.ts`

**Interfaces:**
- UI `CobroDialog`: Interfaz dinámica con botón "Agregar método", selector de método no repetido, desglose visual de saldo pendiente, y atajo "Resto en...".
- Buscador POS: Input con debounce (200ms) accesible con atajo `/`.
- `Dialog`: Componente accesible con `focus-trap` nativo (atrapa Tab/Shift+Tab, cierra con Esc y restaura el foco original).
- Inventario: Botón "Cargar más" que consume el siguiente cursor de la API.

- [x] **Paso 3.1: Implementar `focus-trap` y accesibilidad en `dialog.tsx`**
  Añadir lógica nativa en `apps/web/src/components/ui/dialog.tsx` para ciclar el foco dentro de los elementos interactivos del modal y devolver el foco al disparador al cerrar.
- [x] **Paso 3.2: Rediseñar `CobroDialog` para pagos múltiples**
  Permitir hasta 3 métodos (Efectivo, Tarjeta, Transferencia), calcular el saldo restante en vivo, habilitar teclado numérico táctil sobre la línea activa, y validar antes de enviar.
- [x] **Paso 3.3: Implementar buscador de productos en POS**
  Añadir input de búsqueda rápida con atajo `/` (sin disparar si el foco ya está en otro input) y debounce de 200ms.
- [x] **Paso 3.4: Añadir botón "Cargar más" en `/admin/inventario`**
  Integrar consumo de cursor en la pantalla de inventario administrativo.
- [x] **Paso 3.5: Verificación de frontend**
  Ejecutar `pnpm --filter web typecheck`, `pnpm --filter web lint` y `pnpm --filter web build`.
- [x] **Paso 3.6: Reporte y Merge de Feature E**
  Generar `docs/verificacion/feat-ux.md`, commitear en `feat/ux-pos-pagos-mixtos` y mergear a `main`.

---

### Tarea 4: Finalizar Feature F · E2E Playwright y QA de Regresión

**Archivos:**
- Crear: `apps/web/e2e/anular.spec.ts`
- Revisar: `apps/web/e2e/auth.spec.ts`, `caja.spec.ts`, `stock.spec.ts`, `venta-llevar.spec.ts`, `venta-mesa.spec.ts`, `admin.spec.ts`
- Modificar: `docs/DESARROLLO.md`
- Crear: `docs/verificacion/feat-qa.md`

**Interfaces:**
- Suite E2E ejecutada con `pnpm --filter web test:e2e` contra el servidor dedicado (API :3062, Web :5232, BD `mb_qa_final`).

- [x] **Paso 4.1: Sincronizar rama `feat/qa-e2e` con `main`**
  Ejecutar `git merge main` en `.worktrees/feat-qa`.
- [x] **Paso 4.2: Implementar `anular.spec.ts`**
  Cubrir el flujo completo de:
  - Creación de pedido y envío a cocina.
  - Anulación por parte de administrador con motivo válido (RN-50).
  - Reversión automática de stock y liberación de mesa.
  - Botón "Deshacer" en KDS dentro de 10 segundos (RN-22).
- [x] **Paso 4.3: Ejecutar la suite completa de Playwright**
  Correr `pnpm --filter web test:e2e` asegurando que todos los specs pasen consistentemente dos veces consecutivas.
- [x] **Paso 4.4: Documentar reporte y mergear Feature F**
  Generar `docs/verificacion/feat-qa.md` con matriz de resultados y tiempos, commitear y mergear `feat/qa-e2e` a `main`.

---

### Tarea 5: Completar Marcadores y Capturas en Documentación Académica UdeC

**Archivos:**
- Modificar: `docs/entregables-isoft/fuentes/Manual_de_Usuario_MonsterBurguer.md`
- Modificar: `docs/entregables-isoft/Manual de Usuario - MonsterBurguer.docx`
- Modificar: `docs/entregables-isoft/fuentes/Informe_de_Proyecto_MonsterBurguer.md`
- Modificar: `docs/entregables-isoft/Informe de Proyecto - MonsterBurguer.docx`
- Modificar: `docs/entregables-isoft/REPORTE.md`

- [x] **Paso 5.1: Tomar capturas reales de la aplicación web**
  Levantar API y Web en entorno local y capturar mediante Chrome DevTools MCP las 13 pantallas requeridas:
  1. `/login`
  2. Modal de apertura de caja
  3. POS principal con selector de tipo de pedido y categorías
  4. Cuadrícula de productos con producto agotado y ticket lateral
  5. Modal de pedidos activos y monitor de mesas
  6. Diálogo de cobro mixto con teclado numérico
  7. Formato de recibo impreso 80 mm
  8. Formulario de movimiento manual de caja (ingreso/retiro)
  9. Pantalla de cierre de caja con arqueo ciego
  10. KDS de cocina con tarjetas en estados Pendiente, Preparación y Lista
  11. Dashboard administrativo con KPIs
  12. Administración de productos y recetas
  13. Kardex de inventario con movimientos
- [x] **Paso 5.2: Insertar imágenes en el Manual de Usuario `.docx`**
  Ejecutar script de compilación para sustituir los marcadores `[CAPTURA]` por las imágenes PNG centradas.
- [x] **Paso 5.3: Completar marcadores `[COMPLETAR]` con datos reales del autor**
  Llenar nombre del estudiante (Manuel Francisco Amell Gil) y datos institucionales en las portadas.

---

### Tarea 6: Script de Backup y Cierre del Hito 6

**Archivos:**
- Crear: `ops/backup.sh`
- Modificar: `docs/OPERACION.md`
- Modificar: `docs/ROADMAP.md`

- [x] **Paso 6.1: Crear script `ops/backup.sh`**
  Script con `pg_dump` con compresión gzip, retención rotativa y prueba de restauración automatizada en base temporal.
- [x] **Paso 6.2: Actualizar `docs/ROADMAP.md`**
  Marcar Hito 6 como 100% completado.
- [x] **Paso 6.3: Limpieza de ramas y worktrees temporales**
  Eliminar worktrees de features integradas (`feat-pedidos`, `feat-reportes`, `feat-caja`, `feat-admin`, `feat-ux`, `feat-qa`).
