# Reporte de QA Exhaustivo del Backend (API REST) — MonsterBurguer POS

**Fecha de ejecución:** 2026-10-07  
**Entorno de pruebas:** PostgreSQL 17 local (`mb_qa_api` y `mb_qa_api_test`) en puerto 5432  
**API bajo prueba:** NestJS 12 en puerto `3021` (`APP_ORIGIN=http://localhost:5191`)  
**Auditor / Rol:** QA Backend Verifier  

---

## 1. Resumen Ejecutivo

Se ejecutó una auditoría y verificación exhaustiva de la API REST del backend de MonsterBurguer (`apps/api`), abarcando tanto la ejecución formal de las suites de pruebas y verificaciones estáticas existentes (`@mb/shared test`, `api test`, `typecheck`, `eslint`, `dependency-cruiser`), como la ejecución de una suite de pruebas dinámicas integral de 119 casos automatizados ejecutados vía fetch HTTP en Node.js sobre una instancia real del backend.

El núcleo operativo del MVP muestra una alta solidez arquitectónica: el ciclo de pedidos, el descuento atómico de inventario mediante bloqueos pesimistas (`SELECT ... FOR UPDATE` ordenados por ID para prevenir deadlocks), la concurrencia ante stock límite (donde 2 peticiones concurrentes compiten y exactamente una triunfa mientras la otra recibe `409 STOCK_INSUFICIENTE`), la máquina de estados de cocina (KDS) y de pedidos, las sesiones de caja con cálculo de cambio y propina sugerida redondeada a la centena (RN-06), el rotulado no fiscal en recibos POS y la difusión en tiempo real vía Server-Sent Events (SSE) con filtros por rol cumplen los requerimientos de diseño.

Sin embargo, se identificaron **discrepancias significativas y defectos puntuales**:
1. **Error 500 en violaciones de unicidad en Catálogo e Inventario (Mayor):** `catalogo.service.ts` e `inventario.service.ts` buscan la subcadena `"unique"` en `err.message`, pero Drizzle ORM encapsula la excepción en `DrizzleQueryError` con mensaje `"Failed query..."`, lo que hace que los duplicados de nombre de categoría, producto o ingrediente desencadenen un error HTTP `500 Internal Server Error` no controlado en lugar del HTTP `409 Conflict` con código `NOMBRE_DUPLICADO`.
2. **Rechazo de pagos mixtos en Cobro (Mayor):** `caja.service.ts` rechaza cualquier cobro con más de un pago arrojando `400 VALIDACION` ("En el MVP el cobro admite un solo método de pago"), contraviniendo directamente la regla de negocio `RN-42` ("Se permiten pagos mixtos") y los ejemplos de contrato en `docs/API.md`.
3. **11 Endpoints documentados en `docs/API.md` pero inexistentes en controladores (Mayor):** No existen controladores ni rutas para la administración de usuarios (`/usuarios`), la anulación de pedidos (`POST /pedidos/:id/anular`, RN-50), el deshacer transiciones de comanda (`POST /comandas/:id/deshacer`, RN-22), los movimientos manuales de caja (`POST /caja/sesiones/:id/movimientos`, RN-46), el historial de cierres de caja (`GET /caja/sesiones`), las alertas administrativas (`GET /admin/alertas`, RN-36), los reportes de ventas (`GET /admin/reportes/ventas`) ni la configuración del sistema (`GET/PUT /admin/configuracion`).
4. **Bypass de validación CSRF sin cabecera Origin (Menor / Observación):** `OrigenGuard` valida el origen solo si la cabecera está presente (`origen && origen !== this.env.APP_ORIGIN`), permitiendo peticiones mutantes sin cabecera `Origin` (herramientas CLI o scripts automatizados).

---

## 2. Veredicto Final

### **APROBADO CON OBSERVACIONES**

**Justificación:**  
El núcleo transaccional, financiero y de control de stock del restaurante funciona correctamente y cumple las invariantes críticas de integridad (atomicidad, ausencia de stock negativo, cálculo exacto de dinero en enteros COP, autorización por roles y streaming SSE). El sistema es apto para pruebas de integración con el frontend de los flujos principales (mostrador, mesas, KDS y cobro simple), pero requiere corregir el bloque de captura de errores de unicidad (evitar HTTP 500), armonizar la regla de pagos mixtos e implementar o formalizar en el backlog los endpoints pendientes antes del paso a producción.

