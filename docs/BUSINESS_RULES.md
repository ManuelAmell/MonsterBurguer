# Reglas de Negocio — MonsterBurguer POS

> **Fuente de verdad de las reglas de negocio del sistema.**  
> Cada regla está identificada con su código unívoco (`RN-xx`), clasificada por su estado de implementación en el código real (**Implementada**, **Parcial**, **Pendiente**) y vinculada al archivo que la ejecuta o valida.

---

## 1. Dinero e Impuestos

| ID | Regla | Estado | Archivo / Implementación | Detalle y Observaciones |
|---|---|:---:|---|---|
| **RN-01** | La moneda es **COP**. Todos los montos se calculan y persisten como **enteros en pesos** sin centavos. Prohibido usar `float` para dinero. | **Implementada** | `packages/shared/src/money.ts`<br>`apps/api/src/modules/caja/caja.service.ts` | Base de datos usa `bigint`; esquemas Zod validan `.int().positive()` o `.nonnegative()`. |
| **RN-02** | El precio exhibido en el menú es el **precio final al público** en pesos con todo incluido (Ley 1480 de 2011, art. 26). | **Implementada** | `packages/shared/src/schemas/catalogo.ts`<br>`apps/api/src/modules/catalogo/catalogo.service.ts` | Validado en `crearProductoSchema` y presentado en la grilla del POS sin cargos ocultos. |
| **RN-03** | **Régimen tributario: `NO_RESPONSABLE`** (no responsable del INC, art. 512-13 E.T.) → tasa 0 (`impuesto_tasa_bp = 0`). UI y recibo no desglosan impuesto. Parametrizable en caliente para `INC_8` (8 %) o `IVA_19` (19 %). | **Implementada** | `apps/api/src/shared-kernel/configuracion/configuracion.schema.ts`<br>`apps/api/src/modules/caja/caja.service.ts`<br>`apps/web/src/components/pos/ticket-summary.tsx` | La UI evalúa `tasaBp > 0` antes de pintar la línea de impuesto. Snapshot guardado en cada recibo. |
| **RN-04** | Aritmética del pedido: `total_linea = precio_unitario × cantidad`; `total = Σ total_linea`; `base = round(total × 10000 / (10000 + tasa_bp))`; `impuesto = total − base`. Redondeo *half-up* al peso. | **Implementada** | `packages/shared/src/money.ts` (`calcularTotales`)<br>`packages/shared/src/money.test.ts` | Implementado como función pura compartida; probado con pedidos de $49.700. |
| **RN-05** | El precio del producto se **copia** al ítem del pedido al agregarlo (snapshot de nombre y precio). Cambios posteriores de catálogo no alteran pedidos creados. | **Implementada** | `apps/api/src/modules/pedidos/pedidos.service.ts:agregarItem` | Copia `nombreProducto` y `precioUnitario` en la fila `pedido_item`. |
| **RN-06** | **Propina voluntaria** (Ley 1935 de 2018), solo en pedidos de tipo `MESA`: sugerida máx. 10 % de la base antes de impuestos, **redondeada hacia abajo a la centena**. Nunca preseleccionada. | **Implementada** | `packages/shared/src/money.ts` (`propinaSugerida`)<br>`apps/web/src/features/pos/cobro-dialog.tsx`<br>`apps/api/src/modules/caja/caja.service.ts:cobrar` | Si `tipo === 'LLEVAR'`, propina es 0. Diálogo de cobro pregunta explícitamente y requiere confirmación. |
| **RN-07** | Descuentos y cortesías: **fuera del alcance del MVP**. | **Implementada** | N/A (por diseño) | El modelo no incluye campos ni tablas de descuentos en la versión actual. |

---

## 2. Pedidos (POS)

