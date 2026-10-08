# API — MonsterBurguer POS

> **Especificación técnica del contrato HTTP REST y Server-Sent Events (SSE).**  
> Todos los endpoints reflejan el código implementado en los controladores de `apps/api/src/modules/` y los esquemas Zod en `@mb/shared/schemas`.

Prefijo global: `/api/v1`  
Formato de intercambio: JSON UTF-8 (`Content-Type: application/json; charset=utf-8`)  
Tiempo real: `GET /api/v1/stream` (`Content-Type: text/event-stream`)

---

## 1. Convenciones Globales

- **Autenticación:** Cookie de sesión `mb_session` (`HttpOnly`, `SameSite=Strict`).
- **Seguridad y CSRF:** En métodos mutantes (`POST`, `PATCH`, `PUT`, `DELETE`), el backend exige que la cabecera `Origin` coincida con la variable de entorno `APP_ORIGIN` o, si no está presente, que la cabecera `Referer` provenga del mismo origen. Peticiones mutantes sin `Origin` ni `Referer` válido son rechazadas con `403 ORIGEN_NO_PERMITIDO`.
- **Control de Acceso Basado en Roles (RBAC):**
  - **`ADMIN`:** Acceso total a administración, catálogo, inventario, pedidos, caja y cocina.
  - **`CAJERO`:** Acceso a toma de pedidos, catálogo de menú, gestión de mesas, cobro y apertura/cierre de su propia caja.
  - **`COCINA`:** Acceso exclusivo a la pantalla KDS de comandas.
  - **`PÚBLICO`:** Endpoints exentos de sesión (`/health`, `/auth/login`).
- **Identificadores:** UUID v7 (`string` formateado en minúsculas).
- **Moneda y Dinero:** Enteros en pesos colombianos (**COP**). Sin centavos ni números flotantes (RN-01).
- **Inventario:** Cantidades enteras en unidad base (`G` para gramos, `ML` para mililitros, `UND` para unidades) (RN-30).
- **Fechas y Tiempos:** Formato ISO-8601 UTC en la API (`2026-10-06T19:42:10.123Z`). Las fechas operativas siguen el formato `YYYY-MM-DD` (RN-16).
- **Campos JSON:** Nombres de propiedad en `camelCase` (se transforman a `snake_case` al persistir en base de datos).
- **Concurrencia:** Endpoints de comandas y caja envían el entero `version` para bloqueo optimista; discrepancias retornan `409 VERSION_CONFLICT`.

---

## 2. Formato Unificado de Respuestas de Error

Cualquier fallo de negocio, validación o autorización devuelve la estructura definida en `@mb/shared/schemas/error.ts`:

```json
{
  "codigo": "STOCK_INSUFICIENTE",
  "mensaje": "No hay suficiente stock para confirmar el pedido.",
  "detalles": {
    "faltantes": [
      {
        "ingredienteId": "0199b2c4-87a1-7c9b-b530-1c8f12a34567",
        "nombre": "Tocineta Ahumada",
        "requerido": 100,
        "disponible": 40,
        "unidad": "G"
      }
    ]
  }
}
```

### Catálogo de Códigos de Error HTTP

| Código HTTP | `codigo` en respuesta | Causa típica |
|---|---|---|
| `400 Bad Request` | `VALIDACION` | Datos de entrada no cumplen el esquema Zod (`detalles` contiene arreglo de fallos por campo). |
| `401 Unauthorized` | `NO_AUTENTICADO` / `CREDENCIALES_INVALIDAS` | Ausencia de cookie `mb_session`, sesión expirada o usuario/clave erróneos. |
| `403 Forbidden` | `SIN_PERMISO` / `ORIGEN_NO_PERMITIDO` | Rol insuficiente para la acción o cabecera `Origin`/`Referer` no coincide con `APP_ORIGIN` (o ausente en métodos mutantes). |
| `404 Not Found` | `NO_ENCONTRADO` | El recurso solicitado por ID no existe en la base de datos. |
| `409 Conflict` | `ESTADO_INVALIDO` | Transición de estado prohibida por la máquina de estados del pedido o comanda. |
| `409 Conflict` | `VERSION_CONFLICT` | Conflicto de bloqueo optimista; la versión enviada no coincide con la versión en base de datos. |
| `409 Conflict` | `STOCK_INSUFICIENTE` | Falta stock en uno o más ingredientes al confirmar el pedido (RN-33). |
| `409 Conflict` | `NOMBRE_DUPLICADO` | Nombre duplicado al crear o renombrar categoría, producto o ingrediente (BE-01). |
| `409 Conflict` | `CAJA_NO_ABIERTA` | El cajero intenta cobrar sin una sesión de caja activa en estado `ABIERTA` (RN-40). |
| `409 Conflict` | `PAGOS_NO_CUADRAN` | El monto pagado difiere de `total + propina` (RN-43). |
| `429 Too Many Requests` | `DEMASIADOS_INTENTOS` | Límite de peticiones excedido (máximo 5 intentos por minuto en login). |
| `503 Service Unavailable`| `DB_NO_DISPONIBLE` | Fallo de conexión o respuesta del motor PostgreSQL en `/health`. |

