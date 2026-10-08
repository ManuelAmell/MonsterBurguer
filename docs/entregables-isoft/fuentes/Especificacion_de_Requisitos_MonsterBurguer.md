# Especificación de Requisitos de Software — MonsterBurguer POS
### Conforme a la Norma Internacional ISO/IEC/IEEE 29148

**Universidad de Cartagena**  
**Facultad de Ingeniería**  
**Programa de Ingeniería de Sistemas**  
**Departamento de Ingeniería de Software**  
**Asignatura:** Ingeniería de Software  
**Docente:** Ing. Martín Monroy Ríos, MSc, PhD  
**Estudiante:** Manuel Francisco Amell Gil  
**Fecha:** Octubre de 2026  

---

## 1. Introducción

### 1.1 Propósito
El propósito del presente documento es especificar de manera formal, completa y verificable los requisitos de software del sistema **MonsterBurguer POS**, sirviendo como base contractual de ingeniería para los desarrolladores, arquitectos, evaluadores de pruebas de aseguramiento de calidad (QA) y administradores del restaurante. El alcance abarca todas las capacidades del Producto Mínimo Viable (MVP) implementado en el repositorio oficial del proyecto.

### 1.2 Ámbito
El producto se denomina oficialmente **MonsterBurguer POS** (Sistema Integral de Punto de Venta, Control de Cocina y Gestión de Inventario). El sistema automatiza y articula de punta a punta el ciclo operativo de un restaurante de comidas rápidas: recepción de pedidos en mostrador y mesas, deducción atómica de materias primas por receta, visualización y cronometraje de comandas en cocina (KDS) en tiempo real, cobranza en caja con arqueo ciego y generación de indicadores clave para la toma de decisiones gerenciales. Sus metas principales son eliminar el extravío de órdenes, erradicar la sobreventa de productos sin existencias físicas, garantizar la exactitud del dinero en caja y reducir los tiempos de servicio en horas pico a menos de 4 toques por venta.

### 1.3 Visión general del producto

#### 1.3.1 Perspectiva del producto
MonsterBurguer POS es un software autónomo de red local diseñado bajo la arquitectura de **Monolito Modular Full-Stack en TypeScript**. Se despliega en las instalaciones del restaurante mediante contenedores Docker (Nginx, API NestJS y PostgreSQL), interactuando con los siguientes elementos de su entorno:
- **Interfaces de Usuario:** Interfaces web interactivas SPA adaptadas para tablets táctiles de mostrador (`/pos` y `/caja`), pantallas de televisión en cocina (`/cocina`) y computadores de oficina (`/admin`).
- **Interfaces de Hardware:** Impresoras térmicas de recibos de 80 mm conectadas localmente vía USB o red, monitores de cocina y gavetas de dinero.
- **Interfaces de Software:** Motor relacional PostgreSQL 17/18, entorno de ejecución Node.js 24 y servidor web Nginx.
- **Interfaces de Comunicación:** Red de Área Local (LAN) Ethernet/Wi-Fi empleando protocolos HTTP/REST y Server-Sent Events (SSE).
- **Operación en Sitio:** El sistema está diseñado para operar con absoluta independencia de conexiones externas a internet, garantizando que contingencias de conectividad en el proveedor ISP no detengan las ventas del local.

#### 1.3.2 Funciones del producto
1. **Identidad y Seguridad RBAC:** Autenticación con cifrado Argon2id y sesiones opacas en base de datos clasificadas en roles `ADMIN`, `CAJERO` y `COCINA`.
2. **Administración de Catálogo:** Gestión de categorías y productos con precio final al consumidor en pesos colombianos (COP) y conmutación automática de disponibilidad.
3. **Punto de Venta (POS):** Composición de tickets para salón (con control de mesas libres y ocupadas) o para llevar, con notas culinarias inmutables por ítem.
4. **Confirmación Atómica y Control de Inventario:** Descuento de materias primas por receta aplicando bloqueos pesimistas ordenados (`SELECT ... FOR UPDATE`) y registro de kardex en la misma transacción relacional.
5. **Sistema de Cocina (KDS):** Visualización de comandas en tiempo real vía SSE, avance de estados de preparación y alertas de demora a los 8 y 12 minutos.
6. **Caja y Cobranza:** Liquidación de cuentas con único medio de pago, cálculo de propina voluntaria en mesas (Ley 1935 de 2018), emisión de recibos no fiscales de 80 mm, movimientos manuales de efectivo y arqueo ciego.
7. **Analítica y Auditoría:** Tablero de control con métricas agregadas del día operativo e inspección de la bitácora transaccional de eventos (`evento_sistema`).