| ID | Regla | Estado | Archivo / Implementación | Detalle y Observaciones |
|---|---|:---:|---|---|
| **RN-10** | Tipos de pedido en MVP: `MESA` y `LLEVAR`. (`DOMICILIO` reservado para v1.2). | **Implementada** | `packages/shared/src/enums.ts`<br>`apps/api/src/modules/pedidos/pedidos.schema.ts` | Restricción CHECK en tabla `pedido` y validación en `crearPedidoSchema`. |
| **RN-11** | Un pedido `MESA` requiere mesa asignada. Una mesa solo puede tener **un pedido no cerrado** a la vez. Mesa está ocupada si tiene pedido `ABIERTO` o `CONFIRMADO`. | **Implementada** | `apps/api/src/modules/pedidos/pedidos.schema.ts` (`pedido_mesa_activa_uq`)<br>`apps/api/src/modules/pedidos/pedidos.service.ts:crearPedido` | Índice único parcial en PostgreSQL impide duplicidad de pedidos activos sobre la misma mesa. |
| **RN-12** | Un pedido debe tener ≥ 1 ítem para confirmarse o cobrarse. Cantidad por ítem: 1 a 99. Nota culinaria: máx. 140 caracteres. | **Implementada** | `packages/shared/src/schemas/pedidos.ts`<br>`apps/api/src/modules/pedidos/pedidos.service.ts:confirmarBloqueado` | Valida `items.length > 0` arrojando error `PEDIDO_VACIO` si el ticket no contiene ítems. |
| **RN-13** | Solo se pueden agregar al ticket productos **activos y no agotados**. | **Implementada** | `apps/api/src/modules/pedidos/pedidos.service.ts:agregarItem`<br>`apps/web/src/components/pos/product-tile.tsx` | Valida en backend que el producto esté activo y no agotado; frontend deshabilita el botón con badge "Agotado". |
| **RN-14** | Ítems editables únicamente en estado `ABIERTO`. Para cambiar un pedido `CONFIRMADO` en el MVP se debe anular y crear otro. | **Implementada** | `apps/api/src/modules/pedidos/pedidos.service.ts:bloquearAbierto` | Lanzamiento de excepción `ESTADO_INVALIDO` si el estado difiere de `ABIERTO`. |
| **RN-15** | Numeración: `id` global (UUID v7) + `numero_dia` consecutivo que se reinicia cada fecha operativa (lo que se grita en cocina: "#014"). | **Implementada** | `apps/api/src/modules/pedidos/pedidos.repository.ts:siguienteNumeroDia` | Tabla `contador_dia` con incremento atómico `UPDATE ... RETURNING ultimo_numero`. |
| **RN-16** | **Fecha operativa:** un día de negocio va de 05:00 a 04:59 del día siguiente (`America/Bogota`), evitando que el corte de medianoche fracture turnos. | **Implementada** | `packages/shared/src/fecha-operativa.ts`<br>`packages/shared/src/fecha-operativa.test.ts` | Calculada mediante `Intl.DateTimeFormat` configurado en `America/Bogota` y probada con múltiples zonas horarias. |
| **RN-17** | Pedido `ABIERTO` sin actividad por más de 12 horas se marca como "olvidado" en administración (no se anula solo). | **Implementada** | `apps/api/drizzle/0006_vistas_reportes.sql` (`v_pedidos_olvidados`)<br>`apps/api/src/modules/administracion/administracion.service.ts:obtenerAlertas`<br>`apps/web/src/features/admin/dashboard-page.tsx` | Vista SQL filtra pedidos en estado `ABIERTO` con `updated_at < NOW() - INTERVAL '12 hours'`. Servicio expone la alerta con severidad `INFO` y el Dashboard web cuenta con widget de alertas del sistema con acceso directo. |

---

## 3. Cocina (KDS)