---

## 3. Catálogo de Endpoints Implementados

### 3.1. Salud del Sistema

#### `GET /api/v1/health`
- **Roles:** Público.
- **Descripción:** Verifica conectividad y operatividad de la base de datos PostgreSQL.
- **Respuesta (200 OK):**
  ```json
  { "status": "ok", "db": "ok" }
  ```

---

### 3.2. Identidad y Autenticación

#### `POST /api/v1/auth/login`
- **Roles:** Público (con rate limiting de 5 peticiones/minuto por IP).
- **Cuerpo (`loginSchema`):**
  ```json
  { "username": "admin", "password": "admin123" }
  ```
- **Respuesta (200 OK):**
  Establece la cookie `mb_session` (`HttpOnly; SameSite=Strict`) y retorna:
  ```json
  {
    "usuario": {
      "id": "0199b2c4-72a1-7c9b-b530-1c8f12a34567",
      "nombre": "Administrador",
      "username": "admin",
      "rol": "ADMIN"
    }
  }
  ```

#### `POST /api/v1/auth/logout`
- **Roles:** `ADMIN`, `CAJERO`, `COCINA`.
- **Descripción:** Invalida y elimina la sesión activa en PostgreSQL; borra la cookie en el navegador.
- **Respuesta:** `204 No Content`.

#### `GET /api/v1/auth/me`
- **Roles:** `ADMIN`, `CAJERO`, `COCINA`.
- **Descripción:** Obtiene los datos del usuario autenticado en la sesión actual.
- **Respuesta (200 OK):**
  ```json
  {
    "usuario": {
      "id": "0199b2c4-72a1-7c9b-b530-1c8f12a34567",
      "nombre": "Administrador",
      "username": "admin",
      "rol": "ADMIN"
    }
  }
  ```

---

### 3.3. Catálogo de Productos y Menú

#### `GET /api/v1/catalogo/menu`
- **Roles:** `ADMIN`, `CAJERO`.
- **Descripción:** Obtiene las categorías activas con sus productos activos para la grilla del terminal POS. Incluye el flag reactivo `agotado`.
- **Respuesta (200 OK):**
  ```json
  [
    {
      "id": "0199b2c4-1111-7c9b-b530-1c8f12a34567",
      "nombre": "Hamburguesas",
      "orden": 1,
      "productos": [
        {
          "id": "0199b2c4-2222-7c9b-b530-1c8f12a34567",
          "nombre": "Monster Clásica",
          "descripcion": "150g carne de res, queso cheddar...",
          "precio": 24900,
          "imagenUrl": null,
          "agotado": false,
          "orden": 1
        }
      ]
    }
  ]
  ```

#### `GET /api/v1/categorias`
- **Roles:** `ADMIN`.
- **Descripción:** Lista todas las categorías registradas en el sistema.

#### `POST /api/v1/categorias`
- **Roles:** `ADMIN`.
- **Cuerpo (`crearCategoriaSchema`):**
  ```json
  { "nombre": "Bebidas", "orden": 3, "activa": true }
  ```
- **Respuesta:** `201 Created` con el objeto categoría creado.

#### `PATCH /api/v1/categorias/:id`
- **Roles:** `ADMIN`.
- **Cuerpo (`editarCategoriaSchema`):** Campos opcionales `nombre`, `orden`, `activa`.
- **Respuesta (200 OK):** Categoría actualizada.

#### `GET /api/v1/productos`
- **Roles:** `ADMIN`.
- **Query:** `?categoriaId=<uuid>&activo=true&sinReceta=false`.
- **Respuesta (200 OK):** Arreglo de productos con su receta asociada.

#### `POST /api/v1/productos`
- **Roles:** `ADMIN`.
- **Cuerpo (`crearProductoSchema`):**
  ```json
  {
    "categoriaId": "0199b2c4-1111-7c9b-b530-1c8f12a34567",
    "nombre": "Monster Doble Brasa",
    "descripcion": "Doble carne 150g, queso cheddar",
    "precio": 32900,
    "orden": 4,
    "activo": true
  }
  ```
- **Respuesta:** `201 Created` con el producto creado.

#### `GET /api/v1/productos/:id`
- **Roles:** `ADMIN`.
- **Respuesta (200 OK):** Detalle del producto con sus ingredientes de receta.

#### `PATCH /api/v1/productos/:id`
- **Roles:** `ADMIN`.
- **Cuerpo (`editarProductoSchema`):** Campos opcionales a modificar (`categoriaId`, `nombre`, `precio`, etc.).
- **Respuesta (200 OK):** Producto modificado.

