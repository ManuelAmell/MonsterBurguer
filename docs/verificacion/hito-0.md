# Informe de Verificación — Hito 0: Fundaciones

**Fecha de verificación:** 2026-10-06  
**Rama evaluada:** `feat/mvp` (commit `05fceac`)  
**Worktree:** `C:\Users\manue\Documents\PersonalProjects\MonsterBurguer\.worktrees\feat-ci-tooling-docker`  
**Rol:** Verificador riguroso e independiente  
**Veredicto:** **RECHAZADO**

---

## 1. Resumen Ejecutivo

Se realizó una auditoría completa e independiente del Hito 0 (Fundaciones) entregado en la rama `feat/mvp`. La base arquitectural, la seguridad criptográfica (argon2id, tokens opacos hash SHA-256 en PostgreSQL, mitigación de timing attacks), el bus de eventos transaccional con outbox post-commit, el cálculo de dinero en enteros COP, y las fronteras de módulos con `dependency-cruiser` se encuentran sólidamente implementados y pasan todas las pruebas unitarias y de integración (10/10 en API, 9/9 en Shared).

No obstante, la verificación funcional de la interfaz web en un navegador real reveló un defecto funcional de severidad **MAYOR** en el ciclo de vida de la autenticación: al presionar el botón "Cerrar sesión" en la interfaz de usuario, la aplicación desincroniza la caché de TanStack Query y no redirige a `/login`, dejando una pantalla completamente en blanco en `AppShell` (`/admin`, `/pos`, `/caja`) o reteniendo la pantalla desprotegida en `/cocina`. Conforme a los criterios de aceptación donde no se admiten hallazgos Bloqueantes o Mayores, el Hito 0 queda **RECHAZADO** para corrección del builder.

---

## 2. Tabla de Comprobaciones