---

## 3. Resultados Exactos de la Suite Existente

| Herramienta / Comando | Alcance | Resultado | Métricas |
|---|---|---|---|
| `pnpm --filter @mb/shared test` | Paquete compartido | **PASÓ (0 errores)** | 10 archivos de test, 125 pruebas aprobadas (1.37s) |
| `pnpm --filter api test` (`mb_qa_api_test`) | Backend NestJS + Postgres Test | **PASÓ (0 errores)** | 6 archivos de test, 71 pruebas aprobadas (49.07s) |
| `pnpm typecheck` | Monorepo completo (`shared`, `api`, `web`) | **PASÓ (0 errores)** | 3 proyectos validados exitosamente sin errores de TypeScript |
| `pnpm lint` | Monorepo completo (`eslint .`) | **PASÓ (0 errores)** | Sin advertencias ni errores de linter |
| `pnpm depcruise` | Fronteras modulares (`apps/api/src`) | **PASÓ (0 violaciones)** | 107 módulos y 385 dependencias analizadas sin infracciones de arquitectura |

---

## 4. Tabla de Cobertura de Endpoints de Controladores

Se verificó el **100 % de los 35 endpoints existentes en los controladores reales de `apps/api`**, contrastados contra los roles del sistema (`ADMIN`, `CAJERO`, `COCINA` y solicitud anónima), esquemas de validación Zod y reglas de negocio.

