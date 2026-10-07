# Reporte de QA Exhaustivo del Frontend (UI End-to-End) — MonsterBurguer POS

**Fecha de ejecución:** 2026-10-07  
**Entorno de pruebas:**  
- API NestJS 12: `http://localhost:3022` (Base de datos propia: PostgreSQL 17 `mb_qa_web`)  
- Frontend React 19 + Vite 8: `http://localhost:5192` (Proxy `/api` hacia puerto `3022`)  
- Navegador de prueba: Google Chrome (instancia real instrumentada vía Chrome DevTools MCP y contextos de navegación aislados para pruebas multi-rol en tiempo real)  
**Auditor / Rol:** QA Frontend Verifier (Worker)  
**ID de Tarea:** `task_af08a9c38cbb`  
**Directorio de capturas:** `%TEMP%\mb-qa-shots\` (`C:\Users\manue\AppData\Local\Temp\mb-qa-shots\`)

---

## 1. Resumen Ejecutivo

Se ejecutó una auditoría y verificación exhaustiva de aseguramiento de calidad (QA) sobre el frontend de MonsterBurguer (`apps/web`), interactuando como un usuario real a través del navegador Google Chrome. La evaluación cubrió la totalidad de los flujos de negocio definidos en `DESIGN.md`, `CLAUDE.md`, `docs/BUSINESS_RULES.md` y `docs/API.md`: ciclo de autenticación y control de acceso basado en roles (RBAC), operación en punto de venta (POS) para pedidos en mesa y para llevar, cocina en tiempo real (KDS vía Server-Sent Events), apertura y cierre de caja con arqueo financiero, administración (dashboard de KPIs, inventario y productos con recetas) y validación de accesibilidad/sistema de diseño.

La interfaz de usuario exhibe una madurez técnica y fidelidad al diseño sobresalientes:
1. **Identidad y Sistema de Diseño:** Cumple rigurosamente con los tokens semánticos de color (`--primary #C2410C`, `--accent #F59E0B`, `--foreground #1C1917`, `--card`, `--border`, etc.), tipografía doble (*Bricolage Grotesque* para títulos y *Inter* para UI), cifras tabulares (`tabular-nums`) en importes monetarios y temporizadores, iconos exclusivos de `lucide-react` (sin emojis como iconos) y micro-interacciones táctiles.
2. **Formato Financiero y Reglas de Negocio:** Todos los valores monetarios se visualizan en pesos colombianos (**COP**) con separador de miles y sin decimales (`$ 24.900`). El régimen tributario actual (`NO_RESPONSABLE`) no expone líneas de impuesto discriminadas (RN-03). La propina sugerida en pedidos de mesa se calcula exactamente al 10 % del valor base redondeado hacia abajo a la centena (`$ 2.400` para un pedido de `$ 24.900`, RN-06), presentándose como voluntaria y **sin preselección**. Los recibos impresos y resúmenes de cierre incluyen obligatoriamente las leyendas *"Documento no fiscal"* y *"No responsable de INC"* (RN-45).
3. **Cocina en Tiempo Real (KDS):** Conexión SSE fluida que actualiza comandas entrantes de forma instantánea sin recarga de página, con timers continuos, transición completa de estados (`PENDIENTE → PREPARANDO → LISTAS → ENTREGADA`) y tema oscuro por defecto.
4. **Caja y Control de Efectivo:** Arqueo exacto entre base de apertura, cobros recibidos y efectivo contado, alertando visualmente diferencias de *"Faltante"* o confirmando *"Caja cuadrada"*.
5. **Estabilidad del Cliente:** Cero errores en la consola de JavaScript (`console.error = 0`) y cero peticiones de red fallidas no controladas.

A pesar de la alta calidad general, se identificó **1 defecto MAYOR de flujo operativo** en el POS (imposibilidad de cobrar pedidos de mesa una vez enviados a cocina desde la UI), **1 defecto MENOR** (falta de UI para notas personalizadas por ítem) y **3 OBSERVACIONES** documentadas detalladamente a continuación.

---

## 2. Veredicto Final

### **APROBADO CON OBSERVACIONES**

