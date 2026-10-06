# Auditoría Crítica de Arquitectura y Seguridad — MonsterBurguer POS (MVP)

**Fecha:** 2026-10-06  
**Rol:** Crítico de Arquitectura y Seguridad  
**Alcance de Revisión:** `apps/api/src/**`, `apps/api/drizzle/**`, `packages/shared/src/**`, `apps/web/src/**`, configuración (`.dependency-cruiser.cjs`, `eslint.config.mjs`, `.github/workflows/ci.yml`, `docker-compose.yml`, `Dockerfiles`, `nginx.conf`) y coherencia con `ARCHITECTURE.md`, `DATA_MODEL.md`, `API.md` y `BUSINESS_RULES.md`.

---

## 1. Resumen Ejecutivo

Se realizó una revisión adversarial de solo lectura del código y la arquitectura del sistema **MonsterBurguer POS** (Hito 1 + contratos `@mb/shared`). El objetivo fue identificar vulnerabilidades de seguridad, defectos de diseño estructural, cuellos de botella de concurrencia y riesgos acumulativos que encarecerán o comprometerán los hitos subsiguientes (Hitos 2 a 5).

### Resumen de Hallazgos por Severidad

| Severidad | Defectos Actuales | Riesgos Futuros | Total |
|---|:---:|:---:|:---:|
| **CRÍTICA** | 5 | 1 | **6** |
| **ALTA** | 6 | 4 | **10** |
| **MEDIA** | 5 | 3 | **8** |
| **BAJA** | 2 | 0 | **2** |
| **TOTAL** | **18** | **8** | **26** |

### Conclusiones Principales

1. **Inoperatividad Inmediata en Despliegue (Bloqueador de Producción):** El archivo `docker-compose.yml` especifica la imagen inexistente `postgres:18-alpine` (Postgres 18 no tiene release oficial), lo que impide que el sistema arranque. Además, el contenedor de la API no aplica migraciones en su ciclo de vida y la cookie de sesión tiene la bandera `Secure` forzada en producción bajo un esquema HTTP expuesto en el puerto 80, lo que impedirá a los navegadores almacenar la cookie en una LAN sin TLS.
2. **Vulnerabilidades de Seguridad Activas:** Existe un bypass completo de la protección CSRF en `OrigenGuard` cuando la cabecera `Origin` está ausente (omisión de validación de `Referer`), ausencia total de cabeceras de seguridad HTTP (sin Helmet ni directivas en Nginx), y una configuración errónea de `trust proxy: 'loopback'` que colapsa el rate limiting de login, permitiendo que 5 intentos fallidos en una sola terminal bloqueen a todo el restaurante.
3. **Fragilidad Crítica del EventBus / Outbox:** El `OutboxDispatcher` adquiere una conexión permanente con `LISTEN` sobre un pool de solo 10 conexiones sin listeners de error en el socket (riesgo de caída fatal del proceso ante desconexiones de Postgres). Asimismo, el procesamiento por lotes dentro de una única transacción propaga re-ejecuciones en cascada de handlers post-commit ante cualquier fallo parcial, careciendo de garantías de idempotencia y de Dead Letter Queue (DLQ).
4. **Contradicción Arquitectónica en Concurrencia:** Existe un choque directo entre el catálogo de eventos de `ARCHITECTURE.md §5` (que exige ejecutar el consumo de inventario mediante handlers de eventos `alPublicarEnTx` que retornan `void`) y las reglas de negocio RN-32/RN-33 / `API.md` (que exigen responder un HTTP 409 con el detalle estructurado de ingredientes faltantes al confirmar pedidos).
5. **Fuga de Fronteras y Desconexión de Frontend:** La regla de `dependency-cruiser` no previene re-exports de esquemas de base de datos desde `*.public.ts`, el frontend carece de un manejador global para respuestas HTTP 401 (dejando al usuario en pantallas congeladas tras la expiración de la sesión), y la base de datos no tiene alineada la zona horaria `America/Bogota` en el contenedor de PostgreSQL.

---

## 2. Respuestas Fundamentadas a las Preguntas Clave

### 2.1. EventBus y Outbox

* **¿Hay ventanas de pérdida o duplicación de eventos?**
  * **Pérdida:** La persistencia transaccional en `evento_sistema` dentro de la transacción de negocio (`event-bus.ts:53-72`) garantiza durabilidad inicial. Sin embargo, existe una **ventana de pérdida silenciosa (abandono)** en `outbox.dispatcher.ts:90`: los eventos que superan `MAX_INTENTOS = 10` son filtrados con `lt(eventoSistema.intentos, MAX_INTENTOS)` sin ser enviados a una Dead Letter Queue (DLQ) ni generar alertas.
  * **Duplicación:** **Sí, existe duplicación garantizada bajo fallos.** En `outbox.dispatcher.ts:86-120`, todo el lote de 50 eventos se ejecuta dentro de una única transacción `this.db.transaction`. Si el evento 1 ejecuta un handler post-commit con efectos externos (ej. emisión SSE o llamada externa) y el evento 2 falla de forma no controlada, toda la transacción hace `ROLLBACK`. La marca `procesadoAt` del evento 1 se revierte a `NULL` y en la siguiente pasada el handler del evento 1 se vuelve a ejecutar.
* **¿Los handlers post-commit son realmente idempotentes o pueden serlo con el diseño actual?**
  * **No lo son.** La interfaz `HandlerPostCommit = (evento: EventoPublicado) => Promise<void>` (`event-bus.ts:24`) no provee contexto transaccional ni un mecanismo común de deduplicación. Si un evento tiene múltiples handlers registrados (`Realtime` y `Administracion`), y el segundo handler lanza un error, el catch (`outbox.dispatcher.ts:111`) incrementa intentos sin marcar `procesadoAt`. En el reintento, el primer handler se vuelve a ejecutar desde cero.
* **¿Qué pasa si el proceso muere entre COMMIT y procesado_at?**
  * La fila permanece con `procesado_at IS NULL`. Al reiniciar la aplicación, `onApplicationBootstrap()` despierta el dispatcher y re-ejecuta los handlers. Por tanto, el sistema garantiza entrega *at-least-once*, lo que reafirma que cualquier handler sin lógica interna de deduplicación duplicará sus efectos secundarios.