| # | Comprobación | Comando / Acción | Resultado | Evidencia resumida |
|---|---|---|:---:|---|
| 1.1 | Estado Git | `git status` | ✅ PASÓ | `On branch feat/mvp; nothing to commit, working tree clean`. |
| 1.2 | Rama y commits | `git log main..feat/mvp` | ✅ PASÓ | 2 commits por delante de base (`c427e7e`, `05fceac`). |
| 1.3 | Archivo `.env` no versionado | `git ls-files apps/api/.env` | ✅ PASÓ | Salida vacía. `git check-ignore` confirma que está ignorado por `.gitignore`. |
| 1.4 | Sin secretos en git diff | `git diff main...feat/mvp` | ✅ PASÓ | Solo documentación, reglas eslint y configs. Sin contraseñas ni secretos hardcodeados. |
| 2.1 | Linter monorepo | `pnpm lint` | ✅ PASÓ | `eslint .` completó con código 0 sin advertencias ni errores. |
| 2.2 | Fronteras entre módulos | `pnpm depcruise` | ✅ PASÓ | `✔ no dependency violations found (48 modules, 121 dependencies cruised)`. |
| 2.3 | Verificación de tipos TypeScript | `pnpm typecheck` | ✅ PASÓ | `tsc --noEmit` exitoso en `@mb/shared`, `apps/api` y `apps/web`. |
| 2.4 | Tests de integración API | `pnpm --filter api test` | ✅ PASÓ | 10 tests ejecutados y aprobados (0 skipped) en `apps/api/test/auth.spec.ts`. |
| 2.5 | Tests unitarios Shared | `pnpm --filter @mb/shared test` | ✅ PASÓ | 9 tests ejecutados y aprobados en `packages/shared/src/money.test.ts`. |
| 2.6 | Build de producción | `pnpm build` | ✅ PASÓ | Build exitoso en `@mb/shared` (tsc), `apps/api` (nest swc) y `apps/web` (vite). |
| 3.1 | Migraciones de base de datos | `pnpm --filter api db:migrate` | ✅ PASÓ | Drizzle-kit aplicó migraciones exitosamente en PostgreSQL. |
| 3.2 | Idempotencia del seed | `pnpm --filter api db:seed` (x2) | ✅ PASÓ | Dos ejecuciones consecutivas arrojaron `Seed listo: usuarios admin, caja1, cocina1` con código 0. |
| 3.3 | Endpoint de salud | `curl -s -i http://localhost:3000/api/v1/health` | ✅ PASÓ | HTTP 200 OK, `{"status":"ok","db":"ok"}`. |
| 3.4 | Login exitoso con curl | `POST /api/v1/auth/login` con admin/admin123 | ✅ PASÓ | HTTP 200 OK, entrega body `{usuario}` y cookie `mb_session`. |
| 3.5 | Banderas de Cookie de sesión | Inspección cabecera `Set-Cookie` | ✅ PASÓ | `HttpOnly; SameSite=Strict; Path=/; Max-Age=43200; Expires=...`. |
| 3.6 | Login con credenciales incorrectas | `POST /api/v1/auth/login` con clave errónea | ✅ PASÓ | HTTP 401 `CREDENCIALES_INVALIDAS: "Usuario o contraseña incorrectos."`. |
| 3.7 | Login con usuario inactivo | `POST /api/v1/auth/login` con usuario `inactivo` | ✅ PASÓ | HTTP 401 `CREDENCIALES_INVALIDAS: "Usuario o contraseña incorrectos."` (mismo mensaje genérico). |
| 3.8 | Validación de body con detalles | `POST /api/v1/auth/login` con `{"username":""}` | ✅ PASÓ | HTTP 400 `VALIDACION`, `detalles` con errores por campo para `username` y `password`. |
| 3.9 | Protección CSRF por Origin | `POST /api/v1/auth/login` con `Origin: http://evil.com` | ✅ PASÓ | HTTP 403 `ORIGEN_NO_PERMITIDO: "Origen no permitido."`. |
| 3.10 | Petición sin cookie a ruta protegida | `GET /api/v1/auth/me` sin cookie | ✅ PASÓ | HTTP 401 `NO_AUTENTICADO: "Debes iniciar sesión."`. |
| 3.11 | Invalidación de sesión por logout | `POST /api/v1/auth/logout` y posterior `GET /auth/me` | ✅ PASÓ | Logout responde 204 y expira cookie; posterior `GET /auth/me` responde 401. |
| 3.12 | Throttling de intentos de login | 6 intentos rápidos en `/api/v1/auth/login` | ✅ PASÓ | Del 1º al 5º procesados; el 6º responde HTTP 429 `DEMASIADOS_INTENTOS` con `Retry-After`. |
| 4.1 | Ausencia de `any` en código | Búsqueda estricta en `apps/` y `packages/` | ✅ PASÓ | 0 ocurrencias de `: any`, `as any` o `<any>`. Regla eslint activa como error. |
| 4.2 | Ausencia de `console.log` | Búsqueda estricta en código de aplicación | ✅ PASÓ | 0 llamadas en apps. Solo permitido `console.info`/`console.error` en `seed.ts`. |
| 4.3 | Dinero encapsulado | Auditoría de cálculos de moneda | ✅ PASÓ | Solo mediante `@mb/shared/money.ts`. Enteros exactos, half-up rounding, cero floats. |
| 4.4 | Formato uniforme de errores | `AllExceptionsFilter` | ✅ PASÓ | Todas las excepciones se traducen a `{ codigo, mensaje, detalles? }`. |
| 4.5 | Esquemas Zod no duplicados | Búsqueda de esquemas Zod | ✅ PASÓ | Esquemas compartidos centralizados en `packages/shared/src/schemas/`. |
| 4.6 | Cita de reglas `RN-xx` en tests | Inspección de suites de prueba | ✅ PASÓ | `money.test.ts` y `auth.spec.ts` nombran explícitamente `RN-01`, `RN-03`, `RN-04`, `RN-06`, `RN-60`. |
| 5.1 | Seguridad: hash contraseñas | Inspección `auth.service.ts` y BD | ✅ PASÓ | Hashes en formato `$argon2id$v=19$m=65536,p=4,t=3$...`. |
| 5.2 | Seguridad: token opaco en BD | Inspección tabla `sesion_usuario` | ✅ PASÓ | Tokens almacenados exclusivamente como hash SHA-256 hex (64 caracteres), nunca en plano. |
| 5.3 | Seguridad: mitigación timing attack | Inspección `AuthService.login` | ✅ PASÓ | `hashFicticio` verificado con argon2 ante usuario inexistente para tiempo constante. |
| 5.4 | Seguridad: expiración deslizante | Inspección `SesionGuard` | ✅ PASÓ | Reemite cookie extendida si pasaron más de 5 minutos desde el último uso. |
| 6.1 | EventBus y Outbox: registro | Verificación tabla `evento_sistema` | ✅ PASÓ | Evento `SesionIniciada` insertado en transacción y procesado (`procesado_at` no nulo). |
| 6.2 | EventBus: notificación transaccional | Inspección `event-bus.ts` | ✅ PASÓ | `pg_notify` ejecutado dentro de la transacción, entregado por Postgres únicamente en commit. |
| 6.3 | Outbox: resiliencia a fallos | Inspección `outbox.dispatcher.ts` | ✅ PASÓ | Bloque `try/catch` en dispatcher; fallo registra `intentos + 1` y `ultimo_error` sin abortar proceso. |
| 7.1 | UI: formulario de login | Navegación real en Chrome (CDP) | ✅ PASÓ | Errores junto al campo (`#username-error`, `#password-error`), `aria-invalid`, `role="alert"`. |
| 7.2 | UI: foco al error y toggle clave | Navegación real en Chrome (CDP) | ✅ PASÓ | Foco automático al campo inválido. Botón ojo alterna `type="password"` y `type="text"`. |
| 7.3 | UI: redirección por rol | Login con `admin`, `caja1`, `cocina1` | ✅ PASÓ | `admin` redirige a `/admin`, `caja1` a `/pos`, `cocina1` a `/cocina`. |
| 7.4 | UI: KDS cocina en tema oscuro | Login con `cocina1` en `/cocina` | ✅ PASÓ | `document.documentElement` añade clase `dark`; icono `ChefHat`. |
| 7.5 | UI: control de acceso 403 por rol | Usuario `caja1` navegando a `/admin` | ✅ PASÓ | Renderiza estado vacío 403 con icono `ShieldAlert` y botón "Volver al inicio". |
| 7.6 | UI: ruta 404 | Navegación a `/ruta-inexistente` | ✅ PASÓ | Renderiza componente 404 con icono `SearchX` y enlace al inicio. |
| 7.7 | UI: checklist `ui-ux-pro-max` | Inspección CSS, DOM y métricas | ✅ PASÓ | Sin emojis como iconos; 0 hex crudos fuera de `globals.css`; objetivos >= 48 px; contraste AA; sin scroll horizontal en 1024 y 1920 px; `prefers-reduced-motion` soportado. |
| 7.8 | UI: logout en interfaz de usuario | Clic en "Cerrar sesión" en `/admin` y `/cocina` | ❌ **FALLÓ** | La UI no navega a `/login`. En `/admin` queda pantalla en blanco; en `/cocina` permanece en el KDS (ver Hallazgo 1). |
| 8.1 | Coherencia documental | Comparación código vs ARCHITECTURE / DATA_MODEL | ✅ PASÓ | Stack alineado (NestJS 12, React 19, Vite 8, PG17/18, UUID v7 en app). ROADMAP marcado con honestidad. |