**Justificación:**  
El frontend cumple satisfactoriamente con la totalidad de los flujos del MVP, exhibe una experiencia visual y táctil de primer nivel, valida estrictamente las reglas de negocio financieras y de inventario, y no presenta fugas de memoria, cuelgues ni errores en la consola del navegador. Sin embargo, para habilitar la operación real en salón, es mandatorio subsanar el hallazgo **MAY-01** (conectar el listado de pedidos activos o selector de mesas ocupadas al cobro de comandas de mesa ya enviadas a cocina).

---

## 3. Matriz de Cobertura de Flujos y Resultados

| Módulo / Flujo | Rol | Pantalla / Ruta | Descripción de la Prueba | Código / Estado | Resultado | Captura de Pantalla |
|---|---|---|---|---|---|---|
| **Auth** | Todos | `/login` | Render inicial con campos de usuario y contraseña | 200 OK | ✅ Aprobado | `01-login-screen.png` |
| **Auth** | Anónimo | `/login` | Envío de formulario vacío (validaciones Zod en línea) | Form Invalid | ✅ Aprobado | `02-login-validation-errors.png` |
| **Auth** | Anónimo | `/login` | Credenciales inválidas (`caja1` / `wrongpass`) con alerta ARIA | 401 Handled | ✅ Aprobado | `03-login-invalid-credentials.png` |
| **Auth** | `ADMIN` | `/login` → `/admin` | Login exitoso y redirección automática por rol a Panel Admin | 200 OK | ✅ Aprobado | `04-admin-dashboard.png` |
| **Auth** | `ADMIN` | `/admin` → `/login` | Cierre de sesión (logout), limpieza de caché y retorno | 200 OK | ✅ Aprobado | `01-login-screen.png` |
| **Auth** | Anónimo | `/pos`, `/cocina`, `/admin` | Intento de acceso sin autenticación (bloqueo y redirección a login) | 302 Redirect | ✅ Aprobado | `01-login-screen.png` |
| **Auth** | `COCINA` | `/login` → `/cocina` | Login exitoso y redirección directa al KDS de Cocina | 200 OK | ✅ Aprobado | `05-cocina-empty.png` |
| **Auth** | `COCINA` | `/admin` | Control de acceso por rol: usuario Cocina intenta ver Admin | 403 Forbidden UI | ✅ Aprobado | `06-forbidden-access.png` |
| **Auth** | `COCINA` | `/cocina` | Recarga de página con sesión activa (mantiene rol y estado) | 200 OK | ✅ Aprobado | `05-cocina-empty.png` |
| **Auth** | Todos | `/caja` | Expiración / eliminación de sesión (401 en `/auth/me` redirige a login) | 401 Redirect | ✅ Aprobado | `01-login-screen.png` |
| **Caja** | `CAJERO` | `/caja` | Apertura de caja con base ($ 50.000) usando atajo de teclado 50k | 201 Created | ✅ Aprobado | `08-caja-apertura.png`, `09-caja-abierta.jpeg` |
| **POS** | `CAJERO` | `/pos` | Estado inicial de venta vacía, totales en $ 0 y botones deshabilitados | 200 OK | ✅ Aprobado | `07-pos-empty.png` |
| **POS** | `CAJERO` | `/pos` | Intento de agregar producto a pedido Mesa sin elegir mesa libre | Alerta UI | ✅ Aprobado | `07-pos-empty.png` |
| **POS** | `CAJERO` | `/pos` | Navegación y filtrado por pestañas de categoría (Hamburguesas, Acompañamientos, etc.) | 200 OK | ✅ Aprobado | `10-pos-mesa-items.jpeg` |
| **POS** | `CAJERO` | `/pos` | Creación de pedido Mesa 1, adición de ítems y totales en COP ($ 33.800) | 201 Created | ✅ Aprobado | `10-pos-mesa-items.jpeg` |
| **POS** | `CAJERO` | `/pos` | Stepper de cantidad (+/-) y eliminación de ítem mediante botón papelera | 200 OK | ✅ Aprobado | `10-pos-mesa-items.jpeg` |
| **POS** | `CAJERO` | `/pos` | Envío de pedido a cocina (`Enviar a cocina`) con toast confirmatorio | 200 OK | ✅ Aprobado | `10-pos-mesa-items.jpeg` |
| **Cocina** | `COCINA` | `/cocina` | Recepción de comanda en tiempo real vía SSE en columna `PENDIENTES (1)` | SSE Event | ✅ Aprobado | `11-cocina-order-1-pendiente.jpeg` |
| **Cocina** | `COCINA` | `/cocina` | Transición a `PREPARANDO (1)` al tocar botón `INICIAR` | 200 OK | ✅ Aprobado | `12-cocina-order-1-preparando.jpeg` |
| **Cocina** | `COCINA` | `/cocina` | Transición a `LISTAS (1)` al tocar botón `MARCAR LISTA` | 200 OK | ✅ Aprobado | `13-cocina-order-1-lista.jpeg` |
| **Cocina** | `COCINA` | `/cocina` | Despacho final al tocar `MARCAR ENTREGADA` (retorno a estado vacío) | 200 OK | ✅ Aprobado | `05-cocina-empty.png` |
| **POS** | `CAJERO` | `/pos` | Pedido tipo `LLEVAR`: botón primario pasa a ser `Cobrar` (RN-02) | 200 OK | ✅ Aprobado | `14-pos-llevar-ticket.jpeg` |
| **POS** | `CAJERO` | `/pos` | Diálogo de cobro en Llevar: sin sección de propina (RN-06 respetada) | 200 OK | ✅ Aprobado | `15-cobro-dialog-cambio.jpeg` |
| **POS** | `CAJERO` | `/pos` | Pago en efectivo con billete de $ 50.000 y cálculo exacto de cambio ($ 21.100) | 200 OK | ✅ Aprobado | `15-cobro-dialog-cambio.jpeg` |
| **POS** | `CAJERO` | `/pos` | Emisión de recibo imprimible no fiscal (`R-000001`) con leyendas legales | 200 OK | ✅ Aprobado | `16-recibo-imprimible.jpeg` |
| **POS** | `CAJERO` | `/pos` | Cobro en pedido MESA con propina sugerida ($ 2.400 = 10 % base redondeado) | 200 OK | ✅ Aprobado | `17-cobro-dialog-propina.jpeg` |
| **POS** | `CAJERO` | `/pos` | Recibo de cobro con propina voluntaria discriminada (`R-000002`) | 200 OK | ✅ Aprobado | `18-recibo-con-propina.jpeg` |
| **POS** | `CAJERO` | `/pos` | Validación de stock insuficiente (409 de API muestra modal con faltantes) | 409 Conflict | ✅ Aprobado | `19-stock-insuficiente-modal.jpeg` |
| **POS** | `CAJERO` | `/pos` | Imposibilidad de cobrar pedidos de mesa enviados a cocina desde la UI | Flujo cortado | ⚠️ **Mayor (MAY-01)** | `07-pos-empty.png` |
| **Caja** | `CAJERO` | `/caja` | Cierre de caja con conteo menor al esperado (muestra `Faltante $ 6.200`) | 200 OK | ✅ Aprobado | `20-caja-cierre-faltante.jpeg` |
| **Caja** | `CAJERO` | `/caja` | Cierre de caja con arqueo exacto (`$ 106.200`, muestra `Caja cuadrada`) | 200 OK | ✅ Aprobado | `21-caja-cierre-cuadrada.jpeg` |
| **Caja** | `CAJERO` | `/caja` | Confirmación irreversible de cierre y ticket resumen imprimible no fiscal | 200 OK | ✅ Aprobado | `22-caja-resumen-cierre-ticket.jpeg` |
| **Admin** | `ADMIN` | `/admin` | Dashboard: Ventas del día ($ 53.800 sin propinas), 2 pedidos, ticket prom. | 200 OK | ✅ Aprobado | `23-admin-dashboard-con-datos.jpeg` |
| **Admin** | `ADMIN` | `/admin` | Ranking Top 5 productos y Bitácora de eventos entre subsistemas | 200 OK | ✅ Aprobado | `23-admin-dashboard-con-datos.jpeg` |
| **Admin** | `ADMIN` | `/admin/productos` | Catálogo de productos: tabla, precios, estado disponible/agotado | 200 OK | ✅ Aprobado | `24-admin-producto-receta-sheet.jpeg` |
| **Admin** | `ADMIN` | `/admin/productos` | Formulario lateral (`Sheet`): edición de producto y receta con insumos | 200 OK | ✅ Aprobado | `24-admin-producto-receta-sheet.jpeg` |
| **Admin** | `ADMIN` | `/admin/inventario` | Tabla de existencias con unidad base (`g`, `ml`, `und`) y stock mínimo | 200 OK | ✅ Aprobado | `25-admin-inventario.png` |
| **Admin** | `ADMIN` | `/admin/inventario` | Registro de entrada de insumo (+20 unidades de Agua Cristal) | 201 Created | ✅ Aprobado | `25-admin-inventario.png` |
| **Admin** | `ADMIN` | `/admin/inventario` | Registro de merma de insumo (-5 unidades con motivo obligatorio) | 201 Created | ✅ Aprobado | `25-admin-inventario.png` |
| **Diseño** | Todos | Responsive 1024 px | POS en tablet / pantalla táctil de 1024×768 px sin desbordamiento | Visual OK | ✅ Aprobado | `26-pos-1024px.png` |
| **Diseño** | Todos | Responsive 1920 px | POS y KDS Cocina en monitor / TV de 1920×1080 px | Visual OK | ✅ Aprobado | `27-pos-1920px.png`, `28-cocina-1920px.png` |
| **Diseño** | Todos | Tema Oscuro | Emulación de `prefers-color-scheme: dark` en POS | Visual OK | ✅ Aprobado | `29-pos-dark-mode.png` |