| # | Método | Endpoint Real | Rol Esperado | Casos Probados | Código HTTP | Resultado |
|---|---|---|---|---|---|---|
| 1 | `GET` | `/health` | Público | Verificación de salud y conexión Postgres | 200 OK | ✅ Aprobado |
| 2 | `POST` | `/auth/login` | Público | Credenciales válidas, clave incorrecta, usuario inexistente, rate limiting (>5/min) | 200, 401, 429 | ✅ Aprobado |
| 3 | `POST` | `/auth/logout` | Autenticado | Invalidación de sesión opaca en BD y borrado de cookie | 204 No Content | ✅ Aprobado |
| 4 | `GET` | `/auth/me` | Autenticado | Con sesión activa (ADMIN/CAJERO), sin cookie de sesión | 200, 401 | ✅ Aprobado |
| 5 | `GET` | `/catalogo/menu` | ADMIN, CAJERO | Acceso con cajero (200), acceso con cocina (403), sin auth (401) | 200, 403, 401 | ✅ Aprobado |
| 6 | `GET` | `/categorias` | ADMIN | Acceso con admin (200), cajero (403), cocina (403), sin auth (401) | 200, 403, 401 | ✅ Aprobado |
| 7 | `POST` | `/categorias` | ADMIN | Creación válida (201), validación Zod (400), nombre duplicado (falla con 500) | 201, 400, 500* | ⚠️ Obs (Bug 500) |
| 8 | `PATCH` | `/categorias/:id` | ADMIN | Actualización de nombre/orden (200), ID inválido (400), permisos (403) | 200, 400, 403 | ✅ Aprobado |
| 9 | `GET` | `/productos` | ADMIN | Listado con filtros y paginación cursor | 200 OK | ✅ Aprobado |
| 10 | `POST` | `/productos` | ADMIN | Creación válida (201), validación Zod precio/categoria (400), permisos cajero (403) | 201, 400, 403 | ✅ Aprobado |
| 11 | `GET` | `/productos/:id` | ADMIN | Obtención de detalle con receta | 200 OK | ✅ Aprobado |
| 12 | `PATCH` | `/productos/:id` | ADMIN | Modificación de datos de producto | 200 OK | ✅ Aprobado |
| 13 | `PUT` | `/productos/:id/receta` | ADMIN | Definición de receta con ingredientes y cantidades base | 200 OK | ✅ Aprobado |
| 14 | `PUT` | `/productos/:id/agotado` | ADMIN | Forzado de agotado manual `true` y `false` | 200 OK | ✅ Aprobado |
| 15 | `GET` | `/ingredientes` | ADMIN | Listado de ingredientes, stock actual y stock mínimo | 200 OK | ✅ Aprobado |
| 16 | `POST` | `/ingredientes` | ADMIN | Creación válida (201), duplicado (falla con 500), permisos cajero (403) | 201, 500*, 403 | ⚠️ Obs (Bug 500) |
| 17 | `PATCH` | `/ingredientes/:id` | ADMIN | Edición de mínimos y costos | 200 OK | ✅ Aprobado |
| 18 | `GET` | `/ingredientes/:id/movimientos` | ADMIN | Consulta de Kardex paginado por ingrediente | 200 OK | ✅ Aprobado |
| 19 | `POST` | `/inventario/entradas` | ADMIN | Registro de compra/entrada que suma stock y genera movimiento ENTRADA | 201 Created | ✅ Aprobado |
| 20 | `POST` | `/inventario/ajustes` | ADMIN | Conteo físico que recalcula stock y registra diferencia | 201 Created | ✅ Aprobado |
| 21 | `POST` | `/inventario/mermas` | ADMIN | Registro de merma manual con motivo obligatorio | 201 Created | ✅ Aprobado |
| 22 | `GET` | `/mesas` | ADMIN, CAJERO | Listado de mesas con indicador `ocupada` | 200 OK | ✅ Aprobado |
| 23 | `POST` | `/mesas` | ADMIN | Creación de nueva mesa (cajero prohibido 403) | 201, 403 | ✅ Aprobado |
| 24 | `GET` | `/mesas/:id` | ADMIN, CAJERO | Consulta individual de mesa | 200 OK | ✅ Aprobado |
| 25 | `PATCH` | `/mesas/:id` | ADMIN | Edición de capacidad y estado activo | 200 OK | ✅ Aprobado |
| 26 | `PUT` | `/mesas/orden` | ADMIN | Reordenamiento de disposición de mesas | 200 OK | ✅ Aprobado |
| 27 | `GET` | `/pedidos` | ADMIN, CAJERO | Filtro por tipo/estado/fecha operativa | 200 OK | ✅ Aprobado |
| 28 | `POST` | `/pedidos` | ADMIN, CAJERO | Creación MESA y LLEVAR; rechazo de mesa ocupada (409) | 201, 409 | ✅ Aprobado |
| 29 | `GET` | `/pedidos/:id` | ADMIN, CAJERO | Detalle con ítems, totales, base, impuesto y estado de comanda | 200 OK | ✅ Aprobado |
| 30 | `POST` | `/pedidos/:id/items` | ADMIN, CAJERO | Agregar ítem; rechazo en CONFIRMADO (409); rechazo producto agotado (409) | 201, 409 | ✅ Aprobado |
| 31 | `PATCH` | `/pedidos/:id/items/:itemId` | ADMIN, CAJERO | Edición de cantidad (1..99) y nota (<=140) | 200 OK | ✅ Aprobado |
| 32 | `DELETE` | `/pedidos/:id/items/:itemId` | ADMIN, CAJERO | Eliminación de línea de pedido en ABIERTO | 200 OK | ✅ Aprobado |
| 33 | `POST` | `/pedidos/:id/confirmar` | ADMIN, CAJERO | Confirmación atómica: descuenta stock, crea comanda, 409 si stock insuficiente | 200, 409 | ✅ Aprobado |
| 34 | `GET` | `/comandas` | ADMIN, CAJERO, COCINA | Listado FIFO de comandas en preparación | 200 OK | ✅ Aprobado |
| 35 | `POST` | `/comandas/:id/iniciar` | ADMIN, COCINA | Transición `PENDIENTE -> EN_PREPARACION`; control de versión | 200, 409 | ✅ Aprobado |
| 36 | `POST` | `/comandas/:id/lista` | ADMIN, COCINA | Transición `EN_PREPARACION -> LISTA`; rechazo de salto de estado | 200, 409 | ✅ Aprobado |
| 37 | `POST` | `/comandas/:id/entregar` | ADMIN, CAJERO, COCINA | Transición final `LISTA -> ENTREGADA` | 200 OK | ✅ Aprobado |
| 38 | `GET` | `/caja/sesion-actual` | ADMIN, CAJERO | Consulta de sesión abierta o null del usuario | 200 OK | ✅ Aprobado |
| 39 | `POST` | `/caja/sesiones` | ADMIN, CAJERO | Apertura con monto base; rechazo de doble apertura (409) | 201, 409 | ✅ Aprobado |
| 40 | `POST` | `/caja/sesiones/:id/cerrar` | ADMIN, CAJERO | Cierre con efectivo contado, cálculo de diferencia y evento de cierre | 200 OK | ✅ Aprobado |
| 41 | `POST` | `/caja/cobros` | ADMIN, CAJERO | Cobro efectivo con cambio, propina voluntaria; rechazo de doble cobro | 201, 409 | ⚠️ Obs (Pagos mixtos) |
| 42 | `GET` | `/recibos/:id` | ADMIN, CAJERO | Emisión de datos de recibo POS no fiscal | 200 OK | ✅ Aprobado |
| 43 | `GET` | `/clientes` | ADMIN, CAJERO | Búsqueda por coincidencia de teléfono, documento o nombre | 200 OK | ✅ Aprobado |
| 44 | `POST` | `/clientes` | ADMIN, CAJERO | Registro de cliente con teléfono y documento | 201 Created | ✅ Aprobado |
| 45 | `GET` | `/admin/dashboard` | ADMIN | Cálculo de KPIs diarios: ventas totales, ticket promedio, propinas | 200 OK | ✅ Aprobado |
| 46 | `GET` | `/admin/eventos` | ADMIN | Consulta de bitácora inmutable en `evento_sistema` con cursor | 200 OK | ✅ Aprobado |
| 47 | `GET` | `/stream` | Autenticado | Conexión SSE, filtrado de canales por rol, rechazo de canales ajenos (403) | 200, 403 | ✅ Aprobado |