#### `PUT /api/v1/productos/:id/receta`
- **Roles:** `ADMIN`.
- **Descripción:** Reemplaza atómicamente la lista de ingredientes que componen el producto.
- **Cuerpo (`actualizarRecetaSchema`):**
  ```json
  {
    "items": [
      { "ingredienteId": "0199b2c4-3333-7c9b-b530-1c8f12a34567", "cantidad": 1 },
      { "ingredienteId": "0199b2c4-4444-7c9b-b530-1c8f12a34567", "cantidad": 150 }
    ]
  }
  ```
- **Respuesta (200 OK):** Producto con la nueva receta.

#### `PUT /api/v1/productos/:id/agotado`
- **Roles:** `ADMIN`.
- **Descripción:** Fuerza o libera la disponibilidad manual de un producto (override sobre el cálculo de stock).
- **Cuerpo (`actualizarAgotadoManualSchema`):**
  ```json
  { "agotadoManual": true }
  ```
  *(Permite `true`, `false` o `null` para retornar al cálculo automático por stock).*
- **Respuesta (200 OK):** Producto actualizado.

---

### 3.4. Clientes

#### `GET /api/v1/clientes`
- **Roles:** `ADMIN`, `CAJERO`.
- **Query:** `?q=<filtro>&limit=20&cursor=<uuid>`.
- **Respuesta (200 OK):**
  ```json
  {
    "items": [
      {
        "id": "0199b2c4-5555-7c9b-b530-1c8f12a34567",
        "nombre": "Carlos Restrepo",
        "telefono": "3001234567",
        "documento": "1047234567",
        "email": "carlos@example.com",
        "createdAt": "2026-10-06T12:00:00.000Z",
        "updatedAt": "2026-10-06T12:00:00.000Z"
      }
    ],
    "nextCursor": null
  }
  ```

#### `POST /api/v1/clientes`
- **Roles:** `ADMIN`, `CAJERO`.
- **Cuerpo (`crearClienteSchema`):**
  ```json
  {
    "nombre": "Carlos Restrepo",
    "telefono": "3001234567",
    "documento": "1047234567",
    "email": "carlos@example.com"
  }
  ```
- **Respuesta:** `201 Created` con el cliente registrado.

---

### 3.5. Mesas

#### `GET /api/v1/mesas`
- **Roles:** `ADMIN`, `CAJERO`.
- **Descripción:** Lista todas las mesas con su capacidad y su estado de ocupación actual en vivo (`ocupada: boolean`, `pedidoId: string | null`).
- **Respuesta (200 OK):**
  ```json
  [
    {
      "id": "0199b2c4-6666-7c9b-b530-1c8f12a34567",
      "nombre": "Mesa 1",
      "capacidad": 4,
      "activa": true,
      "orden": 1,
      "ocupada": true,
      "pedidoId": "0199b2c4-7777-7c9b-b530-1c8f12a34567"
    }
  ]
  ```

#### `POST /api/v1/mesas`
- **Roles:** `ADMIN`.
- **Cuerpo (`crearMesaSchema`):** `{ "nombre": "Mesa 5", "capacidad": 6, "activa": true, "orden": 5 }`.
- **Respuesta:** `201 Created`.

#### `GET /api/v1/mesas/:id`
- **Roles:** `ADMIN`, `CAJERO`.
- **Respuesta (200 OK):** Datos de la mesa.

#### `PATCH /api/v1/mesas/:id`
- **Roles:** `ADMIN`.
- **Cuerpo (`editarMesaSchema`):** Campos opcionales a modificar (`nombre`, `capacidad`, `activa`, `orden`).
- **Respuesta (200 OK):** Mesa actualizada.

#### `PUT /api/v1/mesas/orden`
- **Roles:** `ADMIN`.
- **Cuerpo (`reordenarMesasSchema`):** `{ "orden": [{ "id": "...", "orden": 1 }, { "id": "...", "orden": 2 }] }`.
- **Respuesta (200 OK):** Lista de mesas reordenadas.

---

### 3.6. Pedidos (POS)

#### `GET /api/v1/pedidos`
- **Roles:** `ADMIN`, `CAJERO`.
- **Query:** `?estado=ABIERTO&fechaOperativa=2026-10-06&tipo=MESA&limit=50&cursor=<uuid>`.
- **Respuesta (200 OK):**
  ```json
  {
    "items": [ /* Lista de pedidos */ ],
    "nextCursor": null
  }
  ```

#### `POST /api/v1/pedidos`
- **Roles:** `ADMIN`, `CAJERO`.
- **Descripción:** Crea un pedido en estado inicial `ABIERTO` asignado al usuario en sesión.
- **Cuerpo (`crearPedidoSchema`):**
  ```json
  {
    "tipo": "MESA",
    "mesaId": "0199b2c4-6666-7c9b-b530-1c8f12a34567",
    "clienteId": null,
    "nota": "Mesa junto a la ventana"
  }
  ```
  *(Si `tipo` es `LLEVAR`, `mesaId` debe ser omitido o nulo).*
- **Respuesta:** `201 Created` con el pedido creado en estado `ABIERTO`.