#### 1.3.3 Características de los usuarios
- **Cajeros / Personal de Mostrador:** Personal con formación básica o media en atención al cliente, que requiere interfaces intuitivas, botones táctiles de grandes dimensiones y confirmaciones inmediatas para agilizar el servicio en horas de alta congestión.
- **Cocineros / Personal de Producción:** Personal enfocado en la preparación física de alimentos, que opera en un ambiente caluroso y acelerado, requiriendo pantallas de alto contraste, tipografía visible a distancia (2 metros) y controles simples de un solo toque.
- **Administrador / Propietario:** Usuario con perfil de gestión de negocio, responsable de configurar precios, auditar arqueos de caja, registrar compras de ingredientes y analizar la rentabilidad a través de indicadores estadísticos.

#### 1.3.4 Limitaciones
- **Moneda Exclusiva:** Todas las operaciones monetarias se realizan estrictamente en pesos colombianos (COP) sin fracciones decimales (centavos).
- **Régimen Tributario:** Parametrizado por defecto bajo la categoría de `NO_RESPONSABLE` del Impuesto Nacional al Consumo (artículo 512-13 del Estatuto Tributario), emitiendo comprobantes internos de venta rotulados obligatoriamente como "Documento no fiscal".
- **Facturación Electrónica DIAN:** Fuera del alcance del MVP actual (programada para la versión 2.0).
- **Medios de Pago en MVP:** Restringido a un único método de pago por cobro (pagos mixtos reservados para el backlog).

### 1.4 Definiciones
- **KDS (Kitchen Display System):** Sistema electrónico de pantalla de cocina para visualización y control de tiempos de órdenes culinarias.
- **Fecha Operativa:** Jornada contable del restaurante que va desde las 05:00 a.m. de un día calendario hasta las 04:59 a.m. del día siguiente en la zona horaria `America/Bogota` (RN-16).
- **Kardex:** Registro cronológico e inmutable de entradas, consumos, mermas, ajustes y saldos de materias primas.
- **Arqueo Ciego:** Registro del conteo físico de efectivo en gaveta al cierre de turno sin revelación previa del monto esperado por el sistema.
- **Transactional Outbox:** Patrón que persiste eventos de dominio en la base de datos dentro de la misma transacción de negocio para su despacho asíncrono garantizado post-commit.

---

## 2. Referencias

1. INTERNATIONAL ORGANIZATION FOR STANDARDIZATION. *ISO/IEC/IEEE 29148: Systems and software engineering — Life cycle processes — Requirements engineering*. Ginebra: ISO, 2018.
2. INTERNATIONAL ORGANIZATION FOR STANDARDIZATION. *ISO/IEC 25010: Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — System and software quality models*. Ginebra: ISO, 2011.
3. CONGRESO DE COLOMBIA. *Ley 1480 de 2011: Por medio de la cual se expide el Estatuto del Consumidor*. Bogotá: Diario Oficial No. 48.220, 2011.
4. CONGRESO DE COLOMBIA. *Ley 1935 de 2018: Por medio de la cual se reglamenta la naturaleza y destinación de las propinas*. Bogotá: Diario Oficial No. 50.674, 2018.
5. AMELL GIL, Manuel Francisco. *Sistema Integral para la Gestión de un Restaurante: Etapa 1 — Definición del Sistema*. Cartagena de Indias: Universidad de Cartagena, 2026.
6. MONROY RÍOS, Martín. *Documento guía para la especificación de requisitos*. Cartagena de Indias: Universidad de Cartagena, Departamento de Ingeniería de Software, 2025.
7. REPOSITORIO MONSTERBURGUER POS. *Documentos de Arquitectura, Reglas de Negocio y PRD*. 2026.

---

## 3. Requisitos Específicos

### 3.1 Interfaces Externas

#### 3.1.1 Interfaces de Usuario (UI)
- **Terminal POS (`/pos`):** Cuadrícula responsiva con selector superior de modalidad (Mesa / Llevar), riel vertical de categorías, tarjetas de producto táctiles (≥ 96 px de altura) con badge de estado "Agotado", ticket lateral interactivo con botones de incremento/decremento, diálogo de edición de notas y botón de confirmación destacado en color naranja brasa (`--primary`).
- **Terminal KDS (`/cocina`):** Tablero Kanban de 3 columnas (Pendiente, En Preparación, Lista) bajo tema oscuro (`#0C0A09`), tarjetas con número de pedido grande (48–64 px), tipo de servicio, lista de ingredientes con notas culinarias resaltadas en amarillo, cronómetro en vivo y botón de avance de estado de ancho completo.
- **Módulo de Caja (`/caja`):** Interfaz con pestañas para el turno actual, historial de cierres, formulario de apertura de caja, diálogo de registro de ingresos/retiros manuales y pantalla de arqueo ciego con liquidación de descuadres.
- **Panel Administrativo (`/admin`):** Dashboard analítico con tarjetas de métricas (KPIs), gráficas de ventas por hora y Top 5 de productos, formularios de mantenimiento para catálogo, recetas de escandallo, insumos de inventario, Kardex cronológico y bitácora de eventos.

