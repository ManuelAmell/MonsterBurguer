# Diseño UI/UX — MonsterBurguer POS

> Fuente de verdad del diseño. Toda pantalla o componente nuevo se diseña e implementa con la skill **`/ui-ux-pro-max`** y se valida contra este documento y contra su checklist de pre-entrega (ver [§9](#9-flujo-de-trabajo-con-ui-ux-pro-max)).

## 1. Principios

1. **Velocidad sobre adorno.** Un cajero en hora pico debe cobrar un combo en **≤ 4 toques**. Cada pantalla tiene una sola acción primaria.
2. **Táctil primero.** Objetivos táctiles ≥ 48 px (botones de producto ≥ 96 px), separación ≥ 8 px, sin interacciones que dependan de hover.
3. **Legible a distancia.** El KDS se lee a 2 m: números grandes, alto contraste, tema oscuro.
4. **El color nunca va solo.** Todo estado (listo, atrasado, agotado, error) lleva **icono + texto** además del color.
5. **Feedback inmediato.** Respuesta visual < 100 ms al tocar; spinners/skeleton si una acción tarda > 300 ms; toasts de confirmación.
6. **Marca con carácter, operación sobria.** La personalidad "monster" vive en el logo, login, estados vacíos y recibo; las pantallas operativas son limpias y densas en información.

## 2. Dispositivos y breakpoints

| Superficie | Dispositivo objetivo | Orientación | Breakpoint de diseño |
|---|---|---|---|
| POS (caja) | Tablet 10–13" o PC táctil | Horizontal | 1024 – 1366 px |
| KDS (cocina) | TV/monitor 22"+ | Horizontal | 1920 px (escala desde 1280) |
| Admin / inventario | PC | Horizontal | 1280 – 1440 px |
| Mesero (v1.1) | Teléfono | Vertical | 375 – 430 px |

Breakpoints Tailwind: `sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536`. Nada de scroll horizontal; `min-h-dvh` en vez de `100vh`.

## 3. Tokens de diseño

Todo color se usa por **token semántico** (variables CSS de shadcn/ui); está prohibido el hex crudo en componentes.

### 3.1 Color — tema claro (POS, admin)

| Token | Valor | Uso | Contraste |
|---|---|---|---|
| `--primary` | `#C2410C` (naranja-brasa) | CTA principal, selección activa | blanco sobre él ≈ 5.2:1 ✅ |
| `--primary-foreground` | `#FFFFFF` | Texto sobre primary | |
| `--accent` | `#F59E0B` (mostaza) | Resaltes, badges de promo | usar texto `#1C1917` |
| `--background` | `#FAFAF9` | Fondo de app | |
| `--card` | `#FFFFFF` | Tarjetas, ticket | |
| `--foreground` | `#1C1917` | Texto principal | ≈ 17:1 ✅ |
| `--muted-foreground` | `#57534E` | Texto secundario | ≈ 7:1 ✅ |
| `--border` | `#E7E5E4` | Bordes, divisores | |
| `--success` | `#15803D` | Listo, pagado | |
| `--warning` | `#B45309` | Atraso leve, stock bajo | |
| `--destructive` | `#B91C1C` | Anular, error, atraso grave, agotado | |
| `--info` | `#1D4ED8` | En preparación, información | |
| `--ring` | `#C2410C` | Anillo de foco (2–3 px) | |

### 3.2 Color — tema oscuro (KDS por defecto; opcional en POS)

| Token | Valor |
|---|---|
| `--background` | `#0C0A09` |
| `--card` | `#1C1917` |
| `--foreground` | `#FAFAF9` |
| `--muted-foreground` | `#A8A29E` |
| `--border` | `#292524` |
| `--primary` | `#F97316` (más claro para mantener contraste en oscuro) |
| `--success` | `#22C55E` · `--warning` `#F59E0B` · `--destructive` `#EF4444` · `--info` `#3B82F6` |

El tema oscuro se diseña junto con el claro (no es una inversión); contraste verificado por separado.

### 3.3 Tipografía

| Rol | Fuente | Peso | Uso |
|---|---|---|---|
| Display / marca | **Bricolage Grotesque** | 700–800 | Logo, títulos de login, números del KDS |
| UI / cuerpo | **Inter** | 400 / 500 / 600 | Todo lo demás |

- Cifras: `font-variant-numeric: tabular-nums` en **precios, totales, cantidades y temporizadores** (evita saltos de layout).
- Escala (px): `12 · 14 · 16 · 18 · 20 · 24 · 32 · 48 · 64`. Cuerpo base 16 px, interlineado 1.5. Nada < 12 px.
- KDS: número de pedido 48–64 px, ítems 20–24 px.
- Carga con `font-display: swap`; solo se precargan Inter 400/600.

### 3.4 Espaciado, radios, sombras, capas

- Espaciado en escala de 4 px: `4 · 8 · 12 · 16 · 24 · 32 · 48`.
- Radios: `--radius: 0.75rem` (tarjetas), botones `0.625rem`, chips `999px`.
- Elevación: 3 niveles (`sm` tarjetas, `md` popovers, `lg` diálogos). Sin sombras aleatorias.
- z-index: `base 0 · sticky 10 · dropdown 20 · overlay 40 · modal 50 · toast 100`.
- Scrim de diálogos: negro 50 %.

### 3.5 Movimiento

- Micro-interacciones 150–200 ms, `ease-out` al entrar, salida ~70 % de la entrada.
- Solo `transform` y `opacity`. Presionar botón: `scale(0.97)`.
- Animar 1–2 elementos clave por vista (p. ej. la línea que entra al ticket, la tarjeta nueva del KDS).
- Respetar `prefers-reduced-motion` (sin animaciones, solo cambios de estado).

### 3.6 Iconografía

- **lucide-react** exclusivamente, trazo 2 px. Tamaños por token: `16 · 20 · 24 · 32`.
- **Prohibido usar emoji como icono.**
- Botones solo-icono siempre con `aria-label`.

## 4. Componentes clave

| Componente | Base shadcn/ui | Notas |
|---|---|---|
| `ProductTile` | `Button` + `Card` | 96–120 px de alto, nombre (2 líneas máx.), precio tabular; estado **Agotado** = opaco 50 % + icono `CircleSlash` + texto "Agotado", no clicable |
| `CategoryRail` | `ToggleGroup` vertical | Seleccionada con fondo primary + texto; navegable por teclado |
| `TicketLine` | custom | Nombre, nota, stepper `− 2 +` (botones 44 px), total de línea; botón papelera visible (deslizar nunca es la única forma de borrar) |
| `TicketSummary` | `Card` | Nº de productos, total grande (32 px), CTA principal; base/impuesto solo si el régimen tiene tasa > 0 |
| `NumericKeypad` | custom | Teclado 3×4 de 64 px para efectivo recibido; atajos de billetes ($20.000, $50.000, $100.000) |
| `PaymentDialog` | `Dialog` | Métodos de pago, recibido, cambio en grande, confirmar |
| `KdsTicketCard` | `Card` | Número de pedido, tipo (mesa/llevar), temporizador, ítems con notas resaltadas, botón de avance de estado de ancho completo |
| `StatusBadge` | `Badge` | Siempre icono + texto (ver §5) |
| `StockLevel` | `Progress` + texto | Barra + "1.200 g / mín 2.000 g" |
| `KpiTile` | `Card` | Valor grande tabular, variación vs. ayer con icono y texto |
| `ConfirmDialog` | `AlertDialog` | Para anular/eliminar: botón destructivo separado del primario, motivo obligatorio |
| `Toast` | `Sonner` | 3–5 s, `aria-live="polite"`, nunca roba foco |
| `EmptyState` | custom | Ilustración de marca + mensaje + acción |

## 5. Lenguaje de estados

| Estado | Color | Icono (lucide) | Texto |
|---|---|---|---|
| Comanda pendiente | neutral | `Clock` | Pendiente |
| En preparación | info | `Flame` | Preparando |
| Lista | success | `CheckCircle2` | Lista |
| Entregada | muted | `PackageCheck` | Entregada |
| Atraso leve (≥ 8 min) | warning | `AlertTriangle` | +8 min |
| Atraso grave (≥ 12 min) | destructive | `AlertOctagon` | +12 min |
| Agotado | destructive | `CircleSlash` | Agotado |
| Stock bajo | warning | `TriangleAlert` | Stock bajo |
| Pagado | success | `BadgeCheck` | Pagado |
| Anulado | destructive | `Ban` | Anulado |

Umbrales de atraso configurables por el admin.

## 6. Navegación

- **Login** → redirige según rol: `CAJERO → /pos`, `COCINA → /cocina`, `ADMIN → /admin`.
- **Barra lateral** (≥ 1024 px) con icono + etiqueta; ítem activo resaltado. Elementos visibles según rol. "Cerrar sesión" separado al pie.
- KDS **sin barra lateral** (pantalla completa); salida por menú de usuario.
- Todas las pantallas tienen URL propia (`/pos`, `/pos/pedido/:id`, `/cocina`, `/caja`, `/admin`, `/admin/inventario`, `/admin/productos`, `/admin/reportes`).

## 7. Pantallas del MVP (wireframes)

> En los bocetos, los símbolos (`⊘ ⚠ ✓ ⏱ ☰`) representan iconos de lucide, no emoji.

### 7.1 Login

```
┌──────────────────────────────────────────────┐
│            [logo MonsterBurguer]             │
│                                              │
│   Usuario     [______________________]       │
│   Contraseña  [__________________] [ver]     │
│                                              │
│   [        Ingresar  (primary)        ]      │
│   error junto al campo, no solo arriba       │
└──────────────────────────────────────────────┘
```

### 7.2 POS — Venta (pantalla principal)

```
┌────┬──────────────────────────────────────────────┬──────────────────────────┐
│ ☰  │ [Buscar producto…]          Mesa 4 ▾ | Llevar│ Pedido #014 · Mesa 4     │
│    ├──────────┬───────────────────────────────────┤──────────────────────────│
│ POS│Hamburgue.│ ┌────────┐ ┌────────┐ ┌────────┐   │ 2 × Monster Clásica      │
│Caja│Combos    │ │Monster │ │Doble   │ │Veggie  │   │   sin cebolla   −  2  +  │
│Inv.│Papas     │ │Clásica │ │Monster │ │        │   │              $ 39.800    │
│Adm.│Bebidas   │ │$19.900 │ │$27.900 │ │$21.900 │   │ 1 × Papas grandes  − 1 + │
│    │Postres   │ └────────┘ └────────┘ └────────┘   │              $  9.900    │
│    │          │ ┌────────┐ ┌────────┐ ┌────────┐   │──────────────────────────│
│    │          │ │BBQ     │ │Crispy  │ │AGOTADO │   │ 3 productos              │
│    │          │ │        │ │Chicken │ │ ⊘      │   │                          │
│    │          │ └────────┘ └────────┘ └────────┘   │ TOTAL          $ 49.700  │
│    │          │                                   │ [Enviar a cocina] [Cobrar]│
└────┴──────────┴───────────────────────────────────┴──────────────────────────┘
 rail categorías (≈180 px) · grilla productos (auto-fill, min 140 px) · ticket (≈360 px fijo)
```
- El total es el precio final al público (RN-02). Régimen actual `NO_RESPONSABLE`: **no hay línea de impuesto**; las líneas "Base" e "Impuesto" solo aparecen si el régimen configurado tiene tasa > 0 (RN-03).
- Tocar producto = agregar 1 (animación sutil de la línea entrando). Botón "nota" en la línea = agregar nota.
- Acción primaria contextual: en pedido para llevar (pago anticipado) el primario es **Cobrar**; en mesa es **Enviar a cocina**.
- Búsqueda con debounce 200 ms; atajo `/` para enfocar.

### 7.3 Cobro (diálogo)

```
┌───────────────── Cobrar pedido #014 ─────────────────┐
│ Total a pagar                          $ 49.700      │
│ ¿Incluir propina voluntaria? [No] [Sí $ 4.900] [Otra]│
│ Método:  [Efectivo] [Tarjeta] [Transferencia]        │
│ Recibido  $ 100.000        ┌───┬───┬───┐             │
│ [20k] [50k] [100k] [Exacto]│ 7 │ 8 │ 9 │ …           │
│ CAMBIO            $ 50.300 (grande, success)         │
│ [Cancelar]                   [Confirmar cobro]       │
└──────────────────────────────────────────────────────┘
```
- Propina (solo MESA, RN-06): ninguna opción preseleccionada; el cajero pregunta y elige; "Otra" permite un valor menor o mayor que el cliente decida. Texto de ayuda: "La propina es voluntaria".
- Pago mixto: "Agregar otro método" divide el total en varias líneas de pago.

### 7.4 KDS — Cocina (tema oscuro, pantalla completa)

```
┌──────────── PENDIENTES (3) ───────────┬──────── PREPARANDO (2) ────────┬──── LISTAS (1) ────┐
│ ┌───────────────────────────────┐     │ ┌────────────────────────────┐ │ ┌────────────────┐ │
│ │ #015   LLEVAR       ⏱ 02:14   │     │ │ #012  MESA 2  ⚠ +8 min     │ │ │ #011  MESA 4 ✓ │ │
│ │ 2  Monster Clásica            │     │ │ 1  Doble Monster           │ │ │ [Entregada]    │ │
│ │    • SIN CEBOLLA (resaltado)  │     │ │ 2  Papas grandes           │ │ └────────────────┘ │
│ │ 1  Papas grandes              │     │ │ [   Marcar LISTA   ]       │ │                    │
│ │ [     Iniciar     ]           │     │ └────────────────────────────┘ │                    │
│ └───────────────────────────────┘     │                                │                    │
└───────────────────────────────────────┴────────────────────────────────┴────────────────────┘
```
- Orden FIFO por hora de confirmación. Temporizador tabular que cambia a warning/destructive con icono + texto.
- Sonido corto opcional al entrar comanda nueva (configurable, apagado por defecto).
- Botón de avance de ancho completo, 56 px de alto. Deshacer el último avance durante 5 s (toast con "Deshacer").

### 7.5 Caja — sesión

- **Abrir caja:** monto base con `NumericKeypad`.
- **Durante:** resumen de ventas por método, ingresos/retiros manuales.
- **Cerrar caja:** efectivo esperado vs. contado (input), diferencia en grande con color + texto ("Sobrante $ 2.000" / "Faltante $ 5.000"), confirmación.

### 7.6 Admin — Dashboard

```
┌ KPIs ─────────────────────────────────────────────────────────────────────────┐
│ Ventas hoy $1.245.000 (+12 %) │ Pedidos 63 │ Ticket prom. $19.760 │ T. prep. 9:40 │
├ Ventas por hora (barras) ───────────────┬ Top 5 productos (barras horiz.) ──────┤
├ Alertas: ⚠ Pan brioche — stock bajo (12 und / mín 30)  [Registrar entrada]     │
│         ⊘ Tocineta agotada → 3 productos desactivados automáticamente          │
└ Interacciones recientes (bitácora de eventos entre subsistemas) ───────────────┘
```
- Gráficos con leyenda, tooltip, ejes con unidad, formato `es-CO`, alternativa en tabla y estado vacío.

### 7.7 Admin — Inventario y productos

- **Inventario:** tabla (nombre, stock, mínimo, nivel, unidad, acciones: *Entrada*, *Ajuste*). Filtro "solo stock bajo". Ordenable (`aria-sort`).
- **Productos:** tabla + formulario lateral (`Sheet`): nombre, categoría, precio, activo, **receta** (lista de ingrediente + cantidad en unidad base).

## 8. Accesibilidad y formato (obligatorio)

- Contraste texto ≥ 4.5:1 (grande ≥ 3:1) en ambos temas.
- Foco visible (anillo 2–3 px `--ring`); orden de tabulación = orden visual; todo el POS operable por teclado.
- Etiquetas visibles en todos los inputs; errores debajo del campo con causa + cómo corregir; `role="alert"` en errores.
- Confirmación antes de acciones destructivas; "Deshacer" cuando aplique.
- Moneda: `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })`. Fechas `es-CO`, zona `America/Bogota`.
- Idioma de la UI: español (Colombia). Textos centralizados en `apps/web/src/i18n/es.ts` desde el inicio.
- Recibo imprimible: CSS `@media print` a 80 mm (impresora térmica vía diálogo de impresión del navegador).

## 9. Flujo de trabajo con `/ui-ux-pro-max`

Para **cada** pantalla o componente:

1. Invocar `/ui-ux-pro-max` con el contexto: *"restaurant POS, touch-first, <pantalla>, React + Tailwind + shadcn/ui"*.
2. Generar/actualizar el sistema de diseño persistido:
   ```bash
   python <skill>/scripts/search.py "restaurant POS food service touch operational" --design-system --persist -p "MonsterBurguer POS"
   python <skill>/scripts/search.py "<consulta>" --design-system --persist -p "MonsterBurguer POS" --page "<pantalla>"
   ```
   Esto crea `design-system/MASTER.md` y `design-system/pages/<pantalla>.md`. **Si contradicen este DESIGN.md, manda DESIGN.md**; las diferencias se discuten y se consolidan aquí.
3. Consultas puntuales por dominio cuando haga falta (`--domain ux|color|typography|chart`).
4. Antes de dar por terminada la pantalla: checklist de pre-entrega de la skill (accesibilidad, táctil, rendimiento) + revisión en 1024 px y 1920 px, tema claro y oscuro, `prefers-reduced-motion`.

> ⚠️ Estado de la instalación local: en `~/.claude/skills/ui-ux-pro-max/` las carpetas `scripts` y `data` son symlinks rotos (apuntan a `../../../src/ui-ux-pro-max/`), así que el paso 2 no corre hasta reinstalar la skill con soporte de symlinks o copiar esas carpetas. Las reglas de la skill (SKILL.md) sí están disponibles y ya están aplicadas en este documento.