#### `GET /api/v1/pedidos/:id`
- **Roles:** `ADMIN`, `CAJERO`.
- **Respuesta (200 OK):**
  ```json
  {
    "id": "0199b2c4-7777-7c9b-b530-1c8f12a34567",
    "fechaOperativa": "2026-10-06",
    "numeroDia": 14,
    "tipo": "MESA",
    "mesaId": "0199b2c4-6666-7c9b-b530-1c8f12a34567",
    "mesa": { "id": "0199b2c4-6666-7c9b-b530-1c8f12a34567", "nombre": "Mesa 1" },
    "clienteId": null,
    "usuarioId": "0199b2c4-72a1-7c9b-b530-1c8f12a34567",
    "estado": "ABIERTO",
    "items": [
      {
        "id": "0199b2c4-8888-7c9b-b530-1c8f12a34567",
        "productoId": "0199b2c4-2222-7c9b-b530-1c8f12a34567",
        "nombreProducto": "Monster Clásica",
        "precioUnitario": 24900,
        "cantidad": 2,
        "nota": "Sin cebolla",
        "totalLinea": 49800,
        "orden": 1
      }
    ],
    "total": 49800,
    "base": 49800,
    "impuesto": 0,
    "nota": "Mesa junto a la ventana",
    "estadoComanda": null,
    "version": 2,
    "createdAt": "2026-10-06T19:40:02.000Z"
  }
  ```

#### `POST /api/v1/pedidos/:id/items`
- **Roles:** `ADMIN`, `CAJERO`.
- **Descripción:** Agrega una línea de producto al ticket en estado `ABIERTO`. Toma snapshot de nombre y precio vigente (RN-05).
- **Cuerpo (`agregarPedidoItemSchema`):**
  ```json
  {
    "productoId": "0199b2c4-2222-7c9b-b530-1c8f12a34567",
    "cantidad": 1,
    "nota": "Término medio"
  }
  ```
- **Respuesta:** `201 Created` con el pedido recalculado.

#### `PATCH /api/v1/pedidos/:id/items/:itemId`
- **Roles:** `ADMIN`, `CAJERO`.
- **Cuerpo (`editarPedidoItemSchema`):** `{ "cantidad": 3, "nota": "Bien asada" }`.
- **Respuesta (200 OK):** Pedido recalculado.

#### `DELETE /api/v1/pedidos/:id/items/:itemId`
- **Roles:** `ADMIN`, `CAJERO`.
- **Descripción:** Remueve la línea del pedido en estado `ABIERTO`.
- **Respuesta (200 OK):** Pedido recalculado.

#### `POST /api/v1/pedidos/:id/confirmar`
- **Roles:** `ADMIN`, `CAJERO`.
- **Descripción:** Ejecuta la confirmación del pedido en una única transacción de base de datos:
  1. Valida que el pedido tenga al menos 1 ítem (RN-12) y esté en estado `ABIERTO`.
  2. Adquiere bloqueo pesimista `SELECT ... FOR UPDATE` sobre los ingredientes en orden de ID (RN-32).
  3. Descuenta inventario registrando movimientos de tipo `CONSUMO`. Si falta stock, arroja `409 STOCK_INSUFICIENTE` (RN-33).
  4. Crea la comanda en cocina en estado `PENDIENTE` (RN-20).
  5. Cambia el estado del pedido a `CONFIRMADO` y publica el evento `PedidoConfirmado` en `evento_sistema`.
- **Respuesta (200 OK):** Pedido en estado `CONFIRMADO`.

#### `POST /api/v1/pedidos/:id/anular`
- **Roles:** `ADMIN` (RN-50).
- **Cuerpo (`anularPedidoSchema`):**
  ```json
  {
    "motivo": "Cliente canceló el pedido por demora",
    "version": 0
  }
  ```
- **Descripción:** Anula un pedido en estado `ABIERTO` o `CONFIRMADO` en una única transacción:
  1. Valida control de concurrencia optimista mediante `version` (`409 VERSION_CONFLICT`).
  2. Valida que el pedido esté en `ABIERTO` o `CONFIRMADO` (`409 ESTADO_INVALIDO`).
  3. Si tiene comanda asociada, la marca como `ANULADA` vía `cocina.anularComanda`.
  4. Gestiona inventario según el avance de la comanda (RN-35):
     - Sin comanda / `ABIERTO`: no altera inventario (aún no se consumió).
     - Comanda `PENDIENTE`: revierte el consumo (`inventario.revertir`), reponiendo existencias y emitiendo `IngredienteRepuesto` si supera el stock mínimo (RN-36).
     - Comanda `EN_PREPARACION`, `LISTA` o `ENTREGADA`: reclasifica el consumo como merma (`inventario.reclasificarConsumoComoMerma`), registrando el par de movimientos `REVERSION` + `MERMA` (efecto neto 0 en stock, trazabilidad completa en kardex).
  5. Libera la mesa automáticamente si el pedido era de tipo `MESA`.
  6. Actualiza el pedido a estado `ANULADO`, registrando `anuladoAt`, `anuladoPor` y `motivoAnulacion`.
  7. Publica `PedidoAnulado` y `ComandaAnulada` en `evento_sistema`.
