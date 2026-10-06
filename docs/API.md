# API — MonsterBurguer POS

Base: `/api/v1`. JSON UTF-8. Autenticación por cookie de sesión `mb_session` (ver ARCHITECTURE §9). Los esquemas de entrada/salida son los Zod de `@mb/shared/schemas` (fuente de verdad); este documento resume el contrato.

## Convenciones

- Fechas: ISO-8601 en UTC (`2026-10-06T19:42:10.123Z`). `fecha_operativa`: `YYYY-MM-DD`.
- Dinero: enteros en pesos COP (`49700`). Cantidades de inventario: enteros en unidad base.
- IDs: UUID v7 (string).
- Campos JSON en `camelCase` (se mapean a `snake_case` en la BD).
- Listas paginadas: `?limit=50&cursor=<id>` → `{ items: [...], nextCursor: string | null }`.
- **Concurrencia:** las mutaciones sobre `pedido`, `comanda` y `sesion_caja` envían `version` en el cuerpo; si no coincide → `409 VERSION_CONFLICT`.
- **Idempotencia:** `POST` de confirmar, cobrar y abrir/cerrar caja aceptan cabecera `Idempotency-Key` (uuid generado por el cliente); un reintento con la misma clave devuelve la misma respuesta.

### Formato de error

```json
{ "codigo": "STOCK_INSUFICIENTE", "mensaje": "No hay suficiente stock para confirmar el pedido.", "detalles": { "faltantes": [{ "ingredienteId": "…", "nombre": "Tocineta", "requerido": 120, "disponible": 40, "unidad": "G" }] } }
```

| HTTP | `codigo` (ejemplos) |
|---|---|
| 400 | `VALIDACION` (detalles: errores Zod por campo) |
| 401 | `NO_AUTENTICADO` |
| 403 | `SIN_PERMISO` |
| 404 | `NO_ENCONTRADO` |
| 409 | `VERSION_CONFLICT`, `ESTADO_INVALIDO`, `STOCK_INSUFICIENTE`, `MESA_OCUPADA`, `CAJA_NO_ABIERTA`, `PAGOS_NO_CUADRAN` |
| 429 | `DEMASIADOS_INTENTOS` |

## Endpoints

Roles: **A** = ADMIN, **C** = CAJERO, **K** = COCINA.

### Identidad

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| POST | `/auth/login` | público | `{ username, password }` → set-cookie + `{ usuario }` |
| POST | `/auth/logout` | todos | Invalida la sesión |
| GET | `/auth/me` | todos | Usuario actual + rol |
| GET | `/usuarios` | A | Lista |
| POST | `/usuarios` | A | Crear `{ nombre, username, password, rol }` |
| PATCH | `/usuarios/:id` | A | Editar / activar / desactivar / cambiar contraseña |

### Catálogo

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/catalogo/menu` | A C | Categorías activas con productos activos (incluye `agotado`), para el POS |
| GET/POST | `/categorias` | A | Listar / crear |
| PATCH | `/categorias/:id` | A | Editar, ordenar, activar |
| GET/POST | `/productos` | A | Listar (filtros `categoriaId`, `activo`, `sinReceta`) / crear |
| GET/PATCH | `/productos/:id` | A | Detalle (con receta) / editar |
| PUT | `/productos/:id/receta` | A | Reemplaza la receta `{ items: [{ ingredienteId, cantidad }] }` |
| PUT | `/productos/:id/agotado` | A | `{ agotadoManual: true \| false \| null }` |

### Pedidos

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/mesas` | A C | Mesas con `ocupada` y `pedidoId` activo |
| GET | `/pedidos` | A C | Filtros `estado`, `fechaOperativa`, `tipo` |
| POST | `/pedidos` | A C | Crear `{ tipo, mesaId?, clienteId?, nota? }` → pedido `ABIERTO` |
| GET | `/pedidos/:id` | A C | Detalle con ítems, totales y estado de comanda |
| POST | `/pedidos/:id/items` | A C | Agregar `{ productoId, cantidad, nota? }` |
| PATCH | `/pedidos/:id/items/:itemId` | A C | Cambiar `cantidad` / `nota` |
| DELETE | `/pedidos/:id/items/:itemId` | A C | Quitar línea |
| POST | `/pedidos/:id/confirmar` | A C | Envía a cocina (descuenta stock, crea comanda). `{ version }` |
| POST | `/pedidos/:id/anular` | A | `{ motivo, version }` |

Respuesta de pedido (resumen):