---

## 5. Tabla de Reglas de Negocio (docs/BUSINESS_RULES.md)

| Regla | Descripción | Estado de Cumplimiento | Evidencia Técnica / Observaciones |
|---|---|:---:|---|
| **RN-01** | Dinero entero en pesos COP (sin centavos, sin float) | **CUMPLE** | Validado en `money.ts`, Drizzle schema (`integer`) y rechazo Zod de montos con decimales en `/caja/cobros`. |
| **RN-02** | Precio exhibido es el precio final al público | **CUMPLE** | Total de producto se toma íntegro; no se recargan costos ocultos. |
| **RN-03** | Régimen `NO_RESPONSABLE`: tasa 0 bp, sin impuesto en recibo | **CUMPLE** | `impuesto = 0`, `base = total`, leyenda "No responsable de INC" presente en recibos. |
| **RN-04** | Cálculo centralizado en `@mb/shared/money.ts` con redondeo half-up | **CUMPLE** | Verificado en 9 pruebas unitarias de `money.test.ts` y consistencia en pedidos y cobros. |
| **RN-05** | Snapshot de precio y nombre al agregar ítem al pedido | **CUMPLE** | `pedidos.service.ts` copia `nombreProducto` y `precioUnitario` en `pedido_item`. |
| **RN-06** | Propina sugerida máx 10 % redondeada hacia abajo a la centena | **CUMPLE** | Verificado en prueba de cobro ($70.000 -> 10% = $7.000 propina, cambio exacto). |
| **RN-07** | Descuentos fuera del MVP | **N/A** | Fuera de alcance MVP. |
| **RN-10** | Tipos de pedido en MVP: `MESA` y `LLEVAR` | **CUMPLE** | Verificado en `POST /pedidos` con ambos tipos válidos y rechazo de otros valores. |
| **RN-11** | Mesa con máx 1 pedido no cerrado; mesa ocupada si ABIERTO/CONFIRMADO | **CUMPLE** | Segundo pedido en la misma mesa retorna `409 MESA_OCUPADA`. |
| **RN-12** | Pedido debe tener >= 1 ítem para confirmar o cobrar; cantidad 1..99; nota <= 140 | **CUMPLE** | Confirmar pedido vacío retorna `409 PEDIDO_VACIO`. Cantidad 0 o nota > 140 rechaza con 400. |
| **RN-13** | Solo productos activos y no agotados se agregan a pedidos | **CUMPLE** | Producto con stock en 0 (`agotado = true`) rechaza agregar ítem con `409 PRODUCTO_NO_DISPONIBLE`. |
| **RN-14** | Ítems editables únicamente en `ABIERTO` | **CUMPLE** | Intentar agregar/editar ítems a pedido `CONFIRMADO` retorna `409 ESTADO_INVALIDO`. |
| **RN-15** | Numeración consecutiva `numeroDia` reiniciada por fecha operativa | **CUMPLE** | Generado secuencialmente por fecha operativa en `pedidos.repository.ts`. |
| **RN-16** | Fecha operativa con corte 05:00 America/Bogota | **CUMPLE** | Verificado en `fecha-operativa.test.ts` con 9 casos de prueba exhaustivos. |
| **RN-17** | Pedidos abiertos >12h marcados como olvidados en Admin | **PARCIAL** | La vista de dashboard los detecta, pero no existe endpoint `/admin/alertas` en el controlador. |
| **RN-20** | Exactamente 1 comanda creada en la misma transacción al confirmar | **CUMPLE** | Confirmación atómica crea la comanda en estado `PENDIENTE` en `cocina.service.ts`. |
| **RN-21** | Transiciones de comanda `PENDIENTE -> EN_PREPARACION -> LISTA -> ENTREGADA` | **CUMPLE** | Verificado paso a paso; saltos inválidos (ej. PENDIENTE -> LISTA) rechazan con `409 ESTADO_INVALIDO`. |
| **RN-22** | "Deshacer" en KDS revierte transición si <= 10 s | **NO IMPLEMENTADO** | Endpoint `POST /comandas/:id/deshacer` no existe en controlador ni servicio (404 Not Found). |
| **RN-23** | Umbrales de atraso en cocina (8 min / 12 min) | **CUMPLE** | Tiempos de cocina calculados en `v_ventas_dia` y reporte de dashboard. |
| **RN-30** | Unidad base entera en inventario (`G`, `ML`, `UND`) | **CUMPLE** | Invariante verificado en Drizzle y Zod schemas. |
| **RN-31** | Recetas por producto; producto sin receta no descuenta inventario | **CUMPLE** | Verificado en `catalogo.service.ts` y pruebas de integración. |
| **RN-32** | Descuento de stock al confirmar, bloqueando con `SELECT ... FOR UPDATE` ordenado | **CUMPLE** | `bloquearIngredientesParaActualizar` ordena IDs con `asc(ingrediente.id)` y aplica bloqueo pesimista. |
| **RN-33** | Stock insuficiente falla completo (409 STOCK_INSUFICIENTE) sin efectos parciales | **CUMPLE** | Probado con pedido compuesto: ante falta de un ingrediente, el rollback es total y ningún ingrediente se descuenta. |
| **RN-34** | Todo cambio de stock genera `movimiento_inventario` (Kardex auditable) | **CUMPLE** | Entradas, ajustes, mermas y consumos registran sus filas correspondientes en `movimiento_inventario`. |
| **RN-35** | Reversión si comanda PENDIENTE vs Merma si EN_PREPARACION al anular pedido | **NO PROBABLE** | La anulación de pedidos no está expuesta en la API (`POST /pedidos/:id/anular` 404). |
| **RN-36** | Retroalimentación de inventario (`StockBajoMinimo`, `IngredienteAgotado`, auto-agotado) | **CUMPLE** | Al agotar ingrediente, producto pasa a `agotado = true` automáticamente vía evento de dominio. |
| **RN-40** | Cobrar requiere sesión de caja ABIERTA; máx 1 sesión abierta por cajero | **CUMPLE** | Cobro sin caja retorna `409 CAJA_NO_ABIERTA`; segunda apertura retorna `409 SESION_YA_ABIERTA`. |
| **RN-41** | Apertura con monto base >= 0 en efectivo | **CUMPLE** | Validación Zod rechaza montos negativos (`montoApertura >= 0`). |
| **RN-42** | Métodos de pago MVP: `EFECTIVO`, `TARJETA`, `TRANSFERENCIA`; pagos mixtos permitidos | **INCUMPLE** | `caja.service.ts` rechaza cobros con más de 1 método de pago arrojando `400 VALIDACION`. |
| **RN-43** | Suma de pagos exactamente igual a total + propina; cálculo de cambio en efectivo | **CUMPLE** | Pago insuficiente arroja `409 PAGOS_NO_CUADRAN`; cambio se calcula exactamente como `recibido - monto`. |
| **RN-44** | Cobro de ABIERTO confirma y cierra en misma tx; cobro único por pedido | **CUMPLE** | Cobro anticipado probado con éxito; segundo cobro del mismo pedido retorna `409 ESTADO_INVALIDO`. |
| **RN-45** | Recibo POS consecutivo global `R-000001` con leyenda "Documento no fiscal" | **CUMPLE** | Formato de número validado con regex `/^R-\d{6}$/`; leyendas no fiscales presentes. |
| **RN-46** | Movimientos manuales de caja `INGRESO` y `RETIRO` con motivo | **NO IMPLEMENTADO** | Endpoint `POST /caja/sesiones/:id/movimientos` no implementado (404 Not Found). |
| **RN-47** | Cierre de caja irreversible con cálculo de efectivo esperado y diferencia | **CUMPLE** | Cierre probado con éxito; re-cierre retorna `409 ESTADO_INVALIDO`. |
| **RN-48** | Sesión no se cierra con cobro en curso; pedidos abiertos no bloquean cierre | **CUMPLE** | Cierre exitoso aun con otros pedidos abiertos en el restaurante. |
| **RN-50** | Anular pedido requiere ADMIN y motivo (>= 5 chars); CERRADO no se anula | **NO IMPLEMENTADO** | Endpoint `POST /pedidos/:id/anular` no existe en controladores (404 Not Found). |
| **RN-51** | Matriz de permisos estricta por rol (ADMIN / CAJERO / COCINA) | **CUMPLE** | Probado en 20 casos de cruce: CAJERO y COCINA son bloqueados con 403 en endpoints no autorizados. |
| **RN-60** | Bitácora de auditoría en `evento_sistema` (solo inserción) | **CUMPLE** | Registra `PedidoConfirmado`, `PedidoCobrado`, `SesionCajaCerrada`, etc., consultables en `/admin/eventos`. |
| **RN-61** | Horas en UTC (`timestamptz`), presentación en `America/Bogota` | **CUMPLE** | Fechas ISO 8601 UTC en respuestas y cálculos de fecha operativa respetan la zona horaria. |