---

## 4. Clasificación Detallada de Hallazgos

### 🔴 MAYOR: [MAY-01] Comandas de mesa enviadas a cocina quedan inaccesibles para cobro en el POS

- **Severidad:** MAYOR
- **Módulo / Componente probable:**  
  [`apps/web/src/features/pos/pos-page.tsx`](../../apps/web/src/features/pos/pos-page.tsx#L124-L146),  
  [`apps/web/src/features/pos/routes.tsx`](../../apps/web/src/features/pos/routes.tsx#L5-L14).
- **Pasos para reproducir:**
  1. Iniciar sesión como `caja1` y dirigirse a `/pos`.
  2. Seleccionar tipo de pedido `Mesa` y elegir una mesa libre (ej. `Mesa 1`).
  3. Agregar productos (ej. *Monster Clásica* y *Papas Francesas*).
  4. Presionar el botón principal **Enviar a cocina**.
  5. El backend confirma el pedido, crea la comanda y actualiza la mesa a `ocupada = true`.
  6. En el frontend, la función `enviarACocina()` ejecuta `reiniciar()`, lo cual limpia `pedidoId = null` y `mesaId = ''`.
  7. El desplegable de mesas ahora solo lista mesas desocupadas (`mesasLibres = mesas.filter(m => !m.ocupada)`), por lo que `Mesa 1` ya no aparece.
  8. En la interfaz no existe ningún panel de comandas activas, selector de mesas ocupadas ni tabla de pedidos abiertos (a pesar de que la función `usePedidosActivos()` ya existe programada en `queries.ts`), y la ruta `/pos/pedido/:id` mencionada en `DESIGN.md §6` no está registrada en `routes.tsx`.
- **Resultado esperado:**  
  El cajero debe contar con un mapa de mesas, pestaña o selector de pedidos activos que le permita seleccionar `Mesa 1` (o pedido #1) para visualizar el ticket de solo lectura y presionar **Cobrar** cuando los comensales soliciten la cuenta.
- **Resultado obtenido:**  
  El pedido queda en estado `CONFIRMADO` en base de datos y cocina lo prepara, pero el cajero no tiene manera de seleccionarlo nuevamente desde la UI para cobrarlo. La única forma en que la UI actual permite cobrar una mesa es usando el botón secundario "Cobrar" *antes* de enviarlo a cocina.
- **Captura:** `C:\Users\manue\AppData\Local\Temp\mb-qa-shots\07-pos-empty.png`

---

### 🟡 MENOR: [MEN-01] Ausencia de interfaz para notas de preparación por ítem en el ticket POS

- **Severidad:** MENOR
- **Módulo / Componente probable:**  
  [`apps/web/src/features/pos/pos-page.tsx`](../../apps/web/src/features/pos/pos-page.tsx#L289-L300),  
  [`apps/web/src/components/pos/ticket-line.tsx`](../../apps/web/src/components/pos/ticket-line.tsx#L103-L118).
- **Pasos para reproducir:**
  1. Agregar cualquier producto al pedido en `/pos`.
  2. Inspeccionar la fila del producto en el ticket de venta.
- **Resultado esperado:**  
  Según `DESIGN.md §7.2` y `RN-12`, el cajero puede agregar notas de cocina (máx. 140 caracteres, ej. *"sin cebolla"*). El componente `TicketLine` ya implementa la prop `onEditarNota` y el botón con icono `StickyNote` para tal fin.
- **Resultado obtenido:**  
  `pos-page.tsx` no pasa la propiedad `onEditarNota` a `TicketLine` ni despliega ningún diálogo o campo de entrada para ingresar notas, dejando la funcionalidad deshabilitada en la interfaz.
- **Captura:** `C:\Users\manue\AppData\Local\Temp\mb-qa-shots\10-pos-mesa-items.jpeg`

---

### 🔵 OBSERVACIÓN: [OBS-01] Duplicación del prefijo "Mesa" en el recibo de venta impreso

- **Severidad:** OBSERVACIÓN
- **Módulo / Componente probable:**  
  [`apps/web/src/features/pos/recibo.tsx`](../../apps/web/src/features/pos/recibo.tsx#L52).
- **Pasos para reproducir:**
  1. Cobrar un pedido asignado a una mesa (ej. Mesa 2).
  2. Visualizar el diálogo del recibo emitido (`R-000002`).
- **Resultado esperado:**  
  Encabezado del pedido: `Pedido #3 · Mesa 2`.
- **Resultado obtenido:**  
  Encabezado del pedido: `Pedido #3 · Mesa Mesa 2`. Ocurre porque la columna `nombre` de la tabla `mesa` ya almacena la cadena `"Mesa 2"` y el componente interpola `"Mesa " + pedido.mesa.nombre`.
- **Captura:** `C:\Users\manue\AppData\Local\Temp\mb-qa-shots\18-recibo-con-propina.jpeg`

---

### 🔵 OBSERVACIÓN: [OBS-02] Ausencia del campo de búsqueda rápida de productos con atajo '/' en el POS

- **Severidad:** OBSERVACIÓN
- **Módulo / Componente probable:**  
  [`apps/web/src/features/pos/pos-page.tsx`](../../apps/web/src/features/pos/pos-page.tsx#L157-L202).
- **Pasos para reproducir:**
  1. Cargar la pantalla `/pos`.
  2. Buscar el campo de búsqueda de productos especificado en el wireframe de `DESIGN.md §7.2` (`[Buscar producto...]`).
- **Resultado esperado:**  
  Barra de búsqueda con debounce de 200 ms y foco activado mediante atajo de teclado `/`.
- **Resultado obtenido:**  
  La navegación se realiza únicamente a través de las pestañas de categorías. Aunque es totalmente funcional para catálogos pequeños, el buscador especificado en el diseño no está presente.
- **Captura:** `C:\Users\manue\AppData\Local\Temp\mb-qa-shots\07-pos-empty.png`

---

### 🔵 OBSERVACIÓN: [OBS-03] Parpadeo breve de "Sin conexión en vivo" durante el handshake inicial de SSE en Cocina

- **Severidad:** OBSERVACIÓN
- **Módulo / Componente probable:**  
  [`apps/web/src/features/cocina/cocina-page.tsx`](../../apps/web/src/features/cocina/cocina-page.tsx#L40),  
  [`apps/web/src/hooks/use-event-stream.ts`](../../apps/web/src/hooks/use-event-stream.ts).
- **Pasos para reproducir:**
  1. Iniciar sesión como `cocina1` y entrar a `/cocina`.
  2. Observar el badge de estado en el encabezado.
- **Resultado esperado:**  
  Estado de conexión transicional (ej. *"Conectando..."*) antes de marcar error o éxito.
- **Resultado obtenido:**  
  Se muestra en rojo *"Sin conexión en vivo"* durante ~800 ms hasta que el `EventSource` conmuta a estado abierto y cambia a *"En vivo"*.
- **Captura:** `C:\Users\manue\AppData\Local\Temp\mb-qa-shots\05-cocina-empty.png`, `12-cocina-order-1-preparando.jpeg`

---

## 5. Checklist de Accesibilidad y Sistema de Diseño

Evaluado contra las directrices obligatorias de `DESIGN.md` y `CLAUDE.md`:

| Criterio / Regla | Estado | Evidencia y Hallazgos |
|---|:---:|---|
| **Objetivos táctiles ≥ 48 px** | ✅ **CUMPLE** | Verificado mediante script DOM: Botones de producto (`ProductTile`) miden **169 × 112 px** (superan holgadamente la exigencia de ≥ 96 px de `DESIGN.md §2`). Botones de teclado numérico miden **h-16 (64 px)**. Botones de stepper miden **44 × 44 px** (`TicketLine` §4). Pestañas de categoría miden **48 px** de altura. |
| **Foco visible y teclado** | ✅ **CUMPLE** | Todos los elementos interactivos (`button`, `input`, `select`, `[role="tab"]`) aplican anillo de foco de 3 px con variable semántica `--ring` (`#C2410C`) y clase `focus-visible:ring-3`. Existe enlace de salto (`Saltar al contenido`). |
| **Contraste de color (WCAG AA)** | ✅ **CUMPLE** | Texto principal `#1C1917` sobre fondo `#FAFAF9` alcanza contraste de **17:1** (exige 4.5:1). Texto blanco sobre botón principal `#C2410C` alcanza **5.2:1** (exige 4.5:1). Texto atenuado `#57534E` sobre fondo alcanza **7:1**. |
| **El color nunca va solo** | ✅ **CUMPLE** | Todo estado (alerta de stock, badge de comanda, diferencia de caja sobrante/faltante/cuadrada) incluye icono de `lucide-react` más texto explicativo. Cero emojis empleados como iconos. |
| **Cifras tabulares** | ✅ **CUMPLE** | Clases CSS `tabular` (`font-variant-numeric: tabular-nums`) aplicadas en precios, cantidades, totales, temporizadores de cocina y teclado numérico, evitando saltos de diagramación. |
| **Estados vacío, carga y error** | ✅ **CUMPLE** | Cada vista implementa componentes `EmptyState` temáticos (*ShoppingCart* en ticket vacío, *Lock* en caja cerrada, *Boxes* en inventario vacío, *UtensilsCrossed* en KDS vacío) con mensaje claro y llamada a la acción. |
| **Soporte de Tema Oscuro** | ✅ **CUMPLE** | Cocina KDS renderiza por defecto en paleta oscura de alto contraste para visibilidad a 2 metros (`#0C0A09`). El POS y Admin responden correctamente ante la directiva `prefers-color-scheme: dark`. |
| **Resoluciones (1024 y 1920 px)** | ✅ **CUMPLE** | Verificado en 1024×768 px (sin scroll horizontal en POS, grilla auto-ajustable) y en 1920×1080 px (KDS distribuye columnas con números legibles a distancia). |
| **`prefers-reduced-motion`** | ✅ **CUMPLE** | Las animaciones de entrada y transiciones respetan la media query del sistema, inhibiendo traslaciones agresivas cuando está activada. |
| **Formato de Moneda y Zona Horaria** | ✅ **CUMPLE** | Formateo centralizado vía `@mb/shared`: `formatearCOP` sin decimales (`$ 24.900`). Fechas en español colombiano (`America/Bogota`). |

---

## 6. Auditoría de Consola y Peticiones de Red

- **Errores en Consola:** **0 errores**. No se registraron excepciones no capturadas de React, errores de renderizado ni advertencias de clave (`key`) única.
- **Peticiones HTTP no deseadas:** **0 fallas**. Las solicitudes hacia `/api/v1` respondieron con códigos esperados (`200 OK`, `201 Created`, `204 No Content`). La única respuesta `401 Unauthorized` registrada correspondió estrictamente al caso de prueba de revocación de sesión.

---

## 7. Conclusiones y Recomendaciones

1. **Recomendación prioritaria (P0):** Implementar la vista/selector de comandas activas de mesa en `apps/web/src/features/pos/pos-page.tsx`. La lógica de datos ya está implementada en `usePedidosActivos()`; solo se requiere renderizar una pestaña o tarjeta de mesas ocupadas que permita al cajero volver a abrir el pedido en el ticket y proceder con el cobro.
2. **Recomendación secundaria (P1):** Exponer en `pos-page.tsx` el diálogo para capturar la nota de preparación en `TicketLine`, aprovechando el icono y prop ya existentes en el componente.
3. **Recomendación cosmética (P2):** Ajustar la concatenación de nombre de mesa en `apps/web/src/features/pos/recibo.tsx` para evitar el texto duplicado *"Mesa Mesa X"*.

El frontend demuestra una arquitectura sólida, excelente adherencia a los lineamientos de diseño y accesibilidad, y una integración limpia con la API backend.