- **Respuesta (200 OK):** Objeto pedido actualizado en estado `ANULADO`.

---

### 3.7. Cocina (KDS)

#### `GET /api/v1/comandas`
- **Roles:** `ADMIN`, `CAJERO`, `COCINA`.
- **Query:** `?activas=true` (filtra estados `PENDIENTE`, `EN_PREPARACION`, `LISTA`).
- **Respuesta (200 OK):**
  ```json
  [
    {
      "id": "0199b2c4-9999-7c9b-b530-1c8f12a34567",
      "pedidoId": "0199b2c4-7777-7c9b-b530-1c8f12a34567",
      "numeroDia": 14,
      "tipoPedido": "MESA",
      "mesaNombre": "Mesa 1",
      "estado": "PENDIENTE",
      "iniciadaAt": null,
      "listaAt": null,
      "entregadaAt": null,
      "items": [
        {
          "id": "0199b2c4-aaaa-7c9b-b530-1c8f12a34567",
          "nombre": "Monster Clásica",
          "cantidad": 2,
          "nota": "Sin cebolla"
        }
      ],
      "version": 0,
      "createdAt": "2026-10-06T19:42:00.000Z"
    }
  ]
  ```

#### `POST /api/v1/comandas/:id/iniciar`
- **Roles:** `ADMIN`, `COCINA`.
- **Cuerpo (`transicionComandaSchema`):** `{ "version": 0 }`.
- **Transición:** `PENDIENTE` → `EN_PREPARACION`. Registra `iniciada_at` y publica `ComandaIniciada`.
- **Respuesta (200 OK):** Comanda actualizada.

#### `POST /api/v1/comandas/:id/lista`
- **Roles:** `ADMIN`, `COCINA`.
- **Cuerpo (`transicionComandaSchema`):** `{ "version": 1 }`.
- **Transición:** `EN_PREPARACION` → `LISTA`. Registra `lista_at` y publica `ComandaLista`.
- **Respuesta (200 OK):** Comanda actualizada.

#### `POST /api/v1/comandas/:id/entregar`
- **Roles:** `ADMIN`, `CAJERO`, `COCINA`.
- **Cuerpo (`transicionComandaSchema`):** `{ "version": 2 }`.
- **Transición:** `LISTA` → `ENTREGADA`. Registra `entregada_at` y publica `ComandaEntregada`.
- **Respuesta (200 OK):** Comanda finalizada.

#### `POST /api/v1/comandas/:id/deshacer`
- **Roles:** `ADMIN`, `COCINA` (RN-22).
- **Cuerpo (`transicionComandaSchema`):** `{ "version": 1 }`.
- **Descripción:** Revierte la última transición de comanda si ocurrió hace $\le$ 10 segundos:
  - `EN_PREPARACION` $\to$ `PENDIENTE` (restablece `iniciadaAt` a `null`).
  - `LISTA` $\to$ `EN_PREPARACION` (restablece `listaAt` a `null`).
  - `ENTREGADA` $\to$ `LISTA` (restablece `entregadaAt` a `null`).
  - Si han transcurrido más de 10 segundos desde la última transición, rechaza con `409 TIEMPO_EXPIRADO`.
  - Publica el evento de dominio `ComandaDeshecha` y notifica en tiempo real a los canales `cocina` y `pos`.
- **Respuesta (200 OK):** Comanda en su estado previo con `version` incrementada.

---

### 3.8. Inventario

#### `GET /api/v1/ingredientes`
- **Roles:** `ADMIN`.
- **Query:** `?stockBajo=true&limit=50&cursor=<uuid>`.
- **Respuesta (200 OK):** Arreglo de ingredientes con stock actual, mínimo y costo unitario.

#### `POST /api/v1/ingredientes`
- **Roles:** `ADMIN`.
- **Cuerpo (`crearIngredienteSchema`):**
  ```json
  {
    "nombre": "Pan Brioche",
    "unidad": "UND",
    "stockMinimo": 40,
    "costoUnitario": 1500000,
    "activo": true
  }
  ```
- **Respuesta:** `201 Created`.

#### `PATCH /api/v1/ingredientes/:id`
- **Roles:** `ADMIN`.
- **Cuerpo (`editarIngredienteSchema`):** Campos editables de catálogo (`nombre`, `unidad`, `stockMinimo`, `costoUnitario`, `activo`).  
  *(El stock actual **nunca** se edita directamente; solo mediante movimientos, RN-34).*
- **Respuesta (200 OK):** Ingrediente modificado.