| ID | Regla | Estado | Archivo / Implementación | Detalle y Observaciones |
|---|---|:---:|---|---|
| **RN-20** | Al confirmar un pedido se crea **exactamente una comanda** en la misma transacción relacional. | **Implementada** | `apps/api/src/modules/pedidos/pedidos.service.ts:confirmarBloqueado`<br>`apps/api/src/modules/cocina/cocina.service.ts:crearComanda` | La comanda se inserta pasando el objeto `tx` de la transacción activa de pedidos. |
| **RN-21** | Transiciones válidas de comanda: `PENDIENTE → EN_PREPARACION → LISTA → ENTREGADA`; `ANULADA` solo ante cancelación del pedido. | **Implementada** | `apps/api/src/modules/cocina/cocina.service.ts:transicionar` | Máquina de estados en el servicio valida `desde` y `hacia`; registra marcas de tiempo `iniciada_at`, `lista_at`, `entregada_at`. |
| **RN-22** | "Deshacer" en KDS revierte la última transición de comanda si ocurrió hace ≤ 10 segundos. | **Implementada** | `apps/api/src/modules/cocina/cocina.service.ts:deshacer`<br>`apps/api/src/modules/cocina/cocina.controller.ts:deshacer`<br>`apps/web/src/features/cocina/cocina-page.tsx`<br>`apps/api/test/pedidos-anular-deshacer.spec.ts` | Endpoint `POST /comandas/:id/deshacer` con verificación de tiempo en servidor (≤ 10 s), control optimista de versión y reversión de timestamps. Barra flotante con temporizador y botón táctil ≥ 48 px en KDS. Emite `ComandaDeshecha`. |
| **RN-23** | Tiempo de preparación = `lista_at − created_at`. Umbrales visuales de atraso: **8 min** (aviso/naranja) y **12 min** (grave/rojo). | **Implementada** | `apps/api/src/modules/administracion/administracion.service.ts:tiemposCocina`<br>`apps/web/src/components/kds/kds-ticket-card.tsx` | La vista SQL `v_tiempos_cocina` calcula promedios y percentil 90; la tarjeta KDS aplica clases de advertencia según minutos transcurridos. |

---

## 4. Inventario

| ID | Regla | Estado | Archivo / Implementación | Detalle y Observaciones |
|---|---|:---:|---|---|
| **RN-30** | Cada ingrediente tiene una **unidad base entera**: `G` (gramos), `ML` (mililitros) o `UND` (unidades). Stock, mínimos y recetas en esa unidad. | **Implementada** | `packages/shared/src/enums.ts`<br>`apps/api/src/modules/inventario/inventario.schema.ts` | Restricción CHECK en base de datos; cero almacenamiento en fracciones de kilo o litro. |
| **RN-31** | Cada producto tiene una receta (ingrediente + cantidad en unidad base). Productos sin receta no descuentan stock. | **Implementada** | `apps/api/src/modules/catalogo/catalogo.service.ts:actualizarReceta`<br>`apps/api/src/modules/inventario/inventario.service.ts:consumir` | Mapeo de `receta_item` consumido durante la confirmación; si el producto no tiene receta se omite el descuento. |
| **RN-32** | El consumo de inventario se descuenta **al confirmar** el pedido (no al cobrar), en la misma transacción, bloqueando con `SELECT ... FOR UPDATE` ordenado por `id`. | **Implementada** | `apps/api/src/modules/inventario/inventario.service.ts:consumir`<br>`apps/api/src/modules/inventario/inventario.repository.ts:bloquearIngredientesParaActualizar` | Ordenamiento por ID previene deadlocks concurrentes cuando dos terminales confirman pedidos con ingredientes compartidos. |
| **RN-33** | Si algún ingrediente no alcanza, la confirmación **falla completa** (HTTP 409 `STOCK_INSUFICIENTE`) indicando los faltantes. Configurable con `permitir_stock_negativo`. | **Implementada** | `apps/api/src/modules/inventario/inventario.service.ts:consumir` | Retorna detalle estructurado con `requerido`, `disponible` y `unidad` para cada ingrediente faltante. |
| **RN-34** | Todo cambio de stock genera un `movimiento_inventario` (`CONSUMO`, `ENTRADA`, `AJUSTE`, `MERMA`, `REVERSION`) con cantidad con signo, usuario y referencia. Prohibido editar stock sin movimiento. | **Implementada** | `apps/api/src/modules/inventario/inventario.service.ts`<br>`apps/api/src/modules/inventario/inventario.repository.ts` | `stock_resultante` se calcula y persiste en cada inserción del kardex. |
| **RN-35** | Reversión de stock: si se anula con comanda `PENDIENTE`, movimiento `REVERSION` (retorna stock). Si estaba `EN_PREPARACION` o posterior, movimiento `MERMA` (merma física). | **Implementada** | `apps/api/src/modules/pedidos/pedidos.service.ts:anular`<br>`apps/api/src/modules/inventario/inventario.service.ts:revertir`<br>`apps/api/src/modules/inventario/inventario.service.ts:reclasificarConsumoComoMerma`<br>`apps/api/test/pedidos-anular-deshacer.spec.ts` | Al anular con comanda `PENDIENTE`, ejecuta `revertir` (movimiento `REVERSION`, retorna stock físico, reevalúa disponibilidad y emite `IngredienteRepuesto` si supera el mínimo). Con comanda `EN_PREPARACION` o posterior, ejecuta `reclasificarConsumoComoMerma` (par `REVERSION` + `MERMA`, stock neto 0, trazabilidad completa de merma en kardex). |
| **RN-36** | **Retroalimentación automática:** si un ingrediente cae por debajo de su `stock_minimo` se emite `StockBajoMinimo`. Si no alcanza para elaborar un producto, se marca `producto.agotado = true` automáticamente. Entrada lo repone. | **Implementada** | `apps/api/src/modules/inventario/inventario.service.ts:reevaluarDisponibilidadProductos`<br>`apps/api/src/modules/catalogo/catalogo.service.ts:actualizarAgotadoManual` | Al registrar consumo o entrada, se recalculan las recetas y se emite el evento SSE `catalogo.disponibilidad`. |

