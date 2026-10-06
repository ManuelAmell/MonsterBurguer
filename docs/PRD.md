# PRD — MonsterBurguer POS (MVP)

## 1. Problema

Los procesos del restaurante (atención, pedidos, cocina, inventario, cobro) se manejan por separado: se pierden o duplican pedidos, cocina no sabe el orden ni el tiempo de cada comanda, el inventario no refleja lo vendido y el administrador no tiene datos para decidir. (Ver documento *Etapa 1 — Definición del sistema*.)

## 2. Objetivo del MVP

Un POS **funcional de punta a punta** que permita operar un turno real de la hamburguesería:

> **Tomar pedido → cocina lo prepara viendo la comanda en vivo → inventario se descuenta solo → se cobra y se emite recibo → la caja cuadra al cierre → el admin ve ventas, alertas y productos agotados automáticamente.**

### Métricas de éxito

| Métrica | Meta |
|---|---|
| Tiempo para registrar y cobrar un combo de 3 ítems | ≤ 30 s / ≤ 4 toques tras elegir productos |
| Latencia confirmación → aparición en KDS | ≤ 2 s |
| Diferencia stock sistema vs. conteo físico tras un turno de prueba | ≤ 2 % en ingredientes con receta |
| Cierre de caja | Calculado automáticamente, sin hoja de cálculo |
| Errores críticos en un turno de prueba completo | 0 |

## 3. Usuarios y roles

| Rol | Quién | Dispositivo | Necesita |
|---|---|---|---|
| **CAJERO** | Persona en mostrador | Tablet/PC táctil | Registrar pedidos rápido, cobrar, cuadrar caja |
| **COCINA** | Cocineros | Monitor/TV en cocina | Ver comandas en orden, marcar avance, ver notas |
| **ADMIN** | Dueño/administrador | PC | Menú, precios, recetas, inventario, reportes, anulaciones, usuarios |

## 4. Alcance

### Dentro del MVP

| # | Épica | Historias |
|---|---|---|
| E1 | Identidad | HU-01, HU-02 |
| E2 | Catálogo | HU-10 – HU-13 |
| E3 | Pedidos (POS) | HU-20 – HU-25 |
| E4 | Cocina (KDS) | HU-30 – HU-32 |
| E5 | Inventario | HU-40 – HU-43 |
| E6 | Caja y cobro | HU-50 – HU-54 |
| E7 | Administración | HU-60 – HU-63 |

### Fuera del MVP (backlog priorizado)

| Versión | Funcionalidad |
|---|---|
| v1.1 | Vista móvil de mesero · modificadores/adiciones con precio (extra queso, sin pan) · combos configurables · dividir cuenta · descuentos y cortesías · devoluciones · proveedores y órdenes de compra · PIN rápido para cambiar de usuario |
| v1.2 | Domicilios (propios) · clientes frecuentes y puntos · impresora térmica directa (ESC/POS) y de cocina · reportes exportables (CSV/PDF) |
| v2 | **DEE POS / factura electrónica DIAN** vía proveedor tecnológico — *requisito antes de operar formalmente* · integraciones Rappi/iFood · multi-sucursal · modo offline (PWA) · reservas |

## 5. Historias de usuario y criterios de aceptación

Formato: *Como <rol> quiero <acción> para <beneficio>.* Las reglas citadas (`RN-xx`) están en [BUSINESS_RULES.md](./BUSINESS_RULES.md).

### E1 — Identidad

**HU-01 Iniciar sesión.** Como empleado quiero entrar con usuario y contraseña para usar mi pantalla.
- [ ] Credenciales válidas → redirige según rol (`/pos`, `/cocina`, `/admin`).
- [ ] Credenciales inválidas → mensaje genérico "Usuario o contraseña incorrectos" junto al formulario; tras 5 intentos fallidos en 1 min, espera de 60 s.
- [ ] Usuario inactivo no puede entrar.
- [ ] La sesión expira tras 12 h sin actividad; "Cerrar sesión" la invalida en el servidor.

**HU-02 Gestionar usuarios.** Como admin quiero crear, editar, desactivar usuarios y asignar rol.
- [ ] No se puede desactivar al último ADMIN activo.
- [ ] Contraseña mínima de 8 caracteres; se guarda con argon2id.