#### `GET /api/v1/ingredientes/:id/movimientos`
- **Roles:** `ADMIN`.
- **Descripción:** Kardex auditable del ingrediente con paginación cursor.
- **Respuesta (200 OK):**
  ```json
  {
    "items": [
      {
        "id": "0199b2c4-bbbb-7c9b-b530-1c8f12a34567",
        "ingredienteId": "0199b2c4-3333-7c9b-b530-1c8f12a34567",
        "tipo": "CONSUMO",
        "cantidad": -150,
        "stockResultante": 29850,
        "referenciaTipo": "PEDIDO",
        "referenciaId": "0199b2c4-7777-7c9b-b530-1c8f12a34567",
        "usuarioId": "0199b2c4-72a1-7c9b-b530-1c8f12a34567",
        "motivo": null,
        "createdAt": "2026-10-06T19:42:00.000Z"
      }
    ],
    "nextCursor": null
  }
  ```

#### `POST /api/v1/inventario/entradas`
- **Roles:** `ADMIN`.
- **Cuerpo (`crearEntradaInventarioSchema`):**
  ```json
  {
    "items": [
      { "ingredienteId": "0199b2c4-3333-7c9b-b530-1c8f12a34567", "cantidad": 5000, "costoUnitario": 35000 }
    ],
    "nota": "Compra factura F-8921"
  }
  ```
- **Respuesta:** `201 Created` con los movimientos de entrada generados.

#### `POST /api/v1/inventario/ajustes`
- **Roles:** `ADMIN`.
- **Cuerpo (`crearAjusteInventarioSchema`):**
  ```json
  {
    "ingredienteId": "0199b2c4-3333-7c9b-b530-1c8f12a34567",
    "stockContado": 29500,
    "motivo": "Ajuste tras conteo físico semanal"
  }
  ```
- **Respuesta:** `201 Created` con el movimiento de tipo `AJUSTE` por la diferencia.

#### `POST /api/v1/inventario/mermas`
- **Roles:** `ADMIN`.
- **Cuerpo (`crearMermaInventarioSchema`):**
  ```json
  {
    "ingredienteId": "0199b2c4-3333-7c9b-b530-1c8f12a34567",
    "cantidad": 300,
    "motivo": "Carne quemada en parrilla durante prueba"
  }
  ```
- **Respuesta:** `201 Created` con el movimiento de tipo `MERMA`.

---

### 3.9. Caja y Cobros

#### `GET /api/v1/caja/sesion-actual`
- **Roles:** `ADMIN`, `CAJERO`.
- **Descripción:** Consulta si el usuario autenticado tiene una sesión de caja `ABIERTA`.
- **Respuesta (200 OK):**
  ```json
  {
    "id": "0199b2c4-cccc-7c9b-b530-1c8f12a34567",
    "usuarioId": "0199b2c4-72a1-7c9b-b530-1c8f12a34567",
    "estado": "ABIERTA",
    "montoApertura": 150000,
    "ventasEfectivo": 49800,
    "abiertaAt": "2026-10-06T15:00:00.000Z",
    "version": 0
  }
  ```
  *(Retorna `null` si no hay sesión abierta).*

#### `POST /api/v1/caja/sesiones`
- **Roles:** `ADMIN`, `CAJERO`.
- **Descripción:** Abre una nueva sesión de caja (RN-40, RN-41).
- **Cuerpo (`abrirSesionCajaSchema`):**
  ```json
  { "montoApertura": 150000 }
  ```
- **Respuesta:** `201 Created` con la sesión abierta.

#### `POST /api/v1/caja/sesiones/:id/cerrar`
- **Roles:** `ADMIN`, `CAJERO`.
- **Descripción:** Cierra la sesión de caja, calcula la diferencia entre efectivo contado y esperado, y publica `SesionCajaCerrada` (RN-47). `efectivoEsperado = montoApertura + ventasEfectivo + ingresos - retiros`.
- **Cuerpo (`cerrarSesionCajaSchema`):**
  ```json
  { "efectivoContado": 199800 }
  ```
- **Respuesta (200 OK):**
  ```json
  {
    "sesionId": "0199b2c4-cccc-7c9b-b530-1c8f12a34567",
    "montoApertura": 150000,
    "ventasEfectivo": 49800,
    "ingresos": 0,
    "retiros": 0,
    "efectivoEsperado": 199800,
    "efectivoContado": 199800,
    "diferencia": 0,
    "cerradaAt": "2026-10-06T23:30:00.000Z"
  }
  ```

#### `POST /api/v1/caja/sesiones/:id/movimientos`
- **Roles:** `ADMIN`, `CAJERO` (el cajero solo sobre su propia sesión; `ADMIN` sobre cualquiera).
- **Descripción:** Registra un ingreso o retiro manual de efectivo en una sesión `ABIERTA` (RN-46). Publica `MovimientoCajaRegistrado` en `evento_sistema`.
- **Cuerpo (`movimientoCajaInputSchema`):**
  ```json
  { "tipo": "RETIRO", "monto": 5000, "motivo": "Compra de hielo" }
  ```
  `tipo` es `INGRESO` o `RETIRO`; `monto` es entero COP > 0; `motivo` tiene de 3 a 140 caracteres.
