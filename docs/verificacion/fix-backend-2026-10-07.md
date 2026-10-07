# Reporte de Corrección Backend — BE-01 y MEN-02 (2026-10-07)

## 1. Resumen Ejecutivo
Se reprodujeron mediante TDD y corrigieron satisfactoriamente los dos defectos de backend reportados en la ronda de QA:
1. **BE-01 (Mayor):** Las violaciones de unicidad en nombres de categorías, productos e ingredientes (incluyendo índices funcionales con `lower(nombre)`) devolvían error 500 debido a la encapsulación de Drizzle ORM sobre el error de PostgreSQL. Se centralizó la detección del código SQLSTATE `'23505'` mediante una función utilitaria en `shared-kernel` y se corrigieron todas las apariciones en catálogo, inventario, clientes, pedidos y caja, respondiendo ahora HTTP 409 con código `NOMBRE_DUPLICADO`.
2. **MEN-02 (Menor - Seguridad):** `OrigenGuard` permitía peticiones mutantes sin cabecera `Origin`. Se ajustó el guard para requerir obligatoriamente `Origin` en métodos mutantes (`POST`, `PUT`, `PATCH`, `DELETE`) o, en su ausencia, una cabecera `Referer` cuyo origen (esquema + host + puerto) coincida con `APP_ORIGIN`, rechazando cualquier otra petición con HTTP 403 `ORIGEN_NO_PERMITIDO`.

---

## 2. Archivos Modificados
- `apps/api/src/shared-kernel/db/pg-error.ts`: Nueva utilidad con `codigoPg(err)` recursiva y `esViolacionUnicidad(err)` para detectar SQLSTATE '23505'.
- `apps/api/src/shared-kernel/db/db.ts`: Re-exportación de las utilidades de error de PostgreSQL desde el núcleo compartido de base de datos.
- `apps/api/src/modules/catalogo/catalogo.service.ts`: Reemplazo de `err.message.includes` por `esViolacionUnicidad(err)` en creación y edición de categorías y productos (4 apariciones).
- `apps/api/src/modules/inventario/inventario.service.ts`: Reemplazo de `err.message.includes` por `esViolacionUnicidad(err)` en creación y edición de ingredientes (2 apariciones).
- `apps/api/src/modules/clientes/clientes.service.ts`: Corrección del antipatrón de acceso directo a `err.code` por `esViolacionUnicidad(err)` ante inserciones concurrentes de clientes.
- `apps/api/src/modules/caja/caja.service.ts`: Eliminación de helper local duplicado y adopción de `esViolacionUnicidad(err)` en apertura de sesión de caja.
- `apps/api/src/modules/pedidos/pedidos.service.ts`: Eliminación de helper local duplicado y adopción de `esViolacionUnicidad(err)` en creación de pedido y mesa.
- `apps/api/src/modules/identidad/auth.guards.ts`: Validación estricta de métodos mutantes exigiendo `Origin` o `Referer` coincidente con `APP_ORIGIN` en `OrigenGuard`.
- `apps/api/test/catalogo-inventario.spec.ts`: Incorporación de 6 pruebas de integración reproductoras y validadoras para BE-01 (creación y renombrado de categorías, productos e ingredientes).
- `apps/api/test/auth.spec.ts`: Incorporación de 3 pruebas de integración para MEN-02 (rechazo sin Origin/Referer, rechazo con Referer ajeno y aceptación con Referer válido).
- `docs/API.md`: Documentación del código `NOMBRE_DUPLICADO` bajo HTTP 409 y actualización de la regla CSRF de `Origin`/`Referer` bajo HTTP 403.

---