### E2 — Catálogo

**HU-10 Categorías.** Como admin quiero crear/ordenar/activar categorías del menú.
- [ ] El orden se refleja en el rail del POS.

**HU-11 Productos.** Como admin quiero crear/editar productos con nombre, categoría, precio final al público (RN-02), descripción y estado activo.
- [ ] Precio entero > 0.
- [ ] Desactivar un producto lo oculta del POS sin afectar pedidos existentes (RN-05).

**HU-12 Recetas.** Como admin quiero definir los ingredientes y cantidades de cada producto para que el inventario se descuente solo.
- [ ] Cantidades enteras > 0 en la unidad base del ingrediente.
- [ ] Productos sin receta muestran advertencia en la lista.

**HU-13 Disponibilidad.** Como admin quiero ver y forzar el estado "agotado" de un producto.
- [ ] El sistema lo marca/desmarca automáticamente según stock (RN-36); el admin puede forzarlo.

### E3 — Pedidos (POS)

**HU-20 Crear pedido.** Como cajero quiero iniciar un pedido para llevar o para una mesa libre.
- [ ] Las mesas ocupadas aparecen marcadas (icono + texto) y no se pueden elegir (RN-11).

**HU-21 Armar ticket.** Como cajero quiero agregar productos tocándolos, cambiar cantidades, agregar notas y quitar líneas.
- [ ] Tocar un producto agrega 1; si ya existe la misma línea sin nota, incrementa cantidad.
- [ ] Productos agotados se ven deshabilitados con "Agotado".
- [ ] El total se recalcula al instante usando `@mb/shared/money` (RN-04); base e impuesto solo se muestran si el régimen tiene tasa > 0 (RN-03).
- [ ] El ticket se guarda en el servidor (pedido `ABIERTO`); recargar la página no lo pierde.

**HU-22 Buscar producto.** Como cajero quiero buscar por nombre.
- [ ] Filtra mientras escribo (debounce 200 ms), insensible a tildes y mayúsculas.

**HU-23 Enviar a cocina.** Como cajero quiero confirmar el pedido para que cocina lo vea.
- [ ] Aparece en el KDS en ≤ 2 s.
- [ ] Si falta stock, se muestra qué ingredientes y el pedido sigue `ABIERTO` (RN-33).
- [ ] Doble toque no genera doble confirmación (botón deshabilitado + idempotencia en servidor).

**HU-24 Ver pedidos activos.** Como cajero quiero ver la lista de pedidos abiertos/confirmados con su estado de cocina, para avisar al cliente cuando esté listo.
- [ ] Se actualiza en tiempo real; cuando una comanda pasa a LISTA, toast "Pedido #014 listo".

**HU-25 Anular pedido.** Como admin quiero anular un pedido no cobrado indicando el motivo.
- [ ] Cajero no ve la opción (RN-50/51).
- [ ] Stock se revierte o se registra merma según estado de la comanda (RN-35); la comanda desaparece del KDS.

### E4 — Cocina (KDS)

**HU-30 Ver comandas.** Como cocinero quiero ver las comandas en columnas Pendiente / Preparando / Lista, en orden de llegada, con número, tipo, tiempo transcurrido y notas resaltadas.
- [ ] Nuevas comandas aparecen sin recargar; la conexión se recupera sola si se cae (indicador "Reconectando…").

**HU-31 Avanzar estado.** Como cocinero quiero tocar un botón grande para iniciar, marcar lista y entregar.
- [ ] Deshacer disponible 10 s (RN-22).

**HU-32 Alertas de tiempo.** Como cocinero quiero ver qué comandas están atrasadas.
- [ ] Warning ≥ 8 min, grave ≥ 12 min, con icono + texto (RN-23).

### E5 — Inventario

**HU-40 Ingredientes.** Como admin quiero registrar ingredientes con unidad base, stock mínimo y costo unitario.

**HU-41 Entrada de mercancía.** Como admin quiero registrar entradas (compras) que suman stock.
- [ ] Crea movimiento `ENTRADA`; puede desmarcar productos agotados (RN-36).