- **Respuesta:** `201 Created` con el `MovimientoCaja` (`id`, `sesionCajaId`, `tipo`, `monto`, `motivo`, `usuarioId`, `createdAt`).
- **Errores:** `403 SIN_PERMISO` (sesión de otro cajero), `404 NO_ENCONTRADO`, `409 ESTADO_INVALIDO` (sesión cerrada), `409 EFECTIVO_INSUFICIENTE` (un `RETIRO` dejaría el efectivo esperado en negativo; `detalles`: `efectivoEsperado`, `montoRetiro`).

#### `GET /api/v1/caja/sesiones/:id/movimientos`
- **Roles:** `ADMIN`, `CAJERO` (propia sesión; `ADMIN` cualquiera, si no `403`).
- **Respuesta (200 OK):** arreglo de `MovimientoCaja` en orden cronológico.

#### `GET /api/v1/caja/sesiones`
- **Roles:** `ADMIN` (todas las sesiones), `CAJERO` (solo las suyas).
- **Descripción:** Historial de sesiones de caja, paginado por cursor, más reciente primero.
- **Query:** `desde` y `hasta` (`YYYY-MM-DD`, fechas operativas RN-16, inclusivas y opcionales, aplicadas a la fecha operativa de apertura), `cursor`, `limit` (máx. 100). Formato inválido o `desde > hasta` → `400 VALIDACION`.
- **Respuesta (200 OK):**
  ```json
  {
    "items": [
      {
        "id": "0199b2c4-cccc-7c9b-b530-1c8f12a34567",
        "usuarioId": "0199b2c4-1111-7c9b-b530-1c8f12a34567",
        "cajero": { "id": "0199b2c4-1111-7c9b-b530-1c8f12a34567", "nombre": "Caja 1" },
        "estado": "CERRADA",
        "montoApertura": 50000,
        "efectivoEsperado": 89900,
        "efectivoContado": 89900,
        "diferencia": 0,
        "abiertaAt": "2026-10-07T23:29:00.000Z",
        "cerradaAt": "2026-10-07T23:30:00.000Z",
        "version": 1
      }
    ],
    "nextCursor": null
  }
  ```

#### `GET /api/v1/caja/sesiones/:id`
- **Roles:** `ADMIN`, `CAJERO` (propia sesión; `ADMIN` cualquiera, si no `403`).
- **Descripción:** Detalle de una sesión: los campos del historial más `totalesPorMetodo` (`efectivo`, `tarjeta`, `transferencia`), `totalesMovimientos` (`ingresos`, `retiros`) y `movimientos`.

#### `POST /api/v1/caja/cobros`
- **Roles:** `ADMIN`, `CAJERO`.
- **Descripción:** Ejecuta el cobro del pedido en una única transacción:
  1. Si el pedido estaba en `ABIERTO`, lo confirma (descontando stock y creando comanda de forma atómica, RN-44).
  2. Valida la sesión de caja abierta y que el monto total coincida exactamente con `total + propina` (RN-43).
  3. Inserta el `recibo` y el desglose de `pago`.
  4. Cierra el pedido (`estado = 'CERRADO'`).
  5. Publica `PedidoCobrado` en `evento_sistema`.
- **Cuerpo (`cobroSchema`):**
  ```json
  {
    "pedidoId": "0199b2c4-7777-7c9b-b530-1c8f12a34567",
    "propina": 4900,
    "pagos": [
      {
        "metodo": "EFECTIVO",
        "monto": 54700,
        "recibido": 60000
      }
    ]
  }
  ```
  *(En el MVP actual se restringe estrictamente a un único método de pago por cobro).*
- **Respuesta:** `201 Created`
  ```json
  {
    "reciboId": "0199b2c4-dddd-7c9b-b530-1c8f12a34567",
    "numero": "R-000014",
    "total": 49800,
    "propina": 4900,
    "cambio": 5300
  }
  ```

#### `GET /api/v1/recibos/:id`
- **Roles:** `ADMIN`, `CAJERO`.
- **Descripción:** Devuelve la información completa del recibo para el formato de impresión térmica de 80 mm (RN-45). Incluye los ítems facturados, desglose tributario y leyendas legales ("Documento no fiscal", "No responsable de INC").

---

### 3.10. Administración

#### `GET /api/v1/admin/dashboard`
- **Roles:** `ADMIN`.
- **Query:** `?fecha=YYYY-MM-DD` (opcional, por defecto fecha operativa en curso).
- **Respuesta (200 OK):**
  Consolida en una sola respuesta las métricas clave de la operación a partir de las vistas SQL de base de datos:
  ```json
  {
    "fechaOperativa": "2026-10-06",
    "kpis": {
      "totalVentas": 1245000,
      "totalPedidos": 42,
      "ticketPromedio": 29643,
      "tiempoPromedioCocinaSeg": 480
    },
    "ventasPorHora": [
      { "hora": 18, "total": 350000, "pedidos": 10 }
    ],
    "topProductos": [
      { "productoId": "...", "nombre": "Monster Bacon", "unidades": 28, "monto": 809200 }
    ],
    "tiemposCocina": {
      "promedioSeg": 480,
      "p90Seg": 650,
      "comandas": 42
    },
    "alertas": {
      "ingredientesBajos": [
        { "ingredienteId": "...", "nombre": "Pan Brioche", "unidad": "UND", "stockActual": 12, "stockMinimo": 40 }
      ],
      "productosAgotados": []
    }
  }
  ```