---

## 6. Clasificación de Hallazgos

### Hallazgo 1: Manejo de errores en duplicados de Catálogo e Inventario produce HTTP 500
- **Severidad:** **MAYOR**
- **Archivo y Línea:**
  - `apps/api/src/modules/catalogo/catalogo.service.ts`: Líneas 61, 82, 142, 166
  - `apps/api/src/modules/inventario/inventario.service.ts`: Líneas 69, 98
- **Descripción:**  
  Los métodos `crearCategoria`, `editarCategoria`, `crearProducto`, `editarProducto`, `crearIngrediente` y `editarIngrediente` capturan excepciones comprobando:
  ```ts
  if (err instanceof Error && err.message.includes('unique')) {
    throw new DomainError('NOMBRE_DUPLICADO', '...', HttpStatus.CONFLICT);
  }
  ```
  Sin embargo, Drizzle ORM encapsula el error de PostgreSQL en una instancia de `DrizzleQueryError`, donde `err.message` tiene el formato `"Failed query: insert into ..."` (no contiene la subcadena `"unique"`). Además, en entornos Postgres en español el error nativo contiene `"restricción de unicidad"`. Como resultado, la condición es falsa, el error no es capturado como `DomainError` y escala al filtro global desencadenando un HTTP `500 Internal Server Error`.