#### 3.1.2 Interfaces de Hardware
- **Impresora Térmica de Recibos:** Soporte para impresoras térmicas de papel continuo estándar de 80 mm conectadas mediante interfaz USB o red local, disparadas a través del motor de impresión del navegador con estilos `@media print`.
- **Gaveta de Dinero Electrónica:** Apertura manual o mediante pulso de la impresora térmica tras la confirmación de cobros en efectivo.
- **Dispositivos Táctiles:** Calibración para respuesta inmediata ante eventos de toque (*touch events*) sin dependencias de puntero del ratón (*mouse hover*).

#### 3.1.3 Interfaces de Software
- **Sistema Operativo del Servidor:** Linux (Ubuntu Server / Debian) o Windows 11 con soporte para Docker Engine.
- **Entorno de Ejecución:** Node.js versión 24 LTS ejecutando el framework NestJS 12.
- **Motor de Base de Datos:** PostgreSQL versión 17 (desarrollo local) y PostgreSQL 18 (contenedor de producción).
- **Capa de Abstracción de Datos:** Drizzle ORM conectado mediante el pool nativo `pg` (`node-postgres`).

#### 3.1.4 Interfaces de Comunicación
- **Protocolo de Red:** Protocolo HTTP/1.1 y HTTP/2 sobre TCP/IP en la red de área local (puerto 80 vía Nginx, puerto 3000 interno de la API).
- **Formato de Carga Útil:** JSON (JavaScript Object Notation) estructurado con cabeceras `Content-Type: application/json`.
- **Tiempo Real:** Protocolo Server-Sent Events (SSE) en la ruta `/api/v1/stream` con cabeceras `Content-Type: text/event-stream`, `Cache-Control: no-cache` y canales discriminados por rol (`pos`, `cocina`, `admin`).

---

### 3.2 Funciones (Requisitos Funcionales)

A continuación se especifican en detalle los 18 requisitos funcionales del sistema:

#### RF-01: Autenticación y Sesiones por Rol
- **Prioridad:** Must Have | **Trazabilidad:** HU-01 | **Reglas:** RN-51, RN-60
- **Entradas:** `username` (texto en minúsculas), `password` (texto claro).
- **Criterios de Validez:** Usuario no vacío, existencia en base de datos y estado `activo = true`. Límite de tasa: máx. 5 intentos fallidos por minuto por IP.
- **Secuencia de Operaciones:** 1) Recibe credenciales. 2) Consulta hash Argon2id de la tabla `usuario`. 3) Valida con mitigación de ataques de tiempo. 4) Genera token criptográfico opaco de 256 bits y persiste su hash SHA-256 en `sesion_usuario`. 5) Emite cookie HttpOnly `mb_session` con `SameSite=Strict`.
- **Manejo de Errores:** Credenciales inválidas devuelven HTTP 401 con mensaje genérico; usuario inactivo devuelve 403; exceso de intentos devuelve 429.
- **Salidas:** Objeto usuario autenticado con rol y redirección a `/pos`, `/cocina` o `/admin`.

#### RF-02: Gestión de Empleados y Permisos RBAC
- **Prioridad:** Must Have | **Trazabilidad:** HU-02 | **Reglas:** RN-51
- **Entradas:** `nombre`, `username`, `password` (≥ 8 caracteres), `rol` (`ADMIN`, `CAJERO`, `COCINA`).
- **Criterios de Validez:** `username` único en minúsculas. Prohibido desactivar al último administrador activo del sistema.
- **Secuencia:** 1) Admin introduce datos en `/admin/usuarios`. 2) Sistema calcula hash Argon2id. 3) Inserta o actualiza en tabla `usuario`.
- **Manejo de Errores:** Nombre de usuario duplicado responde HTTP 409 `NOMBRE_DUPLICADO`. Intento de auto-desactivación del último admin responde 400.
- **Salidas:** Usuario registrado con privilegios asignados.

#### RF-03: Creación y Apertura de Pedidos
- **Prioridad:** Must Have | **Trazabilidad:** HU-20 | **Reglas:** RN-10, RN-11, RN-15, RN-16
- **Entradas:** `tipo` (`MESA` o `LLEVAR`), `mesa_id` (obligatorio si `tipo = MESA`, nulo si `tipo = LLEVAR`), `cliente_id` opcional.
- **Criterios de Validez:** Si es `MESA`, la mesa no debe tener pedidos activos (`ABIERTO` o `CONFIRMADO`).
- **Secuencia:** 1) Obtiene la fecha operativa actual (`America/Bogota`). 2) Incrementa atómicamente el consecutivo diario en `contador_dia`. 3) Inserta registro en tabla `pedido` en estado `ABIERTO` con UUID v7.
- **Manejo de Errores:** Mesa ocupada viola el índice parcial `pedido_mesa_activa_uq` y devuelve HTTP 409 `MESA_OCUPADA`.
- **Salidas:** Registro de pedido creado con ID global y consecutivo del día.