**HU-42 Ajuste / merma.** Como admin quiero ajustar el stock tras un conteo físico o registrar mermas, con motivo.

**HU-43 Kardex.** Como admin quiero ver los movimientos de un ingrediente con fecha, tipo, cantidad, usuario y referencia (pedido).

### E6 — Caja y cobro

**HU-50 Abrir caja.** Como cajero quiero abrir mi caja con el monto base para empezar a cobrar.
- [ ] Sin caja abierta, el botón "Cobrar" lleva a abrir caja (RN-40).

**HU-51 Cobrar.** Como cajero quiero cobrar con uno o varios métodos de pago y ver el cambio.
- [ ] Validaciones RN-42/43; cobrar un pedido abierto lo envía a cocina (RN-44).
- [ ] Propina solo en MESA, nunca preseleccionada (RN-06).

**HU-52 Recibo.** Como cajero quiero imprimir o mostrar el recibo.
- [ ] Recibo 80 mm con: logo, nombre/NIT o CC del negocio (configurable), consecutivo, fecha, ítems, total, propina (si la hubo), pagos, cambio, cajero, la leyenda "No responsable de INC" (régimen actual) y "Documento no fiscal" (RN-45). Base e impuesto solo si el régimen tiene tasa > 0.

**HU-53 Movimientos de caja.** Como cajero quiero registrar ingresos/retiros de efectivo con motivo.

**HU-54 Cerrar caja.** Como cajero quiero cerrar mi caja contando el efectivo y ver el sobrante o faltante.
- [ ] Fórmula RN-47; resumen por método de pago; imprimible.

### E7 — Administración (retroalimentación)

**HU-60 Dashboard del día.** Como admin quiero ver ventas, número de pedidos, ticket promedio, tiempo promedio de preparación, ventas por hora y top 5 productos.
- [ ] Datos de la fecha operativa actual (RN-16), actualizados en vivo.

**HU-61 Alertas.** Como admin quiero ver alertas de stock bajo, ingredientes agotados y productos desactivados automáticamente, con acceso directo a "Registrar entrada".

**HU-62 Reporte de ventas.** Como admin quiero consultar ventas por rango de fechas: totales, por método de pago, por producto y por categoría, e historial de cierres de caja.

**HU-63 Bitácora de interacciones.** Como admin quiero ver los eventos entre subsistemas (pedido confirmado → consumo de inventario → comanda → cobro) para entender y auditar el funcionamiento del sistema.

## 6. Requisitos no funcionales

| Categoría | Requisito |
|---|---|
| Rendimiento | API p95 < 200 ms en operaciones de POS con 10 usuarios concurrentes; carga inicial del POS < 2 s en LAN |
| Disponibilidad | Funciona sin internet dentro de la LAN (servidor local) |
| Concurrencia | Dos cajas vendiendo el último ingrediente: exactamente una confirma (test de integración obligatorio) |
| Seguridad | Ver ARCHITECTURE §9 |
| Accesibilidad | WCAG 2.2 AA en POS y Admin (ver DESIGN §8) |
| Respaldo | `pg_dump` diario; restauración probada |
| Idioma / región | Español (Colombia), COP, `America/Bogota` |

## 7. Datos semilla (demo)

- Usuarios: `admin`, `caja1`, `cocina1`.
- 5 categorías, ~15 productos con receta (hamburguesas, papas, bebidas, postres), ~20 ingredientes con stock, 8 mesas.

## 8. Riesgos y supuestos

| Riesgo / supuesto | Mitigación |
|---|---|
| Régimen actual: no responsable de INC; si los ingresos superan 3.500 UVT o se abre otro local, pasa a responsable | `regimen_tributario` configurable (RN-03); validar con contador |
| Recetas inexactas → inventario desfasado | Kardex + ajustes por conteo físico; advertencia de productos sin receta |
| Corte de red en la LAN | SSE reconecta y re-sincroniza; las acciones fallidas muestran error con reintento |
| El recibo no es documento electrónico DIAN (obligatorio desde 2024) | MVP = herramienta interna para llevar las cuentas, leyenda "Documento no fiscal"; DEE POS en v2 antes de operar formalmente |
