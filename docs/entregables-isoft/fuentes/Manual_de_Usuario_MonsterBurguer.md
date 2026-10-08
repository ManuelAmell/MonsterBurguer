# Manual de Usuario — MonsterBurguer POS

**Universidad de Cartagena**  
**Facultad de Ingeniería**  
**Programa de Ingeniería de Sistemas**  
**Asignatura:** Ingeniería de Software  
**Docente:** Ing. Martín Monroy Ríos, MSc, PhD  
**Estudiante:** [COMPLETAR: nombre completo del estudiante] [COMPLETAR: Integrantes adicionales del grupo si aplica]  
**Fecha:** Octubre de 2026  

---

## Introducción

Bienvenido al **Manual de Usuario de MonsterBurguer POS**. Este documento ha sido diseñado para guiar al personal del restaurante (Cajeros, Personal de Cocina y Administradores) en el uso cotidiano de la aplicación de punto de venta y control operativo.

MonsterBurguer POS es una plataforma integral creada para agilizar el servicio gastronómico, eliminar el extravío de pedidos en papel, coordinar la preparación de comandas en tiempo real en la cocina, descontar automáticamente las materias primas del inventario y proporcionar un control financiero riguroso de la caja y las ventas.

El sistema se opera enteramente a través de un navegador web moderno (Google Chrome o Microsoft Edge) desde dispositivos táctiles (tablets en mostrador), televisores o monitores en cocina y computadores de escritorio en el área administrativa.

---

## 1. Instalación y Configuración

Dado que MonsterBurguer POS está implementado como una aplicación web centralizada que se ejecuta en el servidor local del restaurante (mediante contenedores Docker Compose), **el usuario final no requiere instalar ningún software especializado** en su equipo o tablet.

### Requisitos de Acceso en Terminales Cliente
- **Dispositivos soportados:** Tablets de 10 a 13 pulgadas, computadores con pantalla táctil, computadores de escritorio o Smart TVs/monitores con navegador integrado.
- **Navegador web recomendado:** Google Chrome 120+, Microsoft Edge 120+ o Firefox 125+.
- **Conectividad:** Conexión activa a la Red de Área Local (LAN) del restaurante (vía Wi-Fi de 5 GHz o cable Ethernet).
- **Dirección de acceso:** En la barra del navegador, digite la dirección IP local del servidor del restaurante (por ejemplo: `http://192.168.1.100` o `http://localhost:5173` en entorno de prueba).

---

## 2. Aspectos Generales y Estándar de Interfaz

La interfaz de usuario ha sido concebida bajo el principio de **"Velocidad sobre adorno"** y optimizada para el tacto directo:

### 2.1 Código de Colores y Semántica Visual
Para garantizar una operación intuitiva y accesible (cumpliendo con directrices WCAG 2.2 AA), cada color está respaldado por un icono y un texto explicativo:
- **Naranja Brasa (`--primary`):** Botón de acción principal (CTA), selección activa y destacados de la marca.
- **Verde Éxito (`--success`):** Pedido cobrado, comanda lista en cocina, saldo de arqueo cuadrado.
- **Azul Información (`--info`):** Comanda en preparación, notas operativas.
- **Ámbar / Amarillo (`--warning`):** Alerta de retraso en cocina (≥ 8 minutos), ingrediente con stock bajo el mínimo.
- **Rojo Destructivo (`--destructive`):** Producto agotado, error de validación, comanda con retraso crítico (≥ 12 minutos), faltante en caja.

### 2.2 Navegabilidad y Botones Táctiles
- Los botones de selección de productos poseen dimensiones generosas (mínimo 96 px de altura) para facilitar el toque rápido sin errores.
- Todos los valores monetarios, cantidades y temporizadores utilizan cifras de ancho uniforme (cifras tabulares), impidiendo saltos visuales durante la actualización en tiempo real.
- Las notificaciones de confirmación aparecen en la esquina de la pantalla mediante avisos emergentes breves (*toasts*) que no bloquean la pantalla.

---

## 3. Explicación de la Funcionalidad por Rol

### 3.1 Acceso al Sistema (Inicio de Sesión)