#### RF-04: Composición de Ticket y Notas Culinarias
- **Prioridad:** Must Have | **Trazabilidad:** HU-21, HU-22 | **Reglas:** RN-02, RN-04, RN-05, RN-12, RN-13, RN-14
- **Entradas:** `pedido_id`, `producto_id`, `cantidad` (1 a 99), `nota` opcional (máx. 140 caracteres).
- **Criterios de Validez:** Pedido en estado `ABIERTO`, producto activo y no marcado como agotado.
- **Secuencia:** 1) Consulta precio y nombre del producto. 2) Inserta o actualiza fila en `pedido_item` copiando el precio como snapshot inmutable. 3) Recalcula total, base e impuesto en enteros COP según fórmula de redondeo *half-up*.
- **Manejo de Errores:** Pedido en estado diferente a `ABIERTO` responde HTTP 400 `ESTADO_INVALIDO`. Producto agotado responde 400 `PRODUCTO_AGOTADO`.
- **Salidas:** Ticket actualizado con totales recalculados.

#### RF-05: Confirmación Atómica de Pedidos y Envío a KDS
- **Prioridad:** Must Have | **Trazabilidad:** HU-23 | **Reglas:** RN-20, RN-31, RN-32, RN-33, RN-34, RN-36
- **Entradas:** `pedido_id`.
- **Criterios de Validez:** Pedido en estado `ABIERTO` con al menos 1 ítem. Existencias suficientes de todos los ingredientes con receta.
- **Secuencia:** 1) Inicia transacción `tx`. 2) Bloquea ingredientes requeridos con `SELECT ... FOR UPDATE` ordenado por `id ASC`. 3) Verifica existencias; descuenta `stock_actual` e inserta movimientos `CONSUMO` en kardex. 4) Crea comanda en estado `PENDIENTE` e ítems asociados en módulo cocina. 5) Pasa pedido a `CONFIRMADO` y registra `confirmado_at`. 6) Inserta evento `PedidoConfirmado` en `evento_sistema`. 7) Ejecuta `COMMIT` y dispara notificación SSE a cocina.
- **Manejo de Errores:** Si faltan existencias, ejecuta `ROLLBACK` total y devuelve HTTP 409 `STOCK_INSUFICIENTE` con el detalle de faltantes.
- **Salidas:** Pedido confirmado y comanda visible en la pantalla KDS.

#### RF-06: Consulta y Monitor de Pedidos Activos
- **Prioridad:** Must Have | **Trazabilidad:** HU-24 | **Reglas:** RN-11, RN-21
- **Entradas:** Petición HTTP `GET /api/v1/pedidos/activos`.
- **Criterios de Validez:** Sesión autenticada en terminal POS.
- **Secuencia:** 1) Consulta pedidos en estado `ABIERTO` y `CONFIRMADO` de la fecha operativa. 2) Asocia el estado de preparación de su comanda (`PENDIENTE`, `EN_PREPARACION`, `LISTA`). 3) Escucha eventos SSE para actualizar la vista en vivo.
- **Salidas:** Listado estructurado de pedidos activos y estado de mesas.

#### RF-07: Avance de Preparación de Comandas en Cocina (KDS)
- **Prioridad:** Must Have | **Trazabilidad:** HU-30, HU-31, HU-32 | **Reglas:** RN-21, RN-23
- **Entradas:** `comanda_id` y acción (`iniciar`, `lista`, `entregar`).
- **Criterios de Validez:** Transición válida de la máquina de estados: `PENDIENTE` → `EN_PREPARACION` → `LISTA` → `ENTREGADA`.
- **Secuencia:** 1) Inicia transacción. 2) Actualiza estado de comanda y asienta marca de tiempo (`iniciada_at`, `lista_at` o `entregada_at`). 3) Registra evento correspondiente en outbox. 4) Despacha notificación SSE al mostrador al pasar a `LISTA`.
- **Manejo de Errores:** Salto de estado no permitido devuelve HTTP 400 `TRANSICION_INVALIDA`.
- **Salidas:** Comanda actualizada en tablero KDS y cómputo de métricas en `v_tiempos_cocina`.

#### RF-08: Apertura de Sesión de Caja
- **Prioridad:** Must Have | **Trazabilidad:** HU-50 | **Reglas:** RN-40, RN-41
- **Entradas:** `monto_apertura` (entero COP ≥ 0).
- **Criterios de Validez:** El usuario no debe poseer otra sesión de caja en estado `ABIERTA`.
- **Secuencia:** 1) Verifica que no existan sesiones abiertas para el usuario. 2) Inserta registro en `sesion_caja` con estado `ABIERTA` y `abierta_at = now()`.
- **Manejo de Errores:** Sesión simultánea viola índice `sesion_caja_abierta_usuario_uq` y devuelve HTTP 409 `CAJA_YA_ABIERTA`. Monto negativo devuelve 400.
- **Salidas:** Sesión de caja abierta habilitada para cobros.