* **¿El dispatcher puede bloquear o hambrear el pool de conexiones?**
  * **Sí, severamente.** El pool general está fijado en `max: 10` (`db.ts:14`). `OutboxDispatcher.onApplicationBootstrap()` (`outbox.dispatcher.ts:38`) consume 1 conexión permanente con `this.pool.connect()` para `LISTEN` y **nunca la libera**. Quedan solo 9 conexiones para toda la API. Cuando el dispatcher procesa un lote (`outbox.dispatcher.ts:86`), toma una segunda conexión con `this.db.transaction` (quedan 8). Peor aún: `this.listener` **no tiene listener para el evento `'error'`**; si la conexión se resetea por red o reinicio de Postgres, Node.js arroja un *unhandled error event* que termina inmediatamente el proceso.
* **¿Escala al Hito 3 (SSE con muchos clientes)?**
  * **No con el diseño actual.** Aunque las conexiones SSE mantendrán sockets HTTP y no conexiones de base de datos activas en reposo, cuando ocurra un microcorte de red en el restaurante y 15-20 clientes (tablets de POS, KDS y Dashboard) reconecten simultáneamente con `Last-Event-ID`, cada uno consultará `evento_sistema WHERE id > lastEventId`. Con un pool de solo 8-9 conexiones disponibles, la base de datos sufrirá saturación inmediata, generando timeouts y errores 500 en la toma de pedidos.

### 2.2. Transacciones y Concurrencia

* **¿El tipo `Tx/Executor` permite que un módulo ejecute fuera de la transacción por error?**
  * **Sí.** La definición `export type Executor = Db | Tx` (`db.ts:8`) es una unión abierta en TypeScript. No existe un tipo discriminado que imponga en tiempo de compilación que un método deba correr obligatoriamente dentro de un `Tx`. Adicionalmente, los repositorios inyectan `private readonly db: Db` (`identidad.repository.ts:10`). Si un desarrollador omite pasar `tx` o utiliza accidentalmente `this.db` dentro de un caso de uso transaccional, la consulta se ejecuta en modo auto-commit fuera de la transacción sin que el compilador emita advertencias.
* **¿El patrón soporta el consumo de inventario con `FOR UPDATE` + confirmación de pedido atómica que exigen RN-32/RN-44?**
  * Técnicamente Drizzle soporta `tx.select().for('update')`. Sin embargo, hay un **conflicto de diseño fundamental**: `ARCHITECTURE.md §5` establece que el consumo de inventario se ejecuta como un handler transaccional de eventos (`alPublicarEnTx`), cuya firma retorna `Promise<void>`. La regla RN-33 y `API.md` exigen que si falta stock se retorne HTTP 409 con el detalle `{ faltantes: [{ ingredienteId, nombre, requerido, disponible }] }`. Un handler de eventos ciego no puede retornar datos al caso de uso de pedidos. El diagrama de secuencia en `ARCHITECTURE.md §6` contradice a §5 mostrando una llamada directa a `inventario.consumir()`. Debe estandarizarse el llamado directo entre servicios públicos con propagación de `tx`.

### 2.3. Fronteras Modulares

* **¿La regla de `dependency-cruiser` realmente impide imports cruzados?**
  * **Parcialmente.** La regla `modules-only-import-public` (`.dependency-cruiser.cjs:4-19`) analiza rutas resueltas, por lo que detecta imports relativos profundos que apunten a archivos sin `.public.ts`.
  * **Fallas:**
    1. **Re-exports:** Si `moduloB.public.ts` hace `export * from './moduloB.schema'`, dependency-cruiser lo aprueba.
    2. **Imports desde fuera de módulos:** La regla restringe únicamente `from: { path: '^apps/api/src/modules/([^/]+)/' }`. Archivos en `apps/api/src/health/`, `apps/api/src/config/`, `apps/api/src/db/` o controladores raíz pueden importar archivos internos de cualquier módulo sin restricción.
* **¿Las FK cruzadas entre módulos son coherentes con "cada módulo solo lee sus tablas"?**
  * **Hay un choque directo con Drizzle ORM.** Para que `receta_item` (catálogo) tenga FK hacia `ingrediente` (inventario), o `pedido` hacia `usuario` (identidad), Drizzle exige importar la tabla referenciada: `references(() => ingrediente.id)`. Si se importa `inventario.schema.ts`, viola dependency-cruiser. Si se exporta la tabla en `inventario.public.ts`, se expone la tabla a consultas arbitrarias (`db.select().from(ingrediente)`), violando el principio de aislamiento. Las FKs entre módulos deben residir exclusivamente en las migraciones SQL generadas o manejarse como IDs sin acoplar los objetos de tabla Drizzle.

### 2.4. Seguridad

* **Sesión:**
  * **Fijación y rotación:** Genera un token aleatorio nuevo de 256 bits en cada login (`auth.service.ts:59`). Correcto.
  * **Expiración deslizante:** Se desliza cada 5 minutos sumando 12 horas (`auth.service.ts:95`). **Defecto:** No existe un *Hard Session Timeout* absoluto; una sesión activa puede deslizarse indefinidamente por semanas.
  * **Invalidación:** Al hacer logout borra el registro por `tokenHash` (`auth.service.ts:106`). Correcto.
* **CSRF por Origin:**
  * **Vulnerabilidad Crítica:** `OrigenGuard` (`auth.guards.ts:31-38`) contiene `if (METODOS_MUTANTES.has(req.method) && origen && origen !== this.env.APP_ORIGIN)`. Si la cabecera `Origin` **no está presente**, la condición evalúa a `false` y la petición se permite. Además, **no verifica la cabecera `Referer`**. Un atacante puede suprimir `Origin` mediante políticas de referer y enviar peticiones mutantes sin bloqueo.
* **Rate-limit por IP detrás de Nginx (Trust Proxy):**
  * **Defecto Severo:** `app.set('trust proxy', 'loopback')` (`app.factory.ts:17`). En Docker Compose, Nginx se conecta desde la subred interna del bridge (`172.x.x.x`), que **no es loopback**. Express ignora `X-Forwarded-For` y asigna la IP del contenedor Nginx a todos los clientes. El rate limit de 5 intentos por minuto (`auth.controller.ts:21`) se vuelve global: si una terminal falla 5 veces, bloquea a todas las terminales del restaurante.
* **Cabeceras de seguridad:**
  * **Inexistentes.** No se utiliza `helmet` en Express/NestJS y `docker/nginx.conf` no incluye ninguna cabecera de seguridad (`X-Content-Type-Options`, `X-Frame-Options`, `CSP`, `Referrer-Policy`, etc.).
* **Secretos y `.env` en Docker/CI:**
  * `docker-compose.yml:30` define `SESSION_SECRET: ${SESSION_SECRET:-mb_secret_super_secure_key_production}`, pero este secreto no es consumido por la aplicación (la sesión usa hashing en BD). Es un residuo confuso.