---

## 5. Caja y Cobros

| ID | Regla | Estado | Archivo / Implementación | Detalle y Observaciones |
|---|---|:---:|---|---|
| **RN-40** | Para cobrar, el cajero debe tener una **sesión de caja ABIERTA**. Máximo una sesión abierta simultánea por cajero. | **Implementada** | `apps/api/src/modules/caja/caja.schema.ts` (`sesion_caja_abierta_usuario_uq`)<br>`apps/api/src/modules/caja/caja.service.ts:cobrar` | Índice parcial en base de datos impide duplicidad; el cobro lanza `CAJA_NO_ABIERTA` si no hay sesión abierta. |
| **RN-41** | Apertura de caja con monto base en efectivo (`montoApertura >= 0`). | **Implementada** | `packages/shared/src/schemas/caja.ts`<br>`apps/api/src/modules/caja/caja.service.ts:abrir` | Validado por esquema Zod y restricción CHECK en base de datos. |
| **RN-42** | Métodos de pago del MVP: `EFECTIVO`, `TARJETA`, `TRANSFERENCIA`. Pagos mixtos. | **Parcial** | `packages/shared/src/enums.ts`<br>`apps/api/src/modules/caja/caja.service.ts:cobrar` | Los 3 métodos existen y se registran en BD, pero el código del MVP restringe estrictamente a **un único método de pago por cobro** (`pagos.length === 1`). Pagos mixtos en backlog. |
| **RN-43** | La suma de pagos debe ser exactamente `total + propina`. En efectivo: `recibido >= monto` y `cambio = recibido − monto`. Máximo un pago en efectivo por recibo. | **Implementada** | `apps/api/src/modules/caja/caja.service.ts:cobrar`<br>`apps/api/src/modules/caja/caja.schema.ts` (`pago_efectivo_por_recibo_uq`) | Valida montos contra la cuenta y calcula vueltas exactas. Índice único parcial en BD impide múltiples líneas de efectivo. |
| **RN-44** | Cobrar un pedido `ABIERTO` lo confirma (descontando stock y creando comanda) y lo cierra en la **misma transacción**. Un pedido solo se cobra una vez (recibo único). | **Implementada** | `apps/api/src/modules/caja/caja.service.ts:cobrar`<br>`apps/api/src/modules/pedidos/pedidos.service.ts:prepararCobro` | Ejecutado de forma atómica en `caja.service.ts`. La columna `recibo.pedido_id` tiene restricción `UNIQUE`. |
| **RN-45** | Cada cobro genera un **recibo POS** con consecutivo global (`R-000001`). Rotulado obligatorio como "Documento no fiscal" y "No responsable de INC". | **Implementada** | `apps/api/src/modules/caja/caja.service.ts:obtenerRecibo`<br>`apps/web/src/features/pos/recibo.tsx` | Secuencia `recibo_numero_seq` y plantilla CSS `@media print` a 80 mm. |
| **RN-46** | Movimientos manuales de caja: `INGRESO` y `RETIRO` con motivo obligatorio (3 a 140 caracteres). Solo en sesión `ABIERTA` y del propio cajero (`ADMIN` en cualquiera). Un `RETIRO` no puede dejar el efectivo esperado en negativo (`409 EFECTIVO_INSUFICIENTE`). | **Implementada** | `apps/api/src/modules/caja/caja.service.ts:registrarMovimiento`<br>`apps/web/src/features/caja/movimientos.tsx`<br>`apps/api/test/caja.spec.ts` | Tabla `movimiento_caja` (migración 0004); publica `MovimientoCajaRegistrado`. |
| **RN-47** | Cierre de caja: `efectivo_esperado = montoApertura + ventasEfectivo + ingresos - retiros`. Cajero digita `efectivo_contado`; `diferencia = contado − esperado`. Cierre irreversible emite `SesionCajaCerrada`. | **Implementada** | `apps/api/src/modules/caja/caja.service.ts:cerrar`<br>`apps/web/src/features/caja/caja-page.tsx`<br>`apps/web/src/features/caja/historial-cierres.tsx` | Guarda arqueo en `sesion_caja`, pasa a `CERRADA`, emite evento al outbox e incluye ingresos y retiros en resumen e historial. |
| **RN-48** | Una sesión no puede cerrarse con cobro en curso. Pedidos abiertos no bloquean el cierre. | **Implementada** | `apps/api/src/modules/caja/caja.service.ts:cerrar` | Cierre validado a nivel de sesión del cajero. |