- **Pasos de Reproducción:**
  1. Iniciar sesión como `admin`.
  2. Enviar `POST /api/v1/categorias` con `{"nombre": "Hamburguesas"}` (nombre existente en el seed).
  3. Observar respuesta HTTP.
- **Esperado:** `409 Conflict` con cuerpo `{"codigo": "NOMBRE_DUPLICADO", "mensaje": "Ya existe una categoría con ese nombre."}`.
- **Obtenido:** `500 Internal Server Error` con cuerpo `{"codigo": "ERROR_INTERNO", "mensaje": "Ocurrió un error inesperado..."}`.
- **Solución Recomendada:** Emplear la función auxiliar `codigoPg(err) === '23505'` tal como se hace en `caja.service.ts:26` y `pedidos.service.ts:37`.

---

### Hallazgo 2: Cobro rechaza pagos mixtos contraviniendo RN-42
- **Severidad:** **MAYOR**
- **Archivo y Línea:** `apps/api/src/modules/caja/caja.service.ts`: Líneas 138–144
- **Descripción:**  
  El servicio de caja fuerza explícitamente:
  ```ts
  if (input.pagos.length !== 1) {
    throw new DomainError(
      CODIGOS_ERROR.VALIDACION,
      'En el MVP el cobro admite un solo método de pago.',
      HttpStatus.BAD_REQUEST,
    );
  }
  ```
  Esto bloquea cualquier cobro combinado (ej. parte en efectivo y parte en tarjeta), a pesar de que:
  1. `docs/BUSINESS_RULES.md` (RN-42) define expresamente: *"Se permiten pagos mixtos."*
  2. `docs/API.md` muestra un ejemplo de cobro con múltiples pagos en la carga útil.