* **Nginx (SSE, tamaños, timeouts):**
  * `docker/nginx.conf:35` define `proxy_read_timeout 24h;` en **todo** `/api/`, en lugar de restringirlo a la ruta SSE. Una consulta REST ordinaria que sufra un bloqueo mantendrá conexiones colgadas por 24 horas. Falta definir `client_max_body_size` (por defecto 1 MB), lo que impedirá subir imágenes de productos en el Hito 2.
* **Enumeración de usuarios:**
  * `auth.service.ts:47-50` implementa adecuadamente una verificación con `hashFicticio` para mitigar timing attacks cuando el usuario no existe.
* **Logs que filtren datos:**
  * `app.module.ts:23` solo redacta cookies. **No redacta el cuerpo de la petición (`req.body.password`)**, por lo que credenciales en texto claro pueden filtrarse si se eleva el nivel de log a debug o ante errores no controlados.

### 2.5. Datos y Persistencia

* **Tipos de dinero y cantidades (`bigint mode number`):**
  * `evento-sistema.schema.ts:8` usa `bigint({ mode: 'number' })`. JavaScript tiene un límite de `Number.MAX_SAFE_INTEGER` ($9 \times 10^{15}$). Para montos COP y secuencias de restaurante es suficiente, pero si un ID de secuencia en base de datos supera ese número, la precisión se corromperá silenciosamente en JavaScript.
* **Zonas horarias:**
  * En la API se maneja `America/Bogota` vía `fecha-operativa.ts`. Sin embargo, el contenedor de PostgreSQL en `docker-compose.yml` **no tiene configurada la variable `TZ: America/Bogota`**, operando en UTC. Cualquier función SQL nativa (`CURRENT_DATE` o `now()`) generará discrepancias de fecha a partir de las 19:00 COT.
* **Índices faltantes:**
  * Para los Hitos 2-5 faltan índices parciales críticos en el modelo para soportar unicidad de mesas (`mesa_id WHERE estado IN ('ABIERTO','CONFIRMADO')`), filtrado KDS (`estado, created_at WHERE estado IN ('PENDIENTE','EN_PREPARACION','LISTA')`) y pagos en efectivo (`UNIQUE (recibo_id) WHERE metodo='EFECTIVO'`).
* **Migraciones:**
  * Las migraciones en `apps/api/drizzle/` son reproducibles. Sin embargo, **CI no ejecuta un paso formal de migración de BD**, y en `docker-compose.yml` no existe ningún mecanismo para aplicarlas al desplegar.

### 2.6. Frontend

* **Manejo de 401 global:**
  * **Ausente.** `api.ts:40-47` arroja un `ApiError(401)`. Ni `api.ts` ni `QueryClient` (`main.tsx:12-16`) capturan globalmente el 401. Como `sesionQuery` tiene `staleTime: 5 * 60_000`, la interfaz mantiene al usuario en estado autenticado hasta por 5 minutos, sin redirigir a `/login`.
* **Invalidación de caché al logout:**
  * `useLogout` (`session.ts:43-46`) invoca `qc.clear()` y `qc.setQueryData(['sesion'], null)`. Limpia adecuadamente React Query. Falta un mecanismo para limpiar stores de Zustand (ticket del POS) en terminales multi-usuario.
* **Accesibilidad del shell:**
  * Bien implementada: skip link, gestión de foco con `useEffect` en cambios de ruta, landmarks semánticos y tap targets de 48px. Detalle menor: botón de logout móvil ubicado dentro del `<main>`.
* **i18n:**
  * Textos centralizados en `apps/web/src/i18n/es.ts`. Adecuado y suficiente para el alcance del MVP en Colombia.

### 2.7. Operación y Despliegue

* **CI:**
  * SÍ ejecuta los tests de integración contra PostgreSQL (`DATABASE_URL_TEST` configurada en el workflow y `test-db.ts` corriendo migraciones). Sin embargo, **no valida la construcción de las imágenes Docker ni el comando `pnpm db:migrate`**.
* **Docker / Compose:**
  * **NO arranca.** `image: postgres:18-alpine` falla al descargar la imagen. No hay healthcheck en el contenedor de `api`, Nginx depende de `api` sin esperar que esté saludable, y la aplicación corre como usuario `root` en el contenedor de la API.
* **Backup:**
  * El script prometido `ops/backup.sh` (`ARCHITECTURE.md §10`) **no existe** en el repositorio.

---

## 3. Catálogo Detallado de Hallazgos

### Hallazgos de Severidad CRÍTICA