#### `GET /api/v1/admin/eventos`
- **Roles:** `ADMIN`.
- **Query:** `?cursor=<id>`.
- **Descripción:** Consulta la bitácora inmutable de eventos del sistema (`evento_sistema`) para auditoría y visualización de interacciones entre subsistemas.
- **Respuesta (200 OK):**
  ```json
  {
    "items": [
      {
        "id": 1842,
        "tipo": "PedidoConfirmado",
        "modulo": "pedidos",
        "agregadoId": "0199b2c4-7777-7c9b-b530-1c8f12a34567",
        "usuarioId": "0199b2c4-72a1-7c9b-b530-1c8f12a34567",
        "payload": { "comandaId": "...", "numeroDia": 14 },
        "createdAt": "2026-10-06T19:42:00.000Z"
      }
    ],
    "nextCursor": 1792
  }
  ```

---

### 3.11. Tiempo Real — Server-Sent Events (SSE)

#### `GET /api/v1/stream`
- **Roles:** Requiere sesión autenticada.
- **Query:** `?canales=cocina,pos,admin` *(si se omite, se suscriben todos los canales permitidos para el rol del usuario según `CANALES_POR_ROL`)*.
- **Cabeceras de respuesta:**
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache`
  - `Connection: keep-alive`
  - `X-Accel-Buffering: no`

#### Matriz de Eventos SSE y Canales

| Evento SSE (`event:`) | Evento Dominio Origen | Canales | Efecto en Frontend |
|---|---|---|---|
| `comanda.nueva` | `PedidoConfirmado` | `cocina`, `pos` | KDS agrega comanda a columna Pendiente; POS actualiza estado. |
| `comanda.estado` | `ComandaIniciada`, `ComandaLista`, `ComandaEntregada` | `cocina`, `pos` | KDS avanza tarjeta; POS notifica pedido listo. |
| `comanda.anulada` | `PedidoAnulado` | `cocina`, `pos` | KDS retira tarjeta. |
| `pedido.cobrado` | `PedidoCobrado` | `pos`, `admin` | POS libera ticket y mesa; Admin actualiza KPIs en vivo. |
| `inventario.alerta` | `StockBajoMinimo`, `IngredienteAgotado` | `admin` | Admin muestra toast/alerta de reposición requerida. |
| `catalogo.disponibilidad` | `IngredienteRepuesto`, `CatalogoDisponibilidadCambiado` | `pos`, `admin` | POS refresca menú (`['menu']`) habilitando/deshabilitando botones. |
| `sesion.iniciada` | `SesionIniciada` | `admin` | Registro de actividad. |
| `sesion.cerrada` | `SesionCerrada` | `admin` | Registro de cierre de sesión. |

#### Reanudación y Reconexión
El cliente envía la cabecera `Last-Event-ID` (o query param `?lastEventId=<id>`). Si la conexión se interrumpe temporalmente, el servidor recupera del búfer circular y de la base de datos todos los eventos emitidos con ID superior al último recibido y los despacha de forma inmediata antes de continuar con la emisión en vivo.

---

## 4. Endpoints y Funcionalidades Fuera del Alcance del MVP (Backlog)

Los siguientes endpoints fueron previstos en las etapas de diseño preliminares pero **no están implementados** en el código del MVP actual:

1. **Gestión de Usuarios (`/usuarios`):** El CRUD de usuarios se encuentra reservado para v1.1; en el MVP los usuarios se configuran mediante el script semilla (`pnpm --filter api db:seed`).
2. **Anular Pedidos (`POST /pedidos/:id/anular`):** La anulación de pedidos y reversión/merma automática en cocina no cuenta con endpoint expuesto en `pedidos.controller.ts`.
3. **Deshacer Transición de Comanda (`POST /comandas/:id/deshacer`):** La ventana de reversión de 10 segundos en cocina no está implementada en el controlador.
4. **Movimientos de Caja Manuales (`POST /caja/sesiones/:id/movimientos`):** Ingresos y retiros manuales no están implementados en el servicio ni en el controlador de caja.
5. **Historial de Cierres de Caja (`GET /caja/sesiones`):** Consulta histórica de arqueos de caja diferida.
6. **Pagos Mixtos en Cobro:** `POST /caja/cobros` valida estrictamente un único método de pago en el MVP.
7. **Configuración y Reportes Avanzados (`/admin/configuracion`, `/admin/reportes/ventas`):** La edición dinámica de parámetros del negocio y reportes agrupados por rango de fechas están planificados para hitos posteriores.