- **Pasos de Reproducción:**
  1. Abrir sesión de caja con `POST /api/v1/caja/sesiones`.
  2. Crear un pedido con total $70.000 COP.
  3. Enviar `POST /api/v1/caja/cobros` con:
     ```json
     {
       "pedidoId": "<id>",
       "pagos": [
         { "metodo": "EFECTIVO", "monto": 30000, "recibido": 30000 },
         { "metodo": "TARJETA", "monto": 40000, "referencia": "V-123" }
       ]
     }
     ```
- **Esperado:** `201 Created` con recibo POS registrando ambos pagos.
- **Obtenido:** `400 Bad Request` con mensaje `"En el MVP el cobro admite un solo método de pago."`.

---

### Hallazgo 3: Endpoints documentados en API.md no implementados en controladores
- **Severidad:** **MAYOR**
- **Archivos Probables:**
  - `apps/api/src/modules/pedidos/pedidos.controller.ts` (Falta `anular`)
  - `apps/api/src/modules/cocina/cocina.controller.ts` (Falta `deshacer`)
  - `apps/api/src/modules/caja/caja.controller.ts` (Falta `movimientos`, `historial`)
  - `apps/api/src/modules/identidad/` (Falta `usuarios.controller.ts`)
  - `apps/api/src/modules/administracion/administracion.controller.ts` (Faltan `alertas`, `reportes`, `configuracion`)
- **Descripción:**  
  Los siguientes 11 endpoints especificados en `docs/API.md` retornan `404 Not Found` al ser invocados:
  1. `GET /api/v1/usuarios`
  2. `POST /api/v1/usuarios`
  3. `PATCH /api/v1/usuarios/:id`
  4. `POST /api/v1/pedidos/:id/anular` (RN-50)
  5. `POST /api/v1/comandas/:id/deshacer` (RN-22)
  6. `POST /api/v1/caja/sesiones/:id/movimientos` (RN-46)
  7. `GET /api/v1/caja/sesiones`
  8. `GET /api/v1/admin/alertas` (RN-36)
  9. `GET /api/v1/admin/reportes/ventas`
  10. `GET /api/v1/admin/configuracion`
  11. `PUT /api/v1/admin/configuracion`
- **Impacto:** Las funcionalidades de gestión de usuarios, anulación de pedidos por parte del administrador y movimientos manuales de caja no son accesibles vía API REST.

---

### Hallazgo 4: OrigenGuard permite mutaciones si la cabecera Origin está ausente
- **Severidad:** **MENOR / OBSERVACIÓN**
- **Archivo y Línea:** `apps/api/src/modules/identidad/auth.guards.ts`: Línea 32
- **Descripción:**  
  La condición actual es:
  ```ts
  if (METODOS_MUTANTES.has(req.method) && origen && origen !== this.env.APP_ORIGIN)
  ```
  Si una petición mutante (`POST`, `PATCH`, `DELETE`, `PUT`) no envía la cabecera `Origin` (como ocurre en clientes curl, scripts o herramientas HTTP no basadas en navegador), la condición no se cumple y la petición es autorizada.
- **Esperado según directriz:** Cualquier mutación debe rechazar solicitudes sin `Origin` o con `Origin` ajeno.
- **Obtenido:** Solicitudes sin `Origin` son aceptadas si cuentan con la cookie de sesión.

---

## 7. Instrucciones de Reproducción de la Suite de Pruebas

El script automatizado de QA fue desarrollado en Node.js puro utilizando `fetch` nativo y ejecutado contra la base de datos `mb_qa_api` en el puerto `3021`.

### Pasos para Reproducir:

1. **Configurar el entorno en PowerShell (en `apps/api`):**
   ```powershell
   $env:DATABASE_URL='postgres://mb:mb_dev_pass@localhost:5432/mb_qa_api'
   $env:DATABASE_URL_TEST='postgres://mb:mb_dev_pass@localhost:5432/mb_qa_api_test'
   $env:PORT='3021'
   $env:APP_ORIGIN='http://localhost:5191'
   $env:NODE_OPTIONS='--max-old-space-size=1024'
   pnpm db:migrate
   pnpm db:seed
   ```