Para acceder a cualquiera de los módulos del restaurante, el empleado debe identificarse con sus credenciales autorizadas.

```
+-------------------------------------------------------------+
|                      MONSTERBURGUER POS                     |
|                                                             |
|   Usuario:    [ cajero1                                ]   |
|   Contraseña: [ **********                            ]   |
|                                                             |
|                    [ INICIAR SESIÓN ]                       |
+-------------------------------------------------------------+
```
[CAPTURA: pantalla de inicio de sesión /login]

#### Pasos para Iniciar Sesión:
1. Abra el navegador e ingrese a la dirección del sistema.
2. Digite su nombre de usuario asignado (en minúsculas) y su contraseña.
3. Presione el botón **"Iniciar Sesión"**.
4. El sistema verificará su identidad y lo redirigirá automáticamente a la pantalla de trabajo correspondiente a su rol:
   - **Cajero:** Dirigido a la pantalla del Terminal Punto de Venta (`/pos`).
   - **Personal de Cocina:** Dirigido a la pantalla KDS de Cocina (`/cocina`).
   - **Administrador:** Dirigido al Panel de Control (`/admin`).

> **Credenciales de Demostración:**
> - Administrador: Usuario `admin` | Clave `admin123`
> - Cajero: Usuario `caja1` | Clave `caja1234`
> - Cocinero: Usuario `cocina1` | Clave `cocina1234`

---

### 3.2 Rol Cajero — Punto de Venta (POS) y Caja

El rol de Cajero gestiona la apertura de turnos, la recepción de pedidos, el envío a preparación, la cobranza y el cierre de caja.

#### 3.2.1 Apertura de Sesión de Caja (Inicio de Turno)
Antes de registrar el primer cobro del día, el cajero debe establecer la base inicial en efectivo disponible en la gaveta para entregar cambio.

[CAPTURA: modal de apertura de caja]

1. Al intentar cobrar un pedido o ingresar al menú lateral **Caja**, el sistema desplegará el formulario **"Apertura de Caja"**.
2. Digite el valor en efectivo entregado como base (ejemplo: `$100.000`). Si inicia sin base, digite `$0`.
3. Presione **"Abrir Caja"**. A partir de este instante, la terminal queda habilitada para procesar pagos.

#### 3.2.2 Creación de Pedidos y Selección de Modalidad
En la pantalla principal del POS (`/pos`), el cajero inicia cada orden indicando el canal de atención:

[CAPTURA: pantalla principal del POS con selector de tipo de pedido y categorías]

1. Seleccione la modalidad:
   - **Para Llevar:** Para órdenes que el cliente retira en el mostrador. No requiere asignar mesa.
   - **Mesa:** Para clientes que consumen en el salón. El sistema desplegará el mapa de mesas.
2. Si seleccionó **Mesa**, pulse sobre una de las mesas libres (color neutral/verde). Las mesas que tienen órdenes activas aparecerán rotuladas como **"Ocupada"** y no permitirán iniciar un nuevo pedido sobre ellas.
3. El sistema abrirá un nuevo ticket con número consecutivo diario (ejemplo: `#014`).

#### 3.2.3 Armar el Ticket de Productos
El menú se presenta dividido por categorías verticales (Hamburguesas, Papas, Bebidas, Postres) en el riel izquierdo, y una cuadrícula de productos en la zona central:

[CAPTURA: cuadrícula de productos del POS con producto agotado y ticket lateral]

1. **Agregar producto:** Toque la tarjeta del producto deseado. Se añadirá una unidad al ticket lateral derecho con su precio oficial en pesos colombianos (COP).
2. **Aumentar o disminuir cantidad:** En la línea del ticket, utilice los botones `+` o `−` para ajustar las unidades (de 1 a 99).
3. **Agregar nota culinaria:** Toque el botón de nota en la línea del ítem (icono de lápiz). Se abrirá un cuadro de diálogo donde podrá escribir observaciones especiales de preparación (ejemplo: *"Sin cebolla, carne bien asada"*). Presione **Enter** para guardar.
4. **Quitar producto:** Presione el icono de papelera en la línea del ítem para removerlo del pedido.
5. **Productos Agotados:** Si una materia prima indispensable para elaborar un producto se terminó en inventario, la tarjeta del producto se mostrará deshabilitada con un aviso en rojo de **"Agotado"**, impidiendo su venta accidental.