```json
{
  "id": "0199b2c4-…", "numeroDia": 14, "fechaOperativa": "2026-10-06",
  "tipo": "MESA", "mesa": { "id": "…", "nombre": "Mesa 4" },
  "estado": "CONFIRMADO", "estadoComanda": "EN_PREPARACION",
  "items": [{ "id": "…", "productoId": "…", "nombre": "Monster Clásica", "precioUnitario": 19900, "cantidad": 2, "nota": "sin cebolla", "totalLinea": 39800 }],
  "total": 49700, "base": 49700, "impuesto": 0,
  "version": 3, "createdAt": "2026-10-06T19:40:02.000Z"
}
```

### Cocina

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/comandas?activas=true` | A C K | Comandas `PENDIENTE`/`EN_PREPARACION`/`LISTA` en orden FIFO |
| POST | `/comandas/:id/iniciar` | A K | `{ version }` |
| POST | `/comandas/:id/lista` | A K | `{ version }` |
| POST | `/comandas/:id/entregar` | A C K | `{ version }` |
| POST | `/comandas/:id/deshacer` | A K | Revierte la última transición si fue hace ≤ 10 s (RN-22) |

### Inventario

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET/POST | `/ingredientes` | A | Listar (filtro `stockBajo=true`) / crear |
| PATCH | `/ingredientes/:id` | A | Editar nombre, mínimo, costo, activo (no el stock) |
| GET | `/ingredientes/:id/movimientos` | A | Kardex paginado |
| POST | `/inventario/entradas` | A | `{ items: [{ ingredienteId, cantidad, costoUnitario? }], nota? }` |
| POST | `/inventario/ajustes` | A | `{ ingredienteId, stockContado, motivo }` → crea `AJUSTE` por la diferencia |
| POST | `/inventario/mermas` | A | `{ ingredienteId, cantidad, motivo }` |

### Caja

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/caja/sesion-actual` | A C | Sesión abierta del usuario (o `null`) con resumen |
| POST | `/caja/sesiones` | A C | Abrir `{ montoApertura }` |
| POST | `/caja/sesiones/:id/movimientos` | A C | `{ tipo: "INGRESO" \| "RETIRO", monto, motivo }` |
| POST | `/caja/sesiones/:id/cerrar` | A C | `{ efectivoContado, version }` → resumen de cierre |
| GET | `/caja/sesiones` | A | Historial de cierres |
| POST | `/caja/cobros` | A C | Cobrar (ver abajo) |
| GET | `/recibos/:id` | A C | Datos del recibo para imprimir |

Cobro:

```json
// POST /caja/cobros
{
  "pedidoId": "…", "pedidoVersion": 3, "propina": 0,
  "pagos": [
    { "metodo": "EFECTIVO", "monto": 30000, "recibido": 50000 },
    { "metodo": "TARJETA", "monto": 19700, "referencia": "VOUCHER-8812" }
  ]
}
// 201
{ "reciboId": "…", "numero": "R-000127", "total": 49700, "propina": 0, "cambio": 20000 }
```

### Clientes

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/clientes?q=` | A C | Buscar por nombre/teléfono/documento |
| POST | `/clientes` | A C | Crear |

### Administración

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/admin/dashboard?fecha=` | A | KPIs, ventas por hora, top productos, tiempos de cocina |
| GET | `/admin/alertas` | A | Stock bajo, agotados, productos auto-desactivados, pedidos olvidados |
| GET | `/admin/reportes/ventas?desde=&hasta=&agrupar=dia\|producto\|categoria\|metodo` | A | Reporte de ventas |
| GET | `/admin/eventos?tipo=&modulo=&cursor=` | A | Bitácora de interacciones (`evento_sistema`) |
| GET/PUT | `/admin/configuracion` | A | Parámetros (impuesto, propina, umbrales, datos del negocio) |

## Tiempo real — SSE

`GET /api/v1/stream?canales=cocina,pos,admin` (`text/event-stream`, requiere sesión; canales filtrados por rol).

```
id: 1842
event: comanda.nueva
data: {"comandaId":"…","pedidoId":"…","numeroDia":15}

: heartbeat
```

| `event` | Canales | Origen | Acción en el front |
|---|---|---|---|
| `comanda.nueva` | cocina, pos | `PedidoConfirmado` | invalidar `['comandas']`, `['pedidos']` |
| `comanda.estado` | cocina, pos | `ComandaIniciada/Lista/Entregada` | invalidar; toast "Pedido #014 listo" en POS |
| `comanda.anulada` | cocina, pos | `PedidoAnulado` | invalidar |
| `pedido.cobrado` | pos, admin | `PedidoCobrado` | invalidar `['pedidos']`, `['dashboard']` |
| `inventario.alerta` | admin | `StockBajoMinimo`, `IngredienteAgotado` | invalidar `['alertas']`; toast |
| `catalogo.disponibilidad` | pos, admin | cambio de `agotado` | invalidar `['menu']` |

El `id` es `evento_sistema.id`; al reconectar, el navegador envía `Last-Event-ID` y el servidor reenvía lo pendiente.
