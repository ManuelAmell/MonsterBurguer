# Reglas de negocio — MonsterBurguer POS

> Reglas que el código **debe** respetar. Cada regla tiene un identificador (`RN-xx`) que se cita en tests y en PRs. Los valores marcados como *configurable* viven en la tabla `configuracion` y se editan desde Admin.

## 1. Dinero e impuestos

| ID | Regla |
|---|---|
| RN-01 | La moneda es **COP**. Todos los montos se guardan y calculan como **enteros en pesos** (sin centavos). Nunca se usan `float` para dinero. |
| RN-02 | El precio exhibido en el menú es el **precio final al público** en pesos, con todo incluido (Ley 1480 de 2011, art. 26). El cliente nunca paga más que el precio exhibido (salvo la propina que acepte). |
| RN-03 | **Régimen tributario: `NO_RESPONSABLE`** (no responsable del INC, art. 512-13 E.T.: persona natural, ingresos < 3.500 UVT, un solo establecimiento) → **no se cobra ni se discrimina impuesto** (`impuesto_tasa_bp = 0`). Si la tasa es 0, la UI y el recibo **no muestran línea de impuesto**. *Configurable para el futuro:* `regimen_tributario ∈ {NO_RESPONSABLE, INC_8, IVA_19}` → tasa 0 / 800 / 1900 puntos básicos (`IVA_19` aplica a restaurantes bajo franquicia). |
| RN-04 | Cálculo de un pedido (implementado una sola vez en `@mb/shared/money.ts`): `total_linea = precio_unitario × cantidad`; `total = Σ total_linea`; `base = round(total × 10000 / (10000 + tasa_bp))`; `impuesto = total − base`. Redondeo **half-up** al peso. El impuesto se calcula sobre el total del pedido, no por línea. Con tasa 0: `base = total`, `impuesto = 0`. |
| RN-05 | El precio del producto se **copia** al ítem del pedido al agregarlo (snapshot de nombre y precio). Cambios posteriores de precio no alteran pedidos existentes. |
| RN-06 | **Propina** (Ley 1935 de 2018), solo en pedidos de tipo MESA: es **voluntaria**; la sugerida es como máximo el **10 % del valor antes de impuestos** (`base`), **redondeada hacia abajo** a la centena (así nunca supera el 10 %). Al cobrar, el cajero **pregunta** si el cliente la acepta, la cambia o la rechaza; nunca está preseleccionada ni se suma automáticamente. Se registra aparte del total de venta y no hace parte de la base de ningún impuesto. El menú/local debe informar que la propina es voluntaria. *Configurable:* `propina_sugerida_bp = 1000` (máx. 1000). |
| RN-07 | Descuentos: **fuera del MVP**. |

Ejemplos verificados (tests obligatorios):
- Régimen `NO_RESPONSABLE`: pedido de $49.700 → base $49.700, impuesto $0, total $49.700; propina sugerida $4.900 (10 % = $4.970 → hacia abajo a la centena).
- Régimen `INC_8` (futuro): pedido de $49.700 → base $46.019, INC $3.681; propina sugerida $4.600.

> ⚖️ **Pendiente legal (fuera del MVP):** desde 2024 la DIAN exige soportar cada venta con **Documento Equivalente Electrónico POS** (CUDE + QR) o factura electrónica, y factura electrónica si el cliente la pide. El MVP emite un recibo interno "no fiscal" para llevar las cuentas; la integración con un proveedor tecnológico es requisito antes de operar formalmente (ver PRD §4, v2).

## 2. Pedidos

| ID | Regla |
|---|---|
| RN-10 | Tipos de pedido en MVP: `MESA` y `LLEVAR`. (`DOMICILIO` en v1.1.) |
| RN-11 | Un pedido `MESA` requiere mesa; una mesa solo puede tener **un pedido no cerrado** a la vez (índice único parcial en BD). La mesa está "ocupada" si tiene un pedido `ABIERTO` o `CONFIRMADO`; no se guarda un estado de mesa aparte. |
| RN-12 | Un pedido debe tener ≥ 1 ítem para confirmarse o cobrarse. Cantidad por ítem: 1 a 99. Nota por ítem: máx. 140 caracteres. |
| RN-13 | Solo se agregan productos **activos y no agotados**. |
| RN-14 | Ítems editables únicamente en estado `ABIERTO`. Para cambiar un pedido `CONFIRMADO` en el MVP se anula y se crea otro. |
| RN-15 | Numeración: `id` global (UUID v7) + `numero_dia` consecutivo que se reinicia cada **fecha operativa** (lo que se grita/pantalla en cocina: "#014"). |
| RN-16 | **Fecha operativa**: un día operativo va de 05:00 a 04:59 del día siguiente (hora `America/Bogota`), para que el cierre de medianoche no parta un turno. *Configurable:* `hora_corte_dia = "05:00"`. |
| RN-17 | Pedido `ABIERTO` sin actividad por más de 12 h se muestra como "olvidado" en Admin (no se anula automáticamente). |

## 3. Cocina

| ID | Regla |
|---|---|
| RN-20 | Al confirmar un pedido se crea **exactamente una** comanda (en la misma transacción). |
| RN-21 | Transiciones válidas: `PENDIENTE → EN_PREPARACION → LISTA → ENTREGADA`; cualquier estado no final → `ANULADA` solo por anulación del pedido. |
| RN-22 | "Deshacer" en KDS revierte la última transición si ocurrió hace ≤ 10 s. |
| RN-23 | Tiempo de preparación = `lista_at − creada_at`. Umbrales de atraso: **8 min** (warning) y **12 min** (grave). *Configurables.* |