#### RF-09: Cobro de Pedidos y Emisión de Recibo POS
- **Prioridad:** Must Have | **Trazabilidad:** HU-51, HU-52 | **Reglas:** RN-01, RN-03, RN-04, RN-06, RN-40, RN-42, RN-43, RN-44, RN-45
- **Entradas:** `pedido_id`, `metodo` (`EFECTIVO`, `TARJETA`, `TRANSFERENCIA`), `monto` (entero COP > 0), `propina` opcional, `recibido` en efectivo.
- **Criterios de Validez:** Sesión de caja del cajero en estado `ABIERTA`. Monto igual a `total + propina`. Si es efectivo, `recibido >= monto`. Pedido no cerrado.
- **Secuencia:** 1) Inicia transacción. 2) Bloquea sesión y pedido. 3) Si el pedido estaba `ABIERTO`, lo confirma descontando inventario en la misma transacción. 4) Inserta fila en `recibo` consumiendo secuencia `recibo_numero_seq`. 5) Inserta fila en `pago` calculando cambio (`recibido - monto`). 6) Pasa pedido a `CERRADO`, registra `cerrado_at` y libera mesa. 7) Inserta evento `PedidoCobrado` en outbox. 8) Ejecuta `COMMIT`.
- **Manejo de Errores:** Sin caja abierta devuelve HTTP 409 `CAJA_NO_ABIERTA`. Pedido ya cobrado devuelve 409. Dinero recibido insuficiente devuelve 400.
- **Salidas:** Recibo generado con ID, consecutivo global y cambio, con plantilla de impresión a 80 mm.

#### RF-10: Movimientos Manuales de Caja (Ingresos y Retiros)
- **Prioridad:** Must Have | **Trazabilidad:** HU-53 | **Reglas:** RN-46
- **Entradas:** `sesion_caja_id`, `tipo` (`INGRESO` o `RETIRO`), `monto` (entero COP > 0), `motivo` (texto de 3 a 140 caracteres).
- **Criterios de Validez:** Sesión de caja `ABIERTA`. En retiros, el monto no puede superar el efectivo esperado acumulado en gaveta.
- **Secuencia:** 1) Bloquea la sesión de caja con `FOR UPDATE`. 2) Calcula efectivo esperado actual. 3) Si es retiro y dejaría el saldo negativo, rechaza la operación. 4) Inserta registro en `movimiento_caja`. 5) Registra evento `MovimientoCajaRegistrado` en outbox.
- **Manejo de Errores:** Retiro excesivo devuelve HTTP 409 `EFECTIVO_INSUFICIENTE`. Sesión cerrada devuelve 409. Motivo inválido devuelve 400.
- **Salidas:** Movimiento asentado y recálculo en vivo del efectivo esperado.

#### RF-11: Cierre de Sesión de Caja y Arqueo Ciego
- **Prioridad:** Must Have | **Trazabilidad:** HU-54 | **Reglas:** RN-47, RN-48
- **Entradas:** `sesion_caja_id`, `efectivo_contado` (entero COP ≥ 0).
- **Criterios de Validez:** Sesión en estado `ABIERTA`.
- **Secuencia:** 1) Inicia transacción y bloquea sesión. 2) Calcula `efectivo_esperado = apertura + ventasEfectivo + ingresos - retiros`. 3) Calcula `diferencia = efectivoContado - efectivoEsperado`. 4) Actualiza sesión a `CERRADA`, guarda arqueo y marca `cerrada_at = now()`. 5) Inserta evento `SesionCajaCerrada` en outbox y ejecuta `COMMIT`.
- **Salidas:** Resumen consolidado del turno con discriminación por medio de pago e impresión de reporte de arqueo.

#### RF-12: Mantenimiento de Catálogo de Menú
- **Prioridad:** Must Have | **Trazabilidad:** HU-10, HU-11 | **Reglas:** RN-02, RN-05
- **Entradas:** Categorías (nombre, orden), Productos (nombre, categoría, precio en COP, descripción, imagen).
- **Criterios de Validez:** Precio entero positivo > 0. Nombres de producto y categoría únicos (insensibles a mayúsculas).
- **Secuencia:** 1) Valida esquema Zod. 2) Inserta o modifica en tablas `categoria` o `producto`.
- **Manejo de Errores:** Nombre duplicado captura error de base de datos SQLSTATE '23505' y devuelve HTTP 409 `NOMBRE_DUPLICADO`.
- **Salidas:** Catálogo actualizado reflejado de inmediato en terminales POS.

#### RF-13: Formulación de Recetas y Agotamiento de Platos
- **Prioridad:** Must Have | **Trazabilidad:** HU-12, HU-13 | **Reglas:** RN-30, RN-31, RN-36
- **Entradas:** `producto_id`, lista de `{ ingrediente_id, cantidad }` (enteros > 0 en unidad base).
- **Criterios de Validez:** Producto e ingredientes activos existentes.
- **Secuencia:** 1) Elimina receta previa y asienta nuevas filas en `receta_item`. 2) Reevalúa existencias de materias primas; si algún ingrediente no alcanza para elaborar al menos una porción, marca automáticamente `producto.agotado = true`. 3) Emite evento SSE `catalogo.disponibilidad`.
- **Salidas:** Receta vinculada y estado de agotado actualizado en menú.