---

## 3. Hallazgos

### Hallazgo 1 (MAYOR) — Logout en la interfaz web no redirige a `/login`, causando pantalla en blanco o permanencia en vista desprotegida

- **Severidad:** **MAYOR**
- **Archivos y líneas:**
  - `apps/web/src/features/auth/session.ts:39-48`
  - `apps/web/src/app/app-shell.tsx:38-39, 80-86`
  - `apps/web/src/features/cocina/cocina-page.tsx:25`
  - `apps/web/src/features/auth/guards.tsx:20-26`
- **Descripción y causa raíz:**
  Al presionar el botón "Cerrar sesión", el hook `useLogout` ejecuta exitosamente la mutación HTTP `POST /auth/logout` (recibiendo 204 No Content y eliminando la cookie en el navegador). En el callback `onSettled`, se ejecuta:
  ```ts
  onSettled: () => {
    qc.clear();
    qc.setQueryData(sesionQuery.queryKey, null);
  }
  ```
  La invocación de `qc.clear()` en TanStack Query v5 purga todas las consultas y suscriptores de la caché. Como consecuencia:
  1. No se invoca ninguna llamada explícita de navegación hacia `/login` (`navigate('/login')`).
  2. El componente guard de ruta `<RequiereSesion />` queda desvinculado de la notificación reactiva y mantiene renderizado su `<Outlet />` previo.
  3. El componente `<AppShell />` se re-renderiza debido al observer de la mutación y evalúa `if (!usuario) return null;` (línea 38), desmontando toda la barra lateral y el contenido principal. Esto deja el DOM en `#root` completamente vacío (únicamente el contenedor de notificaciones de Sonner) y la URL del navegador retenida en `/admin` (o `/pos`, `/caja`).
  4. En la pantalla de cocina (`<CocinaPage />`), el componente no evalúa `if (!usuario) return null`, por lo que el usuario permanece en la pantalla `/cocina` viendo la interfaz de cocina incluso después de haber cerrado sesión.
- **Cómo reproducir:**
  1. Iniciar sesión como `admin` en `http://localhost:5174/login` (o en puerto 5173).
  2. El sistema redirige a `/admin`.
  3. Hacer clic en el botón "Cerrar sesión" en la parte inferior de la barra lateral.
  4. Observar el navegador: la pantalla queda completamente blanca, `#root` no contiene elementos visibles y la barra de direcciones permanece en `/admin`.
  5. Repetir iniciando sesión como `cocina1`: hacer clic en "Cerrar sesión"; la barra de direcciones permanece en `/cocina` y la vista KDS permanece visible.
- **Corrección sugerida:**
  1. En `apps/web/src/features/auth/session.ts`, realizar una redirección programática explícita hacia `/login` en el hook `useLogout` o mediante el router:
     ```ts
     export function useLogout() {
       const qc = useQueryClient();
       return useMutation({
         mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
         onSettled: () => {
           qc.clear();
           qc.setQueryData(sesionQuery.queryKey, null);
           window.location.replace('/login');
         },
       });
     }
     ```
  2. Alternativamente, en `AppShell` y `CocinaPage`, capturar la finalización del logout con `useNavigate()`:
     ```tsx
     const navigate = useNavigate();
     // ...
     onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) })}
     ```

---

## 4. Conclusión y Veredicto Final

El Hito 0 cuenta con una arquitectura de backend, modelo de datos y diseño estético de excelente calidad técnica y rigurosa adherencia a las especificaciones de `CLAUDE.md`, `ARCHITECTURE.md` y `DESIGN.md`.

Sin embargo, dado que el flujo de cierre de sesión en el frontend no cumple el comportamiento esperado y degrada la experiencia de usuario con una pantalla en blanco y fallas de navegación, el veredicto es **RECHAZADO**. Se requiere que el builder corrija el Hallazgo 1 antes de proceder al Hito 1.