#### 3.2.4 Enviar a Cocina (Confirmación de Orden)
Una vez el cliente confirma su orden:
1. Revise el total calculado en la parte inferior del ticket.
2. Presione el botón naranja **"Enviar a cocina"**.
3. El sistema verificará de forma instantánea que exista inventario disponible para todos los ingredientes con receta.
4. Si hay existencias, el pedido pasará a estado **CONFIRMADO**, los ingredientes se descontarán del stock físico y la orden aparecerá de inmediato en la pantalla de cocina (KDS). El botón se deshabilitará para evitar duplicaciones.
5. Si falta algún ingrediente, el sistema mostrará una alerta detallando qué insumo no alcanza y mantendrá el pedido abierto para que el cajero pueda modificarlo junto al cliente.

#### 3.2.5 Consulta de Pedidos Activos
Para monitorear el estado de las órdenes del salón o llamar a un cliente cuando su comida esté lista:
1. Presione el botón **"Pedidos activos"** en la barra superior.
2. Se desplegará una ventana con dos pestañas: **"Pedidos"** y **"Mesas"**.
3. Podrá visualizar qué pedidos están *Pendientes*, cuáles están *En preparación* y cuáles ya están *Listos*.
4. Cuando la cocina marque una orden como lista, aparecerá una notificación emergente indicando: *"Pedido #014 listo"*.
5. Pulse sobre el pedido para abrirlo y proceder al cobro.

[CAPTURA: diálogo de pedidos activos y monitor de mesas ocupadas]

#### 3.2.6 Cobro del Pedido y Emisión de Recibo
Para liquidar una cuenta:

[CAPTURA: diálogo de cobro con propina y teclado numérico de efectivo]

1. En el ticket del pedido confirmado, presione el botón verde **"Cobrar"**.
2. **Propina Voluntaria (solo en Mesas):** Si el pedido es para mesa, el sistema consultará de forma transparente si el cliente desea incluir propina voluntaria (Ley 1935 de 2018). Se sugiere un 10 % redondeado hacia abajo a la centena, el cual **nunca viene preseleccionado**.
3. **Selección del medio de pago:**
   - **Efectivo:** Digite la cantidad de dinero entregada por el cliente mediante el teclado en pantalla o los atajos de billetes ($20.000, $50.000, $100.000). El sistema calculará en números grandes las **vueltas exactas**.
   - **Tarjeta / Transferencia:** Se imputa el valor exacto de la cuenta y se digita opcionalmente el comprobante de datáfono o referencia de Nequi/Daviplata.
4. Presione **"Confirmar Cobro"**.
5. El sistema cerrará la orden, liberará la mesa ocupada y disparará automáticamente la vista de impresión del comprobante de venta POS en formato térmico de 80 mm.
6. Entregue las vueltas y el comprobante al cliente.

[CAPTURA: recibo POS impreso a 80 mm con leyendas legales]

#### 3.2.7 Movimientos Manuales de Caja (Ingresos y Retiros)
Si durante la jornada requiere retirar dinero para una compra menor urgente (ejemplo: bolsas de hielo) o ingresar sencillo adicional:
1. Diríjase a la sección **Caja** y seleccione la pestaña **"Movimientos"**.
2. Presione **"Nuevo Movimiento"**.
3. Seleccione el tipo: **INGRESO** (añade efectivo a gaveta) o **RETIRO** (extrae efectivo de gaveta).
4. Ingrese el monto en pesos y escriba la justificación obligatoria (mínimo 3 caracteres).
5. Presione **"Registrar Movimiento"**. El sistema actualizará el efectivo esperado de la caja. Un retiro no podrá ejecutarse si supera el efectivo disponible en gaveta.

[CAPTURA: formulario de registro de movimiento manual de caja]