---

## 6. Permisos y Seguridad

| ID | Regla | Estado | Archivo / Implementación | Detalle y Observaciones |
|---|---|:---:|---|---|
| **RN-50** | Anular un pedido requiere rol `ADMIN` y motivo obligatorio (mín. 5 caracteres). Pedidos `CERRADO` no se anulan en MVP. | **Implementada** | `apps/api/src/modules/pedidos/pedidos.service.ts:anular`<br>`apps/api/src/modules/pedidos/pedidos.controller.ts:anular`<br>`apps/web/src/features/pos/anular-pedido-dialog.tsx`<br>`apps/web/src/features/pos/pos-page.tsx`<br>`apps/api/test/pedidos-anular-deshacer.spec.ts` | Endpoint `POST /pedidos/:id/anular` protegido por `@Roles('ADMIN')`, valida estado `ABIERTO` o `CONFIRMADO` (rechaza `CERRADO`), motivo obligatorio (5 a 500 caracteres) y versión optimista. Diálogo accesible en POS con advertencia de impacto en inventario. Emite `PedidoAnulado`. |
| **RN-51** | Matriz de permisos RBAC: `ADMIN` (total), `CAJERO` (pedidos, mesas, cobro, caja), `COCINA` (comandas KDS). | **Implementada** | `apps/api/src/modules/identidad/auth.guards.ts` (`RolesGuard`)<br>`apps/web/src/features/auth/guards.tsx` | Validado en cada controlador backend y en el router de React (`RequiereRol`). |

---

## 7. Auditoría y Trazabilidad

| ID | Regla | Estado | Archivo / Implementación | Detalle y Observaciones |
|---|---|:---:|---|---|
| **RN-60** | Toda transición de estado y acción sensible queda registrada en `evento_sistema` con usuario, timestamp y payload inmutable. | **Implementada** | `apps/api/src/shared-kernel/events/event-bus.ts`<br>`apps/api/src/modules/administracion/administracion.service.ts:eventos` | Bitácora de solo inserción con canal NOTIFY y despacho outbox post-commit. |
| **RN-61** | Las horas se guardan en UTC (`timestamptz`) y se muestran en zona horaria local `America/Bogota`. | **Implementada** | `apps/api/src/shared-kernel/db/db.ts`<br>`apps/web/src/lib/format.ts`<br>`apps/web/src/features/cocina/cocina-page.tsx` | Formateadores en frontend y vistas SQL ajustan con `AT TIME ZONE 'America/Bogota'`. |