## 4. Inventario

| ID | Regla |
|---|---|
| RN-30 | Cada ingrediente tiene una **unidad base entera**: `G` (gramos), `ML` (mililitros) o `UND` (unidades). Stock, mínimos y recetas se expresan en esa unidad (enteros). |
| RN-31 | Cada producto tiene una **receta** (lista de ingrediente + cantidad por unidad vendida). Un producto revendido tal cual (p. ej. gaseosa) tiene receta de 1 `UND` de sí mismo como ingrediente. Un producto sin receta no descuenta inventario (se marca con advertencia en Admin). |
| RN-32 | El consumo se descuenta **al confirmar** el pedido (no al cobrar), en la misma transacción, bloqueando las filas de ingredientes (`SELECT … FOR UPDATE`, en orden de `id` para evitar deadlocks). |
| RN-33 | Si algún ingrediente no alcanza, la confirmación **falla completa** (409 `STOCK_INSUFICIENTE`) e indica qué ingredientes faltan. *Configurable:* `permitir_stock_negativo = false`. Con `true` se confirma y se genera alerta. |
| RN-34 | Todo cambio de stock genera un `movimiento_inventario` (`CONSUMO`, `ENTRADA`, `AJUSTE`, `MERMA`, `REVERSION`) con cantidad con signo, usuario y referencia. El stock **nunca** se edita sin movimiento. `stock_actual` = suma de movimientos (se mantiene denormalizado y se verifica en un test de consistencia). |
| RN-35 | Si al anular un pedido su comanda estaba `PENDIENTE`, se crea un movimiento `REVERSION` (el stock vuelve). Si ya estaba `EN_PREPARACION` o después, se registra como `MERMA` (no vuelve). |
| RN-36 | **Retroalimentación:** cuando un ingrediente cruza su `stock_minimo` hacia abajo se emite `StockBajoMinimo` (alerta en Admin). Cuando llega a un nivel que no alcanza para una unidad de algún producto, ese producto se marca `agotado = true` automáticamente. Al registrar una entrada que lo repone, se re-evalúa y se desmarca. Admin puede forzar agotado/disponible manualmente. |

## 5. Caja y cobros

| ID | Regla |
|---|---|
| RN-40 | Para cobrar, el cajero debe tener una **sesión de caja ABIERTA**. Máximo una sesión abierta por cajero (índice único parcial). |
| RN-41 | Apertura con monto base en efectivo (≥ 0). |
| RN-42 | Métodos de pago MVP: `EFECTIVO`, `TARJETA` (datáfono externo; se registra referencia opcional), `TRANSFERENCIA` (Nequi/Daviplata/Bancolombia; referencia opcional). Se permiten **pagos mixtos**. |
| RN-43 | La suma de pagos debe ser **exactamente** `total + propina`. En efectivo, `recibido ≥ monto` y `cambio = recibido − monto`; solo un pago en efectivo por cobro. |
| RN-44 | Cobrar un pedido `ABIERTO` lo confirma (con todas las reglas de RN-20/RN-32) y lo cierra en la **misma transacción**. Cobrar un `CONFIRMADO` lo cierra. Un pedido se cobra **una sola vez** (único `recibo` por pedido). |
| RN-45 | Cada cobro genera un **recibo POS** con consecutivo global (`R-000001`). El recibo **no es documento electrónico DIAN** y así se rotula ("Documento no fiscal"); con régimen `NO_RESPONSABLE` incluye además la leyenda "No responsable de INC". DEE POS / factura electrónica: v2. |
| RN-46 | Movimientos manuales de caja: `INGRESO` y `RETIRO` con motivo obligatorio. |
| RN-47 | Cierre: `efectivo_esperado = base + Σ pagos EFECTIVO + Σ ingresos − Σ retiros` (los montos de pago ya descuentan el cambio). El cajero digita `efectivo_contado`; `diferencia = contado − esperado` (positivo = sobrante). El cierre es irreversible y emite `SesionCajaCerrada`. |
| RN-48 | Una sesión no puede cerrarse mientras el cajero tenga un cobro en curso. Los pedidos abiertos no bloquean el cierre (pertenecen al restaurante, no a la caja). |

## 6. Anulaciones y permisos

| ID | Regla |
|---|---|
| RN-50 | Anular un pedido requiere rol `ADMIN` y **motivo** (mín. 5 caracteres). Pedidos `CERRADO` (cobrados) no se anulan en el MVP; las devoluciones de dinero son v1.1. |
| RN-51 | Matriz de permisos (MVP): |

| Acción | ADMIN | CAJERO | COCINA |
|---|:-:|:-:|:-:|
| Crear/editar/confirmar pedido | ✅ | ✅ | — |
| Cobrar, abrir/cerrar caja | ✅ | ✅ | — |
| Ver KDS y cambiar estado de comanda | ✅ | ver | ✅ |
| Anular pedido | ✅ | — | — |
| Catálogo, recetas, precios | ✅ | — | — |
| Entradas/ajustes de inventario | ✅ | — | — |
| Dashboard y reportes | ✅ | — | — |
| Usuarios y configuración | ✅ | — | — |

## 7. Auditoría

| ID | Regla |
|---|---|
| RN-60 | Toda transición de estado y toda acción sensible queda registrada en `evento_sistema` con usuario, fecha y payload. Esa bitácora es de solo inserción (sin `UPDATE`/`DELETE` salvo la marca `procesado_at`). |
| RN-61 | Las horas se guardan en UTC (`timestamptz`) y se muestran en `America/Bogota`. |