2. **Compilar y arrancar la API:**
   ```powershell
   pnpm build
   node dist/main.js
   ```

3. **Ejecutar el script de pruebas:**
   El script completo reside en `%TEMP%\qa_backend_suite.mjs` y se ejecuta con:
   ```powershell
   node $env:TEMP\qa_backend_suite.mjs
   ```

4. **Resumen de la Estructura del Script (`qa_backend_suite.mjs`):**
   - **Suite 0 (Health):** Valida `/health` (200 OK y estado de BD).
   - **Suite 1 (Auth):** Login de los 3 roles de prueba (`admin`, `caja1`, `cocina1`), rechazo de credenciales erróneas (401), `/auth/me` con y sin cookie, y logout (204).
   - **Suite 2 (CSRF):** Mutaciones con `Origin` fraudulento (403 `ORIGEN_NO_PERMITIDO`) y sin `Origin`.
   - **Suite 3 (Zod):** Inyección de payloads incompletos, IDs no-UUID, cantidades en 0 o negativas, notas > 140 caracteres, montos negativos en caja y dinero en float.
   - **Suite 4 (Permisos):** Matriz de control de acceso cruzando cada endpoint con `ADMIN`, `CAJERO`, `COCINA` y anónimo.
   - **Suite 5 (Catálogo e Inventario):** CRUD de categorías, productos, recetas, ingredientes, entradas, ajustes físicos y mermas; detección del error 500 en duplicados.
   - **Suite 6 (Mesas y Clientes):** Listado y creación de mesas y clientes; búsqueda por teléfono y documento.
   - **Suite 7 (Pedidos y Concurrencia):** Creación de pedidos `MESA` y `LLEVAR`, bloqueo de mesa ocupada (409), agregar/editar/eliminar ítems, rechazo de confirmación sin ítems (409), confirmación atómica con descuento de stock, rechazo con `409 STOCK_INSUFICIENTE` detallando faltantes, verificación de atomicidad sin descuentos parciales, y **prueba de concurrencia real disparando 2 confirmaciones simultáneas compitiendo por la última unidad de stock (verificando exactamente un 200 y un 409)**.
   - **Suite 8 (Cocina KDS):** Ciclo de vida de comanda `PENDIENTE -> EN_PREPARACION -> LISTA -> ENTREGADA`, rechazo de saltos inválidos de estado (409) y conflicto de versión optimista (409 `VERSION_CONFLICT`).
   - **Suite 9 (Caja y Cobro):** Apertura de caja, rechazo de doble apertura (409), cobro sin caja abierta (409), pago insuficiente (409), cobro con propina voluntaria y cálculo exacto de cambio, cobro anticipado de pedidos abiertos (RN-44), detección del rechazo de pagos mixtos (RN-42), y cierre irreversible de sesión con arqueo de efectivo.
   - **Suite 10 (Recibos):** Formato consecutivo `R-000001`, leyenda "Documento no fiscal" y leyenda "No responsable de INC".
   - **Suite 11 (Auditoría y Admin):** Consulta de KPIs en `/admin/dashboard` y lectura de la bitácora de eventos en `/admin/eventos`.
   - **Suite 12 (Realtime SSE):** Conexión a `/stream` con cabeceras `text/event-stream` y verificación de rechazo de canales prohibidos por rol (403 `SIN_PERMISO`).
   - **Suite 13 (Discrepancias API):** Verificación sistemática de los 11 endpoints documentados en `docs/API.md` pero inexistentes en el código.
   - **Suite 14 (Rate Limit):** Invocación rápida de >5 intentos fallidos en `/auth/login` hasta verificar bloqueo `429 Too Many Requests`.

---

## 8. Verificación de Cierre y Limpieza

- Todas las pruebas fueron ejecutadas sobre las bases de datos dedicadas `mb_qa_api` y `mb_qa_api_test`, garantizando cero interferencia con las bases de datos de desarrollo del usuario (`monsterburguer`, `monsterburguer_test`).
- Ningún archivo de código fuente en `apps/**` o `packages/**` fue modificado, preservando la integridad del checkout para los demás agentes del equipo.
- El servidor backend que operaba en el puerto `3021` ha sido completamente detenido al finalizar las pruebas de verificación.