#### RF-14: Registro de Entrada de Mercancía
- **Prioridad:** Must Have | **Trazabilidad:** HU-41 | **Reglas:** RN-34, RN-36
- **Entradas:** `ingrediente_id`, `cantidad` (entero > 0 en unidad base), `costo_unitario`, `motivo`.
- **Criterios de Validez:** Ingrediente activo existente.
- **Secuencia:** 1) Inicia transacción. 2) Suma cantidad a `stock_actual` de la tabla `ingrediente`. 3) Inserta fila en `movimiento_inventario` (`ENTRADA`) con `stock_resultante`. 4) Reevalúa disponibilidad de platos que usan el ingrediente; si el stock ahora alcanza, desmarca `producto.agotado = false`. 5) Emite evento `catalogo.disponibilidad`.
- **Salidas:** Stock físico repuesto y productos reactivados en POS.

#### RF-15: Registro de Ajuste o Merma de Inventario
- **Prioridad:** Must Have | **Trazabilidad:** HU-42 | **Reglas:** RN-34, RN-35
- **Entradas:** `ingrediente_id`, `tipo` (`MERMA` o `AJUSTE`), `cantidad`, `motivo` obligatorio.
- **Criterios de Validez:** Motivo no vacío (mínimo 5 caracteres).
- **Secuencia:** 1) Inicia transacción. 2) Modifica `stock_actual`. 3) Registra movimiento en kardex con saldo resultante y justificación. 4) Reevalúa alertas de stock bajo y platos agotados.
- **Manejo de Errores:** Motivo ausente rechaza la operación con error 400.
- **Salidas:** Kardex cuadrado con justificación auditable.

#### RF-16: Consulta de Kardex de Materias Primas
- **Prioridad:** Must Have | **Trazabilidad:** HU-40, HU-43 | **Reglas:** RN-30, RN-34
- **Entradas:** Filtro opcional por `ingrediente_id` o rango de fechas.
- **Secuencia:** 1) Consulta la tabla `movimiento_inventario` ordenada por `created_at DESC`. 2) Asocia el nombre del ingrediente, usuario responsable y referencia al pedido causante.
- **Salidas:** Libro mayor de auditoría de movimientos con saldos históricos.

#### RF-17: Tablero de Control Administrativo (Dashboard)
- **Prioridad:** Must Have | **Trazabilidad:** HU-60, HU-61, HU-62 | **Reglas:** RN-16, RN-23, RN-36
- **Entradas:** Consulta a la ruta `/api/v1/admin/dashboard` para la fecha operativa actual.
- **Secuencia:** 1) Ejecuta consultas agregadas en modo solo lectura sobre las vistas SQL `v_ventas_dia`, `v_ventas_hora`, `v_tiempos_cocina` y `v_stock_alertas`. 2) Consolida ventas en COP, ticket promedio, tiempos promedio de cocina, histograma por hora y ranking Top 5.
- **Salidas:** Métricas en vivo de desempeño del restaurante.

#### RF-18: Bitácora Transaccional y Auditoría del Sistema
- **Prioridad:** Must Have | **Trazabilidad:** HU-63 | **Reglas:** RN-60, RN-61
- **Entradas:** Filtros opcionales por módulo o tipo de evento.
- **Secuencia:** 1) Consulta registros de la tabla `evento_sistema` ordenados por ID incremental. 2) Presenta la carga útil estructurada (JSON) de cada evento con usuario y marca de tiempo UTC ajustada a hora local.
- **Salidas:** Traza auditable completa del funcionamiento sistémico del software.

---

### 3.3 Requisitos de la Capacidad de Uso (Usabilidad)
- **Velocidad de Venta:** Registro y cobro de un combo de comidas rápidas estándar en **≤ 30 segundos** o un máximo de **4 toques de pantalla** tras seleccionar los productos.
- **Retroalimentación Inmediata:** Respuesta visual interactiva ante toques en pantalla en menos de **100 ms**, y despliegue de indicadores visuales de carga (*spinners* o *skeletons*) si una petición de red demora más de 300 ms.
- **Legibilidad en Cocina:** Tipografía de números de comanda entre 48 y 64 px y texto de ítems entre 20 y 24 px, garantizando lectura nítida a 2 metros de distancia bajo iluminación de cocina.
- **Accesibilidad y Contraste:** Cumplimiento de pautas WCAG 2.2 nivel AA en interfaces POS y Administrativa; relación de contraste de color superior a 4.5:1 en texto regular y estados acompañados invariablemente de icono más texto explicativo.

---

### 3.4 Requisitos de Desempeño