#### [CRIT-01] Hambre y riesgo de caída fatal del pool de PostgreSQL por conexión `LISTEN` permanente
* **Clasificación:** Defecto actual
* **Ubicación:** [apps/api/src/shared-kernel/db/db.ts:13-15](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/apps/api/src/shared-kernel/db/db.ts#L13-L15), [apps/api/src/shared-kernel/events/outbox.dispatcher.ts:37-43](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/apps/api/src/shared-kernel/events/outbox.dispatcher.ts#L37-L43)
* **Escenario de fallo:**
  1. `crearPool()` fija un límite rígido de `max: 10` conexiones.
  2. Al iniciar, `OutboxDispatcher` ejecuta `this.listener = await this.pool.connect()` y se queda escuchando indefinidamente con `LISTEN evento_sistema`. Esta conexión nunca se devuelve al pool, reduciendo el pool útil a 9 conexiones.
  3. Durante la operación, cada lote de despacho toma otra conexión con `this.db.transaction` (quedan 8).
  4. Si ocurre un microcorte de red, reinicio de PostgreSQL o timeout de socket, el objeto `PoolClient` emite un evento `'error'`. Al no existir un listener `this.listener.on('error', ...)`, Node.js termina el proceso con un *Uncaught Exception*.
* **Impacto:** Caída inesperada del backend ante cualquier parpadeo de red y agotamiento rápido de conexiones concurrentes en horas pico de venta.
* **Recomendación (Hito 1):** Crear un cliente dedicado independiente fuera del pool para `LISTEN` (usando `new Client(...)` de `pg`), implementar reconexión automática con backoff exponencial y capturar el evento `'error'`. Incrementar el pool de la API a un valor configurable (mínimo 20).

#### [CRIT-02] Bypass completo de protección CSRF en peticiones mutantes sin cabecera `Origin`
* **Clasificación:** Defecto actual
* **Ubicación:** [apps/api/src/modules/identidad/auth.guards.ts:24-41](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/apps/api/src/modules/identidad/auth.guards.ts#L24-L41)
* **Escenario de ataque:**
  1. Un cajero o administrador tiene una sesión activa en el navegador.
  2. En otra pestaña, visita un sitio web malicioso que ejecuta un formulario o script hacia la API del restaurante (`/api/v1/pedidos/anular` o `/api/v1/usuarios`).
  3. El sitio atacante incluye la directiva `<meta name="referrer" content="no-referrer">` o utiliza técnicas que provocan que el navegador no envíe la cabecera `Origin`.
  4. En `OrigenGuard`, la condición `if (METODOS_MUTANTES.has(req.method) && origen && origen !== this.env.APP_ORIGIN)` evalúa a `false` porque `origen` es `undefined`.
  5. El guard retorna `true` y la petición mutante se ejecuta exitosamente.
* **Impacto:** Ejecución de acciones no autorizadas (anulaciones de pedidos, creación de usuarios admin) mediante ataques de Cross-Site Request Forgery.
* **Recomendación (Hito 1):** Validar estrictamente que en métodos mutantes: si `Origin` está presente, debe coincidir con `APP_ORIGIN`. Si no está presente, verificar `Referer` contra `APP_ORIGIN`. Si ambas cabeceras están ausentes en peticiones mutantes autenticadas, rechazar con HTTP 403 `ORIGEN_NO_PERMITIDO`.

#### [CRIT-03] Incompatibilidad de cookies de sesión con despliegue HTTP en LAN y DoS por `trust proxy`
* **Clasificación:** Defecto actual
* **Ubicación:** [apps/api/src/modules/identidad/auth.guards.ts:18](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/apps/api/src/modules/identidad/auth.guards.ts#L18), [apps/api/src/app.factory.ts:17](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/apps/api/src/app.factory.ts#L17), [docker-compose.yml:27-35](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/docker-compose.yml#L27-L35)
* **Escenario de fallo:**
  1. En `docker-compose.yml`, `NODE_ENV` está fijado en `production` y Nginx expone el puerto HTTP 80 (`http://localhost` o IP local de LAN).
  2. `opcionesCookie()` asigna `secure: env.NODE_ENV === 'production'`. El navegador rechaza almacenar cookies con atributo `Secure` en conexiones HTTP planas en LAN (`http://192.168.1.x`), imposibilitando el inicio de sesión.
  3. Además, `app.set('trust proxy', 'loopback')` hace que Express ignore las cabeceras `X-Forwarded-For` de Nginx porque la IP del contenedor Nginx (`172.x.x.x`) no es loopback.
  4. La API asigna la misma IP a todas las peticiones del restaurante. Cuando un cajero falla 5 veces su contraseña, el rate limit bloquea inmediatamente el acceso a **todos los dispositivos del restaurante** durante un minuto.
* **Impacto:** Imposibilidad de iniciar sesión en despliegues LAN estándar y Denegación de Servicio (DoS) auto-infligida en el restaurante.
* **Recomendación (Hito 1):** Permitir desacoplar `COOKIE_SECURE` del `NODE_ENV` (o validar si `APP_ORIGIN` inicia con `https://`). Configurar `trust proxy` para confiar en la red privada de Docker o en el proxy Nginx (`app.set('trust proxy', true)` cuando corre detrás de Nginx en red aislada).

#### [CRIT-04] Imagen inexistente en Docker Hub (`postgres:18-alpine`) que impide el despliegue
* **Clasificación:** Defecto actual
* **Ubicación:** [docker-compose.yml:3](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/docker-compose.yml#L3)
* **Escenario de fallo:**
  1. El operador ejecuta `docker compose up -d` en el servidor local del restaurante.
  2. Docker Daemon intenta descargar la imagen `postgres:18-alpine`.
  3. Docker Hub responde `manifest unknown: manifest unknown` debido a que PostgreSQL 18 no ha sido liberado oficialmente ni cuenta con imagen alpine oficial.
  4. El contenedor falla al iniciar y el despliegue se cancela.
* **Impacto:** Imposibilidad total de ejecutar el entorno mediante Docker Compose.
* **Recomendación (Hito 1):** Cambiar inmediatamente la imagen en `docker-compose.yml` a `postgres:17-alpine`, consistente con lo probado en CI (`postgres:17`).

#### [CRIT-05] Arranque del backend sobre base de datos vacía sin aplicación automática de migraciones
* **Clasificación:** Defecto actual
* **Ubicación:** [apps/api/Dockerfile:32](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/apps/api/Dockerfile#L32), [apps/api/src/main.ts:6-11](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/apps/api/src/main.ts#L6-L11), [docker-compose.yml:20-39](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/docker-compose.yml#L20-L39)
* **Escenario de fallo:**
  1. Se levanta el stack por primera vez con Docker Compose.
  2. PostgreSQL arranca con un volumen vacío.
  3. La API arranca ejecutando `node dist/main.js`.
  4. La API no ejecuta las migraciones en su arranque. El endpoint `/health` responde 200 OK (porque solo ejecuta `SELECT 1`).
  5. En la primera llamada a `/auth/login` o seed, PostgreSQL arroja el error fatal `relation "usuario" does not exist` (código `42P01`).
* **Impacto:** Fallo general de la aplicación tras el primer despliegue en un entorno limpio.
* **Recomendación (Hito 1):** Incluir un paso de migración automática en el arranque de la API (ejecutando `migrate(db, ...)` en `main.ts` antes de `app.listen()`) o un servicio init/entrypoint en `docker-compose.yml` que corra `pnpm db:migrate`.

#### [CRIT-06] Conflicto arquitectónico entre `alPublicarEnTx` y los requerimientos de error en RN-32/RN-33
* **Clasificación:** Riesgo futuro / Defecto de diseño
* **Ubicación:** [ARCHITECTURE.md:164-166](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/ARCHITECTURE.md#L164-L166), [ARCHITECTURE.md:191-196](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/ARCHITECTURE.md#L191-L196), [apps/api/src/shared-kernel/events/event-bus.ts:22](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/apps/api/src/shared-kernel/events/event-bus.ts#L22)
* **Escenario de fallo:**
  1. En el Hito 2, se implementa la confirmación de pedidos. El desarrollador sigue la tabla de eventos de `ARCHITECTURE.md §5`, registrando el descuento de inventario con `alPublicarEnTx('PedidoConfirmado', ...)`.
  2. Cuando el inventario es insuficiente, la regla RN-33 y `API.md` exigen responder HTTP 409 con el detalle `{ faltantes: [...] }`.
  3. El tipo `HandlerEnTx` retorna `Promise<void>`. Un handler de eventos no puede retornar estructuras de datos al servicio orquestador de pedidos.
  4. Adicionalmente, el diagrama de secuencia en `ARCHITECTURE.md §6` muestra a `pedidos` llamando directamente a `inventario.consumir()`.
* **Impacto:** Inconsistencia entre builders de los Hitos 2 y 5, pérdida de detalles estructurados de error y bloqueo de desarrollo.
* **Recomendación (Hito 2):** Establecer formalmente que las operaciones de negocio críticas que requieren validación, atomicidad y respuesta estructurada (como descuento de stock o creación de comanda) se invocan mediante **llamadas síncronas a servicios públicos** (`inventario.public.ts`), y que los eventos de dominio (`alPublicarEnTx`) se reservan exclusivamente para efectos secundarios transaccionales que no retornan datos al cliente.

---

### Hallazgos de Severidad ALTA

#### [ALTA-01] Duplicación en cascada de eventos post-commit ante fallos parciales del lote
* **Clasificación:** Defecto actual
* **Ubicación:** [apps/api/src/shared-kernel/events/outbox.dispatcher.ts:86-121](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/apps/api/src/shared-kernel/events/outbox.dispatcher.ts#L86-L121)
* **Escenario de fallo:**
  1. Hay 10 eventos pendientes en `evento_sistema`.
  2. `procesarLote()` abre una única transacción en Postgres.
  3. Los eventos 1 a 5 ejecutan sus handlers exitosamente (ej. notificación push o emisión SSE).
  4. En el evento 6, ocurre una desconexión o fallo que invalida la transacción Drizzle/Postgres.
  5. Toda la transacción hace `ROLLBACK`. Los eventos 1 a 5 quedan nuevamente con `procesado_at = NULL`.
  6. En la siguiente iteración, el despachador vuelve a ejecutar los handlers de los eventos 1 a 5.
* **Impacto:** Duplicación de notificaciones, mensajes en tiempo real duplicados a pantallas de cocina y métricas distorsionadas.
* **Recomendación (Hito 1):** Procesar cada evento con su propia mini-transacción o marcar `procesado_at` individualmente de forma inmediata tras el éxito de sus handlers.

#### [ALTA-02] Incompatibilidad del Outbox con escalabilidad horizontal y reconexión masiva de SSE
* **Clasificación:** Riesgo futuro
* **Ubicación:** [apps/api/src/shared-kernel/events/outbox.dispatcher.ts:37-43](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/apps/api/src/shared-kernel/events/outbox.dispatcher.ts#L37-L43), [ARCHITECTURE.md:231-238](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/ARCHITECTURE.md#L231-L238)
* **Escenario de fallo:**
  1. En el Hito 3, se conectan 10-15 dispositivos por SSE (KDS, POS, Admin).
  2. Ocurre una breve desconexión de red en el restaurante. Todos los clientes se reconectan al mismo tiempo con `Last-Event-ID`.
  3. Cada conexión entrante realiza una consulta a `evento_sistema WHERE id > lastEventId` para recuperar eventos perdidos.
  4. Al tener un pool de base de datos de solo 10 conexiones (con 1 o 2 ocupadas por el dispatcher), el pool se satura instantáneamente. Las peticiones REST para crear o cobrar pedidos entran en timeout (HTTP 504 o 500).
* **Impacto:** Bloqueo de la operación de ventas en caja ante cualquier parpadeo de la red WiFi del restaurante.
* **Recomendación (Hito 3):** Implementar un búfer circular en memoria para los últimos N eventos en el hub de SSE para responder reconexiones rápidas sin consultar la base de datos, y dimensionar el pool de PostgreSQL acorde a la concurrencia esperada.

#### [ALTA-03] Fuga de transaccionalidad por tipado permisivo en `Executor = Db | Tx`
* **Clasificación:** Defecto actual
* **Ubicación:** [apps/api/src/shared-kernel/db/db.ts:6-8](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/apps/api/src/shared-kernel/db/db.ts#L6-L8), [apps/api/src/modules/identidad/identidad.repository.ts:10-25](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/apps/api/src/modules/identidad/identidad.repository.ts#L10-L25)
* **Escenario de fallo:**
  1. En `identidad.repository.ts`, métodos como `buscarSesionVigente` o `extenderSesion` utilizan directamente `this.db`.
  2. En futuros módulos (pedidos, inventario, caja), un desarrollador define un método `actualizarStock(ex: Executor, ...)` pero dentro de su implementación usa por distracción `this.db` o quien lo invoca olvida pasar la instancia `tx`.
  3. TypeScript compila sin errores porque `Executor` acepta tanto `Db` como `Tx`.
  4. La mutación se ejecuta fuera de la transacción principal. Si la transacción principal falla y hace rollback, la mutación no transaccional ya quedó persistida.
* **Impacto:** Pérdida de integridad transaccional, stock desfasado respecto a pedidos y dinero no cuadrado.
* **Recomendación (Hito 1):** Eliminar el tipo union permisivo `Executor` para operaciones de escritura; requerir explícitamente `tx: Tx` en todos los métodos de repositorio que formen parte de casos de uso transaccionales.

#### [ALTA-04] Incapacidad de `dependency-cruiser` para impedir re-exports y fuga desde archivos no-módulo
* **Clasificación:** Defecto actual
* **Ubicación:** [.dependency-cruiser.cjs:9-18](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/.dependency-cruiser.cjs#L9-L18)
* **Escenario de fallo:**
  1. Un desarrollador de `cocina` necesita consultar datos de pedidos y le pide al builder de `pedidos` que exporte `pedidos.repository.ts` desde `pedidos.public.ts`.
  2. `pedidos.public.ts` hace `export * from './pedidos.repository'`.
  3. `dependency-cruiser` evalúa que el import viene de `*.public.ts` y no detecta ninguna violación.
  4. Adicionalmente, cualquier servicio fuera de `apps/api/src/modules/` (como scripts de seed o controladores globales) puede importar archivos privados de cualquier módulo sin que la regla aplique.
* **Impacto:** Degradación silenciosa del monolito modular hacia un sistema fuertemente acoplado.
* **Recomendación (Hito 1):** Añadir reglas de ESLint o dependency-cruiser que prohíban explícitamente que los archivos `*.public.ts` exporten entidades con sufijo `*.repository.ts`, `*.schema.ts` o `*.internal.ts`.

#### [ALTA-05] Incoherencia entre Foreign Keys en schemas de Drizzle y la regla de aislamiento de tablas
* **Clasificación:** Riesgo futuro
* **Ubicación:** [ARCHITECTURE.md:105-108](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/ARCHITECTURE.md#L105-L108), [docs/DATA_MODEL.md:88-90](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/docs/DATA_MODEL.md#L88-L90)
* **Escenario de fallo:**
  1. En el Hito 2, `catalogo.schema.ts` debe definir la tabla `receta_item`, cuya columna `ingrediente_id` tiene FK a `ingrediente` (`inventario`).
  2. Para declarar la FK en Drizzle, el schema necesita hacer `references(() => ingrediente.id)`.
  3. Esto obliga a importar el objeto de tabla `ingrediente` desde `inventario`.
  4. Al importar el objeto de tabla, los desarrolladores de `catalogo` quedan habilitados para realizar consultas directas `db.select().from(ingrediente)`.
* **Impacto:** Ruptura forzada del principio fundamental de que "cada módulo solo lee sus propias tablas".
* **Recomendación (Hito 2):** Desacoplar las FKs entre módulos en los schemas de TypeScript (definiendo columnas como `uuid()` simples en el schema de Drizzle) y aplicar las restricciones `FOREIGN KEY` inter-módulo directamente mediante sentencias SQL en las migraciones.

#### [ALTA-06] Ausencia total de cabeceras de seguridad HTTP
* **Clasificación:** Defecto actual
* **Ubicación:** [apps/api/src/app.factory.ts:11-22](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/apps/api/src/app.factory.ts#L11-L22), [docker/nginx.conf:1-37](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/docker/nginx.conf#L1-L37)
* **Escenario de ataque:**
  1. La aplicación se sirve sin cabeceras `X-Frame-Options` ni `Content-Security-Policy`.
  2. Un atacante incrusta la interfaz del POS o Dashboard en un iframe transparente (`<iframe src="http://pos.local/login">`) dentro de una página trampa.
  3. Se engaña al operador mediante Clickjacking para que realice acciones sensibles con un clic en la interfaz superpuesta.
* **Impacto:** Vulnerabilidad a Clickjacking, ataques de MIME-type sniffing y cross-site scripting por falta de CSP.
* **Recomendación (Hito 1):** Instalar y registrar `helmet` en `crearApp()` (`app.factory.ts`) y configurar las cabeceras estándar en el bloque `server` de `docker/nginx.conf`.

#### [ALTA-07] Desalineación de zona horaria entre la aplicación y el motor PostgreSQL
* **Clasificación:** Defecto actual
* **Ubicación:** [docker-compose.yml:32](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/docker-compose.yml#L32), [packages/shared/src/fecha-operativa.ts:14-15](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/packages/shared/src/fecha-operativa.ts#L14-L15), [docs/DATA_MODEL.md:134](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/docs/DATA_MODEL.md#L134)
* **Escenario de fallo:**
  1. En `docker-compose.yml`, el contenedor `api` tiene `TZ: America/Bogota`, pero el servicio `postgres` no tiene la variable `TZ`.
  2. PostgreSQL corre en UTC.
  3. En los Hitos 4 y 5, se ejecutan vistas administrativas (`v_ventas_dia` en `DATA_MODEL.md:263`) o consultas que utilicen `CURRENT_DATE`.
  4. Entre las 19:00 y las 23:59 hora de Colombia (00:00 - 04:59 UTC), PostgreSQL considera que ya es el día siguiente.
* **Impacto:** Cuadres de caja erróneos, reportes diarios desfasados y pedidos agrupados en fechas operativas incorrectas.
* **Recomendación (Hito 1):** Configurar `TZ: America/Bogota` en el servicio `postgres` de `docker-compose.yml` y asegurar que todas las fechas operativas provengan calculadas desde la aplicación.

#### [ALTA-08] Inconsistencia de serialización e índices faltantes para Hitos 2, 3 y 4
* **Clasificación:** Riesgo futuro
* **Ubicación:** [docs/DATA_MODEL.md:151-154](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/docs/DATA_MODEL.md#L151-L154), [docs/DATA_MODEL.md:187](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/docs/DATA_MODEL.md#L187), [docs/DATA_MODEL.md:238-239](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/docs/DATA_MODEL.md#L238-L239)
* **Escenario de fallo:**
  1. En el Hito 2, se crean dos pedidos para la misma mesa simultáneamente desde terminales distintas.
  2. Si el índice `UNIQUE (mesa_id) WHERE estado IN ('ABIERTO','CONFIRMADO')` (RN-11) no se define a nivel de base de datos, ambas terminales crearán pedidos paralelos, violando la regla de negocio.
  3. De igual manera en el Hito 4, la regla RN-43 (un solo pago en efectivo por recibo) requiere el índice `UNIQUE (recibo_id) WHERE metodo='EFECTIVO'`.
* **Impacto:** Violación de invariantes de negocio bajo condiciones de carrera.
* **Recomendación (Hitos 2 y 4):** Asegurar que las migraciones de cada hito incluyan explícitamente los índices parciales e invariantes documentados en `DATA_MODEL.md`.

#### [ALTA-09] Falta de interceptor global de errores 401 en el cliente web (UI congelada)
* **Clasificación:** Defecto actual
* **Ubicación:** [apps/web/src/lib/api.ts:40-47](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/apps/web/src/lib/api.ts#L40-L47), [apps/web/src/main.tsx:12-16](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/apps/web/src/main.tsx#L12-L16), [apps/web/src/features/auth/session.ts:11-23](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/apps/web/src/features/auth/session.ts#L11-L23)
* **Escenario de fallo:**
  1. La sesión de un cajero expira en el servidor tras 12 horas o es invalidada por el administrador.
  2. El cajero realiza una acción (consultar pedidos o guardar ticket).
  3. La API responde 401 `NO_AUTENTICADO`.
  4. La función `api()` arroja `ApiError`. Ni `api.ts` ni `QueryClient` capturan el error de forma centralizada.
  5. `sesionQuery` tiene `staleTime: 5 * 60_000`. La aplicación asume que el usuario sigue autenticado.
  6. La UI no redirige a `/login` ni muestra notificación de sesión expirada; el botón o pantalla queda en estado de error local o carga indefinida.
* **Impacto:** Experiencia de usuario rota, confusión operativa y pérdida de pedidos no guardados.
* **Recomendación (Hito 1):** Configurar en `QueryCache` y `MutationCache` de `QueryClient` un manejador global para errores con status 401 que invalide la query `['sesion']`, limpie el estado y redirija a `/login`.

#### [ALTA-10] Contenedor de backend ejecutándose como superusuario `root` y sin `HEALTHCHECK`
* **Clasificación:** Defecto actual
* **Ubicación:** [apps/api/Dockerfile:20-32](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/apps/api/Dockerfile#L20-L32), [docker-compose.yml:20-39](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/docker-compose.yml#L20-L39)
* **Escenario de fallo:**
  1. La imagen `api` se ejecuta como usuario `root`. Si una dependencia de Node.js presenta una vulnerabilidad de escape o ejecución de comandos, el atacante obtiene control total como superusuario dentro del contenedor.
  2. En `docker-compose.yml`, el servicio `nginx` depende de `api` sin `condition: service_healthy`. Nginx arranca antes de que Node.js termine de inicializarse, sirviendo errores 502 Bad Gateway a los primeros clientes.
* **Impacto:** Riesgo grave de seguridad en el contenedor y fallos de disponibilidad en el arranque.
* **Recomendación (Hito 1):** Añadir `USER node` en la etapa runner de `apps/api/Dockerfile`. Configurar `HEALTHCHECK` en Dockerfile y en `docker-compose.yml` apuntando a `/api/v1/health`.

---

### Hallazgos de Severidad MEDIA

#### [MED-01] Abandono silencioso de eventos que superan `MAX_INTENTOS` (Poison Pill sin DLQ)
* **Clasificación:** Defecto actual
* **Ubicación:** [apps/api/src/shared-kernel/events/outbox.dispatcher.ts:15](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/apps/api/src/shared-kernel/events/outbox.dispatcher.ts#L15), [apps/api/src/shared-kernel/events/outbox.dispatcher.ts:90](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/apps/api/src/shared-kernel/events/outbox.dispatcher.ts#L90)
* **Escenario de fallo:** Un evento con payload corrupto o que provoque una falla persistente en un handler post-commit falla 10 veces seguidas. Al décimo intento, la condición `lt(eventoSistema.intentos, MAX_INTENTOS)` lo ignora para siempre. No se envía alerta al administrador ni se mueve a una tabla de Dead Letter Queue.
* **Impacto:** Pérdida inadvertida de eventos de dominio y desfase de estadísticas o notificaciones.
* **Recomendación (Hito 1):** Emitir un log de nivel `error` crítico al alcanzar `MAX_INTENTOS` y crear un endpoint administrativo en el Hito 5 (`/admin/eventos/reintentar`) para inspeccionar y reintentar eventos fallidos.

#### [MED-02] Riesgo de bloqueo mutuo (Deadlock) en cobro concurrente de pedidos abiertos (RN-44)
* **Clasificación:** Riesgo futuro
* **Ubicación:** [docs/BUSINESS_RULES.md:51](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/docs/BUSINESS_RULES.md#L51), [docs/BUSINESS_RULES.md:65](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/docs/BUSINESS_RULES.md#L65)
* **Escenario de fallo:** Dos terminales cobran al mismo tiempo pedidos abiertos con ingredientes compartidos. La transacción A bloquea la sesión de caja y luego intenta bloquear los ingredientes. La transacción B bloquea los ingredientes y luego intenta bloquear la sesión de caja o pedidos. Se genera un deadlock en PostgreSQL.
* **Impacto:** Excepciones de concurrencia y transacciones abortadas en caja durante horas pico.
* **Recomendación (Hito 4):** Estandarizar el orden estricto de adquisición de bloqueos en transacciones compuestas: 1) Pedido, 2) Ingredientes en orden ascendente de `id`, 3) Comanda, 4) Sesión de caja.

#### [MED-03] Fuga de credenciales sensibles en logs por configuración incompleta de `redact`
* **Clasificación:** Defecto actual
* **Ubicación:** [apps/api/src/app.module.ts:20-29](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/apps/api/src/app.module.ts#L20-L29)
* **Escenario de fallo:** Si se configura `LOG_LEVEL=debug` o si ocurre un error no capturado en `POST /auth/login`, Pino o interceptores registran el cuerpo de la petición. La contraseña viaja en texto plano en `req.body.password`.
* **Impacto:** Exposición de contraseñas de empleados en los archivos de log del servidor.
* **Recomendación (Hito 1):** Agregar a la lista de `redact` en `LoggerModule`: `'req.body.password'`, `'req.body.pin'`, `'*.password'`.

#### [MED-04] Acumulación ilimitada de sesiones expiradas en PostgreSQL
* **Clasificación:** Defecto actual
* **Ubicación:** [apps/api/src/modules/identidad/identidad.repository.ts:21-25](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/apps/api/src/modules/identidad/identidad.repository.ts#L21-L25), [apps/api/src/modules/identidad/auth.service.ts:68](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/apps/api/src/modules/identidad/auth.service.ts#L68)
* **Escenario de fallo:** Las sesiones expiradas solo se borran para el usuario específico que inicia sesión nuevamente. Las sesiones de usuarios inactivos o tokens abandonados nunca se depuran.
* **Impacto:** Crecimiento innecesario de la tabla `sesion_usuario` e índices, degradando el rendimiento de consultas a largo plazo.
* **Recomendación (Hito 1):** Implementar un cron o tarea periódica ligera que ejecute `DELETE FROM sesion_usuario WHERE expira_at < now()`.

#### [MED-05] Pérdida de precisión potencial con `bigint({ mode: 'number' })`
* **Clasificación:** Defecto actual
* **Ubicación:** [apps/api/src/shared-kernel/events/evento-sistema.schema.ts:8](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/apps/api/src/shared-kernel/events/evento-sistema.schema.ts#L8)
* **Escenario de fallo:** Si una secuencia en PostgreSQL sobrepasa `Number.MAX_SAFE_INTEGER` ($9.007 \times 10^{15}$), JavaScript redondeará silenciosamente los identificadores.
* **Impacto:** Corrupción silenciosa de identificadores de eventos o secuencias en clientes Node.js.
* **Recomendación (Hito 3):** Mantener `mode: 'number'` por compatibilidad con JSON en el MVP, pero añadir un chequeo o validar que secuencias no superen el rango seguro.

#### [MED-06] Ausencia de limpieza de estado local en logout para terminales compartidas
* **Clasificación:** Riesgo futuro
* **Ubicación:** [apps/web/src/features/auth/session.ts:39-48](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/apps/web/src/features/auth/session.ts#L39-L48), [ARCHITECTURE.md:47](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/ARCHITECTURE.md#L47)
* **Escenario de fallo:** En el Hito 2, se implementa el store de Zustand para el ticket en curso del POS. Un cajero cierra sesión mientras tenía un pedido a medio armar. Un segundo cajero entra en la misma máquina y el ticket anterior permanece visible y listo para cobrar.
* **Impacto:** Cobros erróneos o atribución incorrecta de ventas entre cajeros.
* **Recomendación (Hito 2):** Crear un hook o mecanismo de reseteo global que limpie todos los stores de Zustand al ejecutar el logout.

#### [MED-07] Inexistencia del script de respaldo `ops/backup.sh`
* **Clasificación:** Defecto actual
* **Ubicación:** [ARCHITECTURE.md:263](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/ARCHITECTURE.md#L263)
* **Escenario de fallo:** El servidor del restaurante sufre una falla de hardware o corrupción de disco. La documentación afirma que existe un script de respaldo diario en `ops/backup.sh`, pero el archivo no existe en el repositorio.
* **Impacto:** Pérdida irrecuperable de datos históricos y ventas del restaurante.
* **Recomendación (Hito 1):** Crear el script `ops/backup.sh` con `pg_dump` y documentar su configuración en el crontab del host.

#### [MED-08] Falta de verificación de builds de Docker y migraciones en CI
* **Clasificación:** Defecto actual
* **Ubicación:** [.github/workflows/ci.yml:50-69](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/.github/workflows/ci.yml#L50-L69)
* **Escenario de fallo:** Errores en los Dockerfiles (como la imagen inexistente `postgres:18-alpine`) o fallos de compilación de imágenes pasan desapercibidos en CI porque el workflow solo corre tests de Vitest sobre Node.js.
* **Impacto:** Falsa sensación de estabilidad en la rama principal (`main`) que falla al momento del despliegue.
* **Recomendación (Hito 1):** Agregar un paso de `docker compose config` y validación de build de imágenes en el workflow de CI.

---

### Hallazgos de Severidad BAJA

#### [BAJA-01] Secreto huérfano e inseguro por defecto en `docker-compose.yml`
* **Clasificación:** Defecto actual
* **Ubicación:** [docker-compose.yml:30](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/docker-compose.yml#L30), [apps/api/src/config/env.ts:3-10](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/apps/api/src/config/env.ts#L3-L10)
* **Escenario:** `docker-compose.yml` expone `SESSION_SECRET: ${SESSION_SECRET:-mb_secret_super_secure_key_production}`. La variable no existe en `envSchema` ni se utiliza en ninguna parte del código.
* **Impacto:** Confusión operativa y falsa sensación de configuración de seguridad.
* **Recomendación (Hito 1):** Eliminar la variable `SESSION_SECRET` de `docker-compose.yml` y `.env.example`.

#### [BAJA-02] Contaminación semántica del landmark `<main>` en `AppShell` para vistas móviles
* **Clasificación:** Defecto actual
* **Ubicación:** [apps/web/src/app/app-shell.tsx:91-99](file:///C:/Users/manue/orca/workspaces/MonsterBurguer/mvp-critico/apps/web/src/app/app-shell.tsx#L91-L99)
* **Escenario:** En pantallas pequeñas (< 1024px), el botón de cerrar sesión está ubicado dentro del elemento `<main id="contenido">`.
* **Impacto:** Violación menor de accesibilidad semántica para tecnologías asistivas.
* **Recomendación (Hito 1):** Mover el botón de cierre de sesión móvil al header o a una barra de navegación dedicada fuera del landmark `<main>`.

---

## 4. Matriz de Priorización y Plan de Acción

| ID | Título | Severidad | Hito Recomendado | Esfuerzo Estimado |
|---|---|:---:|:---:|:---:|
| **CRIT-01** | Listener `LISTEN` permanente en pool de 10 conexiones | CRÍTICA | Hito 1 | Medio |
| **CRIT-02** | Bypass CSRF en peticiones sin cabecera `Origin` | CRÍTICA | Hito 1 | Bajo |
| **CRIT-03** | Cookie `Secure` en HTTP y colapso de rate-limit por `trust proxy` | CRÍTICA | Hito 1 | Bajo |
| **CRIT-04** | Imagen inexistente `postgres:18-alpine` en compose | CRÍTICA | Hito 1 | Inmediato |
| **CRIT-05** | API inicia sobre base de datos vacía sin migraciones | CRÍTICA | Hito 1 | Bajo |
| **CRIT-06** | Conflicto entre `alPublicarEnTx` y errores de RN-32/RN-33 | CRÍTICA | Hito 2 | Medio |
| **ALTA-01** | Duplicación en cascada de eventos por fallo de lote | ALTA | Hito 1 | Medio |
| **ALTA-02** | Saturación de pool de BD ante reconexión masiva SSE | ALTA | Hito 3 | Alto |
| **ALTA-03** | Fuga de transaccionalidad por tipado permisivo `Executor` | ALTA | Hito 1 | Medio |
| **ALTA-04** | Re-exports y fuga de fronteras en `dependency-cruiser` | ALTA | Hito 1 | Bajo |
| **ALTA-05** | Conflicto de FKs de Drizzle con aislamiento de tablas | ALTA | Hito 2 | Medio |
| **ALTA-06** | Ausencia total de cabeceras de seguridad HTTP | ALTA | Hito 1 | Bajo |
| **ALTA-07** | Desalineación de zona horaria en contenedor PostgreSQL | ALTA | Hito 1 | Inmediato |
| **ALTA-08** | Índices parciales faltantes para mesas y pagos | ALTA | Hitos 2 y 4 | Medio |
| **ALTA-09** | Falta de interceptor global de 401 en frontend | ALTA | Hito 1 | Bajo |
| **ALTA-10** | Contenedor de API corre como `root` y sin healthcheck | ALTA | Hito 1 | Bajo |
| **MED-01** | Abandono silencioso de eventos (Poison Pill sin DLQ) | MEDIA | Hito 1 | Bajo |
| **MED-02** | Riesgo de deadlock en cobro de pedidos abiertos | MEDIA | Hito 4 | Medio |
| **MED-03** | Fuga de contraseñas en logs (redact incompleto) | MEDIA | Hito 1 | Inmediato |
| **MED-04** | Acumulación ilimitada de sesiones expiradas en BD | MEDIA | Hito 1 | Bajo |
| **MED-05** | Precisión de `bigint mode number` | MEDIA | Hito 3 | Bajo |
| **MED-06** | Limpieza de estado de Zustand en logout | MEDIA | Hito 2 | Bajo |
| **MED-07** | Inexistencia del script `ops/backup.sh` | MEDIA | Hito 1 | Bajo |
| **MED-08** | Falta de verificación de Docker en CI | MEDIA | Hito 1 | Bajo |
| **BAJA-01** | Secreto huérfano `SESSION_SECRET` en compose | BAJA | Hito 1 | Inmediato |
| **BAJA-02** | Landmark semántico contaminado en vista móvil | BAJA | Hito 1 | Inmediato |