## 3. Tests Añadidos
En `apps/api/test/catalogo-inventario.spec.ts`:
- `BE-01: nombre de categoría duplicado responde 409 NOMBRE_DUPLICADO al crear`
- `BE-01: nombre de categoría duplicado responde 409 NOMBRE_DUPLICADO al renombrar`
- `BE-01: nombre de producto duplicado responde 409 NOMBRE_DUPLICADO al crear` (cubre coincidencia exacta e insensible a mayúsculas vía `lower(nombre)`)
- `BE-01: nombre de producto duplicado responde 409 NOMBRE_DUPLICADO al renombrar`
- `BE-01: nombre de ingrediente duplicado responde 409 NOMBRE_DUPLICADO al crear`
- `BE-01: nombre de ingrediente duplicado responde 409 NOMBRE_DUPLICADO al renombrar`

En `apps/api/test/auth.spec.ts`:
- `MEN-02: rechaza peticiones mutantes sin Origin ni Referer con 403 ORIGEN_NO_PERMITIDO`
- `MEN-02: rechaza peticiones mutantes con Referer de otro origen con 403 ORIGEN_NO_PERMITIDO`
- `MEN-02: acepta peticiones mutantes con Referer cuyo origen coincide con APP_ORIGIN cuando falta Origin`

---

## 4. Resultados de Verificación

### 4.1. Pruebas Automatizadas de Integración
- **Comando:** `$env:DATABASE_URL_TEST="postgres://mb:mb_dev_pass@localhost:5432/mb_qa_api_test"; $env:NODE_OPTIONS="--max-old-space-size=1024"; pnpm --filter api test`
- **Resultado inicial (fase RED de TDD):** 10 tests fallidos (6 de BE-01 por 500 en vez de 409, 3 de MEN-02, 1 dependiente de límite de tasa), 70 tests pasados.
- **Resultado final (fase GREEN de TDD):** **80 tests pasados, 0 fallidos** en 6 archivos de prueba (duración: 42.71s).
  - `test/auth.spec.ts`: 13 passed
  - `test/catalogo-inventario.spec.ts`: 25 passed
  - `test/realtime.spec.ts`: 12 passed
  - `test/mesas.spec.ts`: 13 passed
  - `test/clientes.spec.ts`: 14 passed
  - `test/bufer-circular.spec.ts`: 3 passed

### 4.2. Chequeo de Tipos TypeScript
- **Comando:** `pnpm typecheck`
- **Resultado:** **0 errores**.
  - `packages/shared`: Done
  - `apps/web`: Done
  - `apps/api`: Done

### 4.3. Linter ESLint
- **Comando:** `pnpm lint`
- **Resultado:** **0 errores / 0 advertencias**.

### 4.4. Fronteras de Módulo (Dependency Cruiser)
- **Comando:** `pnpm depcruise`
- **Resultado:** **0 violaciones de dependencias** (108 módulos, 387 dependencias analizadas).

---

## 5. Lo que NO se hizo o quedó pendiente
- No se modificó código en `apps/web/**` ni en `packages/**` (alcance delimitado exclusivamente a backend `apps/api/**` y `docs/API.md`).
- No se alteró el manejo de métodos no mutantes (`GET`, `HEAD`, `OPTIONS`) en `OrigenGuard`, los cuales continúan sin requerir cabecera Origin.
- No se agregaron bypasses basados en `NODE_ENV === 'test'`.
- Los hallazgos fuera del alcance de este encargo (MAY-01 en frontend, MEN-01 en frontend, OBS-01 a OBS-03) permanecen a cargo de los agentes correspondientes según la asignación del orquestador.

---

## 6. Supuestos
- **Ninguno.** Todas las decisiones se apegaron estrictamente a los requerimientos de la tarea, a `CLAUDE.md`, a `ARCHITECTURE.md` y a la especificación en `docs/API.md`.

---

## 7. Riesgos
- Clientes HTTP externos o herramientas de script legacy (como curl o scripts sin navegador) que interactúen con endpoints mutantes deberán proveer explícitamente la cabecera `Origin` o `Referer` configurada a `APP_ORIGIN`, tal como exige el protocolo CSRF endurecido.