#### Requisitos Estáticos (Capacidad)
- **Soporte de Terminales Simultáneas:** Capacidad para operar de manera fluida con al menos 10 terminales web concurrentes en la red local (3 puntos de venta en mostrador, 2 pantallas KDS en cocina, 2 estaciones de gerencia y terminales de apoyo).
- **Volumen de Catálogo:** Soporte para al menos 500 productos activos, 100 categorías de menú y 300 materias primas controladas en inventario sin degradación de rendimiento.
- **Persistencia de Operaciones:** Capacidad para almacenar un histórico continuo de al menos 100.000 pedidos y 500.000 movimientos de kardex en la base de datos relacional.

#### Requisitos Dinámicos (Tiempo de Respuesta y Rendimiento)
- **Latencia de API:** Tiempo de respuesta en el percentil 95 (p95) inferior a **200 ms** para todas las transacciones de mostrador bajo condiciones de carga operativa normal en red local.
- **Propagación en Tiempo Real:** Latencia de entrega desde la confirmación del pedido en la terminal POS hasta la aparición visual de la comanda en la pantalla KDS de cocina inferior a **2 segundos**.
- **Carga Inicial de la Aplicación:** Tiempo de carga y renderizado inicial de la SPA inferior a **2 segundos** dentro de la red LAN del restaurante.

---

### 3.5 Requisitos de Bases de Datos
- **Motor Relacional:** PostgreSQL 17/18 configurado con codificación UTF-8 y zona horaria `UTC`.
- **Integridad Referencial:** Restricciones de clave foránea estrictas con políticas `ON DELETE RESTRICT` en tablas financieras y de inventario, impidiendo la eliminación accidental de registros con transacciones históricas asociadas.
- **Tipado Monetario:** Columnas financieras definidas como `bigint` para almacenar dinero en pesos colombianos (COP) sin fracciones decimales, prohibiendo estrictamente tipos de coma flotante (`float`, `double precision`).
- **Control de Concurrencia Optimista:** Columna `version integer NOT NULL DEFAULT 0` en tablas susceptibles de mutaciones concurrentes (`pedido`, `comanda`, `sesion_caja`).
- **Aislamiento Transaccional:** Bloqueos pesimistas `SELECT ... FOR UPDATE` ordenados por clave primaria para el descuento atómico de ingredientes de inventario, asegurando cumplimiento estricto de las propiedades ACID.

---

### 3.6 Restricciones de Diseño
- **Arquitectura de Monolito Modular:** Todo el código backend reside en un único proyecto NestJS pero particionado en módulos con fronteras selladas; las dependencias cruzadas entre módulos se realizan exclusivamente a través de servicios públicos (`*.public.ts`) o mediante eventos de dominio.
- **Validación Estática de Arquitectura:** Integración de la herramienta `dependency-cruiser` en el proceso de integración para bloquear en compilación cualquier violación de fronteras arquitectónicas.
- **Validación Compartida de Esquemas:** Uso exclusivo de librerías Zod para definición y validación de tipos y contratos en el paquete compartido `@mb/shared`.

---

### 3.7 Atributos de Calidad (ISO/IEC 25010)

- **Adecuación Funcional:** Cobertura exhaustiva de las reglas de negocio descritas en `BUSINESS_RULES.md`, garantizando completitud y exactitud en el cobro, control de inventario y arqueo.
- **Fiabilidad y Tolerancia a Fallos:** Transacciones atómicas de base de datos con capacidad de recuperación automática (*rollback* completo) ante fallos imprevistos de stock o conectividad, previniendo estados inconsistentes o comandas huérfanas.
- **Eficiencia de Desempeño:** Uso eficiente de recursos de memoria y CPU en el servidor local mediante la arquitectura de un solo proceso Node.js y consultas SQL optimizadas con índices parciales y compuestos.
- **Seguridad Operacional:** Autenticación robusta con Argon2id, tokens de sesión criptográficos aleatorios de 256 bits, cookies protegidas `HttpOnly` y `SameSite=Strict`, defensas activas contra ataques de fuerza bruta (Throttling) y falsificación de peticiones en sitios cruzados (CSRF con validación estricta de `Origin`/`Referer`).
- **Mantenibilidad:** Código modular fuertemente tipado en TypeScript, cobertura de pruebas automatizadas y desacoplamiento mediante patrones de diseño estandarizados.
- **Portabilidad:** Despliegue estandarizado en contenedores Docker, facilitando la instalación idéntica en cualquier sistema operativo host sin fricciones de dependencias externas.

---

### 3.8 Información de Soporte
- Esquemas relacionales Drizzle y scripts de migración SQL en `apps/api/drizzle/`.
- Suite automatizada de pruebas ejecutables mediante comandos de monorepositorio `pnpm test`.
- Informes de verificación de aseguramiento de calidad recopilados en `docs/verificacion/`.

---

## 4. Verificación

La verificación del cumplimiento de los requisitos del software se estructuró de manera paralela a la implementación, empleando múltiples estrategias de prueba:

| Requisito | Método de Verificación | Procedimiento y Evidencia de Cumplimiento |
|---|---|---|
| **RF-01 (Autenticación)** | Prueba de Integración | Verificación automatizada en `apps/api/test/auth.spec.ts`: pruebas de login exitoso, rechazo de credenciales falsas, mitigación de fuerza bruta y expiración de sesiones opacas. (13 tests verdes). |
| **RF-02 (Gestión Usuarios)** | Inspección y Prueba Unitaria | Validación estricta de esquemas Zod en `@mb/shared` y comprobación de restricción para no desactivar al último administrador. |
| **RF-03 a RF-06 (Pedidos)** | Pruebas de Integración y Concurrencia | Ejecución de pruebas en `apps/api/test/pedidos.spec.ts` y `mesas.spec.ts`: control de mesas ocupadas mediante índice único parcial y numeración correlativa diaria. |
| **RF-05 (Confirmación Atómica)** | Prueba de Integración Transaccional | Verificación de concurrencia pesimista: confirmación simultánea del último ingrediente disponible, comprobando que exactamente una terminal confirma y la otra recibe error 409 con rollback total. |
| **RF-07 (KDS Cocina)** | Prueba E2E en Navegador | Recorrido interactivo con Chrome DevTools sobre la ruta `/cocina`: recepción de comandas en vivo vía SSE, cambio de estados y alertas visuales a los 8 y 12 minutos. |
| **RF-08 a RF-11 (Caja y Cobro)** | Pruebas de Integración | Suite en `apps/api/test/caja.spec.ts` (18 tests verdes): cobro en efectivo con cálculo de cambio, restricción a un único medio de pago, movimientos manuales de caja con rechazo de saldo negativo y cuadre exacto en arqueo. |
| **RF-12 a RF-16 (Catálogo e Inventario)**| Pruebas de Integración | Suite en `apps/api/test/catalogo-inventario.spec.ts` (25 tests verdes): control de unicidad de nombres (`BE-01`), recetas, descuento de existencias, cálculo de kardex y conmutación de productos agotados. |
| **RF-17 y RF-18 (Admin y Auditoría)** | Inspección de Datos y Consultas SQL | Verificación de vistas analíticas agregadas `v_*` y persistencia secuencial de eventos en `evento_sistema`. |
| **RNF-07 (Modularidad)** | Análisis Estático de Código | Ejecución de `pnpm depcruise`: **0 violaciones arquitectónicas** detectadas sobre 108 módulos y 385 dependencias evaluadas. |

---

## 5. Apéndices

### 5.1 Suposiciones y dependencias
1. **Red de Área Local Estable:** Se asume que el restaurante dispone de un enrutador o punto de acceso Wi-Fi/Ethernet operativo en el local que interconecta el servidor y las terminales cliente.
2. **Suministro Eléctrico Continuo:** Se asume que el servidor local cuenta con respaldo de energía básica (UPS) para prevenir apagados intempestivos durante la escritura en disco de PostgreSQL.
3. **Impresoras Compatibles:** Se asume el uso de impresoras térmicas de 80 mm reconocidas por el sistema operativo cliente como dispositivos de impresión estándar.

### 5.2 Acrónimos y abreviaciones
- **ACID:** Atomicidad, Consistencia, Aislamiento y Durabilidad (*Atomicity, Consistency, Isolation, Durability*).
- **ADR:** Registro de Decisiones de Arquitectura (*Architecture Decision Record*).
- **API:** Interfaz de Programación de Aplicaciones (*Application Programming Interface*).
- **CI/CD:** Integración Continua y Despliegue Continuo (*Continuous Integration / Continuous Deployment*).
- **COP:** Peso Colombiano (Código de moneda ISO 4217).
- **CSRF:** Falsificación de Petición en Sitios Cruzados (*Cross-Site Request Forgery*).
- **DTO:** Objeto de Transferencia de Datos (*Data Transfer Object*).
- **E2E:** De Extremo a Extremo (*End-to-End*).
- **HU:** Historia de Usuario.
- **KDS:** Sistema de Visualización de Cocina (*Kitchen Display System*).
- **ORM:** Mapeo Objeto-Relacional (*Object-Relational Mapping*).
- **PK / FK:** Clave Primaria / Clave Foránea (*Primary Key / Foreign Key*).
- **POS:** Punto de Venta (*Point of Sale*).
- **RBAC:** Control de Acceso Basado en Roles (*Role-Based Access Control*).
- **RF / RNF:** Requisito Funcional / Requisito No Funcional.
- **RN:** Regla de Negocio.
- **SPA:** Aplicación de Página Única (*Single Page Application*).
- **SSE:** Eventos Enviados por el Servidor (*Server-Sent Events*).
- **UI / UX:** Interfaz de Usuario / Experiencia de Usuario (*User Interface / User Experience*).
- **UUID:** Identificador Único Universal (*Universally Unique Identifier*).