#### 3.2.8 Cierre de Sesión de Caja (Arqueo de Turno)
Al finalizar la jornada laboral:

[CAPTURA: pantalla de cierre de caja y arqueo ciego]

1. Diríjase al módulo **Caja** y pulse **"Cerrar Turno"**.
2. Realice el conteo físico de todo el dinero en efectivo acumulado en la gaveta (billetes y monedas).
3. Digite el valor total contado en el campo **"Efectivo Contado"**.
4. Presione **"Confirmar Cierre"**.
5. El sistema contrastará el dinero contado contra el efectivo esperado del sistema:
   $$\text{Efectivo Esperado} = \text{Monto Apertura} + \text{Ventas en Efectivo} + \text{Ingresos} - \text{Retiros}$$
6. El sistema presentará el balance final indicando si la caja cuadró exactamente o si se presentó sobrante (+) o faltante (−), permitiendo imprimir el reporte de cierre.

---

### 3.3 Rol Cocinero — Pantalla de Cocina (KDS)

El personal de cocina interactúa con la aplicación mediante la pantalla `/cocina`, diseñada en tema oscuro de alto contraste:

[CAPTURA: pantalla KDS de cocina con tarjetas en columnas Pendiente, Preparación y Lista]

#### Flujo de Operación en Cocina:
1. **Recepción automática:** Tan pronto el cajero confirma una orden en mostrador, una nueva tarjeta de comanda ingresa automáticamente a la columna **"Pendiente"** acompañada de una señal sonora, mostrando el número (#014), modalidad (Mesa 3 o Llevar) y la lista de hamburguesas con sus notas resaltadas.
2. **Iniciar preparación:** Cuando el cocinero comience a elaborar los platos, debe presionar el botón **"Iniciar"** en la tarjeta. La comanda se moverá a la columna **"En Preparación"** y su cronómetro registrará el tiempo de cocción.
3. **Control de tiempos y alertas de demora:**
   - Si una comanda supera los **8 minutos** sin despacharse, la tarjeta mostrará un borde ámbar con el indicador de aviso `+8 min`.
   - Si una comanda supera los **12 minutos**, la tarjeta parpadeará en color rojo crítico con el indicador `+12 min`, alertando prioridad máxima de despacho.
4. **Marcar lista:** Cuando las hamburguesas y acompañamientos estén listos en bandeja, el cocinero presiona **"Marcar Lista"**. La tarjeta pasará a la columna **"Lista"** y se emitirá una notificación al POS de mostrador para que el cajero o mesero recoja el pedido.
5. **Entregar:** Al retirar la comida hacia la mesa o mostrador, presione **"Entregar"**. La tarjeta se retirará de la pantalla activa del KDS.

---

### 3.4 Rol Administrador — Panel de Gestión y Control

El Administrador supervisa la operación global del negocio a través de la ruta `/admin`:

[CAPTURA: panel de control Dashboard del Administrador con KPIs del día]

#### 3.4.1 Dashboard del Día y Métricas
- **Indicadores Clave (KPIs):** Visualización en vivo de Ventas Totales en COP, Número de Pedidos cerrados, Ticket Promedio por compra y Tiempo Promedio de preparación en cocina.
- **Gráfica de Ventas por Hora:** Histograma que ilustra los picos de afluencia durante la fecha operativa de negocio.
- **Top 5 Productos:** Ranking de los platos más vendidos del día.
- **Panel de Alertas:** Notificaciones urgentes de materias primas que han descendido por debajo de su stock mínimo e ingredientes agotados.

#### 3.4.2 Gestión de Catálogo y Menú
- **Categorías:** Crear y ordenar las secciones del menú comercial.
- **Productos:** Registrar artículos con su nombre comercial, categoría, descripción y precio final de venta al público en pesos COP.
- **Disponibilidad:** El sistema desactiva automáticamente los productos cuando sus ingredientes se agotan, pero el administrador puede forzar manualmente el estado de agotado si así lo requiere.

[CAPTURA: formulario de administración de productos y recetas]

#### 3.4.3 Formulación de Recetas (Escandallo)
- En la lista de productos, seleccione **"Receta"**.
- Agregue los ingredientes que componen el plato indicando la cantidad exacta en la unidad base (ejemplo: 150 gramos de carne molida, 1 unidad de pan brioche, 30 gramos de queso cheddar).
- Cada vez que se venda este plato, el sistema descontará exactamente esas porciones del stock.

#### 3.4.4 Control de Inventario y Kardex
- **Registrar Entrada:** Permite ingresar compras de insumos. Al ingresar una compra, el stock físico se incrementa y, si algún producto del menú estaba marcado como agotado por falta de ese insumo, el sistema lo reactiva automáticamente para la venta.
- **Registrar Ajuste / Merma:** Permite asentar desperdicios físicos o ajustar inventarios tras un conteo físico, exigiendo una justificación textual obligatoria.
- **Kardex:** Bitácora histórica donde se audita cada movimiento de inventario, con fecha, cantidad, saldo resultante, empleado responsable y pedido causante.

[CAPTURA: tabla del Kardex de inventario con movimientos de consumo y entrada]

#### 3.4.5 Auditoría y Bitácora de Interacciones
- Permite al administrador inspeccionar la tabla `evento_sistema`, donde queda registrada cada acción crítica del sistema (pedidos confirmados, comandas listas, cobros, cierres de caja y alertas) con su usuario responsable y carga útil inmutable.

---

## 4. Solución de Problemas Frecuentes

| Síntoma o Mensaje | Causa Probable | Solución Paso a Paso |
|---|---|---|
| **"Error 409: STOCK_INSUFICIENTE"** al enviar pedido a cocina. | Uno o más ingredientes que componen la receta del pedido no poseen existencias suficientes en inventario. | 1. El sistema desplegará la lista de ingredientes faltantes con su cantidad disponible. 2. Informe al cliente para cambiar de plato o solicite al Administrador registrar una entrada de mercancía en `/admin` si el insumo llegó a bodega. |
| **"Debe abrir caja antes de cobrar"** al pulsar el botón de cobro. | El cajero no ha iniciado su turno de caja registrando el fondo base de efectivo. | 1. Diríjase a la sección **Caja** en el menú superior o lateral. 2. Ingrese el monto en efectivo de apertura. 3. Presione **"Abrir Caja"**. 4. Regrese al pedido y proceda con el cobro normal. |
| **"Mesa ocupada"** no permite seleccionar una mesa. | La mesa seleccionada ya tiene un pedido en estado ABIERTO o CONFIRMADO. | 1. Ingrese a **"Pedidos activos"** y consulte la orden asociada a dicha mesa. 2. Si el pedido ya fue consumido, proceda a cobrarlo para liberar la mesa. |
| **"Conectando..." o "Sin conexión en vivo"** en la pantalla KDS. | Interrupción momentánea en el flujo de eventos Server-Sent Events (SSE) o caída temporal de red local. | 1. El sistema reintentará reconectar automáticamente cada 3 a 5 segundos. 2. Verifique que el dispositivo esté conectado a la red Wi-Fi del restaurante. 3. Si persiste, recargue la página web (`F5`). |
| **"409 EFECTIVO_INSUFICIENTE"** al registrar un retiro de caja. | El monto que se intenta retirar de la gaveta es superior al dinero en efectivo acumulado en la sesión. | 1. Verifique el saldo de efectivo esperado en el resumen de caja. 2. Ingrese un valor de retiro igual o menor al dinero físico disponible en gaveta. |
| **La comanda no se imprime en la impresora térmica.** | Impresora apagada, sin papel o no seleccionada en el diálogo del navegador. | 1. Compruebe que la impresora de 80 mm tenga papel y esté encendida. 2. En la ventana emergente de impresión, verifique que la impresora de tickets esté seleccionada como destino predeterminado. |
| **Problema Inesperado / Error del Servidor (500).** | Excepción imprevista o fallo en la comunicación con la base de datos PostgreSQL. | 1. Verifique que el servidor central local del restaurante esté encendido y con Docker activo. 2. Notifique al Administrador del sistema para que revise los registros de la bitácora de auditoría. |
