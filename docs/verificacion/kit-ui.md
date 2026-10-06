# Informe de Verificación UI/UX — Kit de Componentes MVP

- **Fecha:** 2026-10-06
- **Rama:** `ManuelAmell/mvp-uikit`
- **Commit evaluado:** `70c9af8d3b186aea2f6d39722fd5465d62cf78da` (70c9af8)
- **Rol:** Verificador Riguroso e Independiente de UI/UX
- **Veredicto:** **RECHAZADO** (debido a hallazgos clasificados como **MAYOR** por violación estricta de la regla de no uso de `any` en `CLAUDE.md` y en el criterio de calidad del contrato de entrega).

---

## 1. Resumen Ejecutivo

Se realizó una auditoría técnica y visual completa del kit de componentes presentacionales entregado en la rama `ManuelAmell/mvp-uikit`. La implementación exhibe una alta fidelidad visual y de comportamiento frente a los requerimientos de `DESIGN.md` (§1, §3, §4 y §5), logrando conformidad táctil en los componentes principales (ProductTile ≥ 96 px, Stepper 44 px, Teclado 64 px, KDS 56 px), ratios de contraste WCAG 2.1 AA impecables en modo claro y modo oscuro, ausencia de scroll horizontal en 1024 px y 1920 px, navegación por teclado con foco visible de 3 px, y formateo monetario centralizado en COP. 

Asimismo, los comandos `pnpm --filter web typecheck` y `pnpm --filter web build` ejecutaron en verde con código de salida 0, y no se agregaron dependencias no declaradas. No obstante, en la auditoría estática de calidad de código se detectaron **6 ocurrencias de `: any`** en archivos base de la UI (`toggle-group.tsx`, `alert-dialog.tsx`, `dialog.tsx` y `sheet.tsx`), destacando la interfaz pública `ToggleGroupProps.onValueChange?: (value: any) => void`, lo cual vulnera la regla fundamental `"Sin any"` de `CLAUDE.md` y degrada la seguridad de tipos para los consumidores del kit.

Conforme a las reglas de evaluación (*"RECHAZADO si hay algún BLOQUEANTE o MAYOR"*), el kit queda **RECHAZADO** a la espera de una corrección quirúrgica de tipado en dichos archivos.

---

## 2. Tabla de Comprobaciones

| # | Criterio de Verificación | Estado | Evidencia y Mediciones |
|---|---|:---:|---|
| **1** | **Alcance del Git Diff** (`git diff --stat main...HEAD`) | **CONFORME** | Exactamente 18 archivos modificados/creados: 16 componentes bajo `apps/web/src/components/{pos,kds,admin,ui}/`, 1 página de vitrina en `apps/web/src/features/vitrina/` y la clave `kit` en `apps/web/src/i18n/es.ts`. Cero cambios en `router.tsx`, `pnpm-lock.yaml`, `package.json`, `apps/api` o `packages/`. |
| **2** | **Resolución de Dependencias** | **CONFORME** | Todos los imports externos (`@mb/shared`, `@radix-ui/react-slot`, `class-variance-authority`, `lucide-react`, `react`, `react-dom`) están declarados en `apps/web/package.json`. No se importaron paquetes no declarados de `@radix-ui/*` (`dialog`, `sheet`, `alert-dialog`, `toggle-group`, `progress` fueron implementados mediante Slot + React portal nativo). |
| **3** | **Compilación y Tipado** | **CONFORME** | `pnpm --filter web typecheck` finalizó con exit code 0 (`tsc --noEmit`). `pnpm --filter web build` generó los bundles en `dist/` exitosamente en 1.73s con exit code 0. |
| **4** | **Tokens Semánticos vs. Colores Crudos** | **CONFORME** | Grep exhaustivo de `#`, `rgb(`, `rgba(`, `hsl(` arrojó 0 violaciones en los 18 archivos nuevos. Grep de clases por paleta de Tailwind (`slate-`, `red-`, etc.) arrojó 0 violaciones; todos los estilos consumen tokens CSS semánticos (`primary`, `muted`, `card`, `destructive`, etc.). |
| **5** | **Cobertura de Componentes DESIGN §4 y §5** | **CONFORME** | Existen e implementan la especificación completa:<br>• `ProductTile`: botón nativo, altura 112 px (spec 96–120 px), estado agotado no interactivo con `CircleSlash` + "Agotado".<br>• `CategoryRail`: vertical 176 px (≈180 px), navegación teclado (flechas/Home/End), activo `primary`.<br>• `TicketLine`: stepper `size-11` (44 px), papelera visible `size-11` (44 px), nota visible, montos tabulares.<br>• `TicketSummary`: línea de impuesto condicional solo si `tasaBp > 0`, total en 32 px (`text-3xl`), CTA primario de 56 px.<br>• `NumericKeypad`: teclas de 64 px (`h-16`), atajos $20k, $50k, $100k y Exacto, botón borrar con `Delete`.<br>• `StatusBadge`: cubre los 10 estados de §5 con icono Lucide + texto obligatorio.<br>• `KdsTicketCard`: umbrales <8 min (Clock), ≥8 min (AlertTriangle), ≥12 min (AlertOctagon); notas con borde/fondo accent; CTA 56 px full width.<br>• `StockLevel`: barra `Progress` + texto "X / mín Y" + icono/texto.<br>• `KpiTile`: valor tabular grande + variación con icono (`TrendingUp`/`TrendingDown`/`Minus`) y texto. |
| **6** | **Revisión Visual Real (Chrome DevTools MCP)** | **CONFORME** | Validado en navegador Chromium real:<br>• **Scroll:** `scrollWidth <= clientWidth` en 1024 px y 1920 px (0 scroll horizontal).<br>• **Tamaños táctiles medidos:** ProductTile (112 px), CategoryRail (48 px), Stepper (44 px), Teclado (64 px y 48 px), KDS (56 px).<br>• **Foco visible:** Tabulaciones verificadas; foco proyecta `box-shadow: ... 0px 0px 0px 2px (offset), ... 0px 0px 0px 5px (ring 3px)`.<br>• **Iconos y Accesibilidad:** Botones de solo icono contienen `aria-label` descriptivo. Cero emojis presentes en el DOM.<br>• **Cifras tabulares:** 73 elementos con clase `.tabular` y estilo computado `font-variant-numeric: tabular-nums`.<br>• **prefers-reduced-motion:** Detectadas y activas 2 reglas CSS desactivando duraciones/transiciones.<br>• **Modales:** Dialog, AlertDialog y Sheet abren y cierran limpiamente con teclado (`Escape`) y botones de acción. |
| **7** | **Calidad de Código y Tipos** | **NO CONFORME** | Se detectaron **6 ocurrencias de `: any`** que violan `CLAUDE.md` y la regla 7 de la entrega. La prop `onValueChange` en `ToggleGroupProps` anula el tipado estricto. |

---

## 3. Matriz de Contraste de Color (WCAG 2.1 AA)

Se calcularon matemáticamente las luminancias relativas y los ratios de contraste para todos los pares de colores definidos en `apps/web/src/styles/globals.css` y `DESIGN.md` §3:

### Tema Claro (`:root`)
- **Texto principal sobre fondo** (`#1C1917` / `#FAFAF9`): **16.74:1** (Cumple AA / AAA ✅)
- **Texto principal sobre tarjeta** (`#1C1917` / `#FFFFFF`): **17.49:1** (Cumple AA / AAA ✅)
- **Texto secundario sobre fondo** (`#57534E` / `#FAFAF9`): **7.30:1** (Cumple AA / AAA ✅)
- **Texto secundario sobre tarjeta** (`#57534E` / `#FFFFFF`): **7.63:1** (Cumple AA / AAA ✅)
- **Texto sobre botón primario** (`#FFFFFF` / `#C2410C`): **5.18:1** (Cumple AA Normal ≥ 4.5:1 ✅)
- **Texto primario sobre fondo** (`#C2410C` / `#FAFAF9`): **4.96:1** (Cumple AA Normal ≥ 4.5:1 ✅)
- **Texto sobre acento** (`#1C1917` / `#F59E0B`): **8.14:1** (Cumple AA / AAA ✅)
- **Texto sobre destructivo** (`#FFFFFF` / `#B91C1C`): **6.47:1** (Cumple AA / AAA ✅)
- **Texto destructivo sobre fondo** (`#B91C1C` / `#FAFAF9`): **6.19:1** (Cumple AA / AAA ✅)
- **Texto de éxito sobre fondo** (`#15803D` / `#FAFAF9`): **4.80:1** (Cumple AA Normal ≥ 4.5:1 ✅)
- **Texto de advertencia sobre fondo** (`#B45309` / `#FAFAF9`): **4.81:1** (Cumple AA Normal ≥ 4.5:1 ✅)
- **Texto de información sobre fondo** (`#1D4ED8` / `#FAFAF9`): **6.42:1** (Cumple AA / AAA ✅)
- **Borde de input sobre fondo** (`#78716C` / `#FAFAF9`): **4.59:1** (Cumple WCAG 1.4.11 UI ≥ 3.0:1 ✅)

### Tema Oscuro (`.dark`)
- **Texto principal sobre fondo** (`#FAFAF9` / `#0C0A09`): **18.92:1** (Cumple AA / AAA ✅)
- **Texto principal sobre tarjeta** (`#FAFAF9` / `#1C1917`): **16.74:1** (Cumple AA / AAA ✅)
- **Texto secundario sobre fondo** (`#A8A29E` / `#0C0A09`): **7.83:1** (Cumple AA / AAA ✅)
- **Texto secundario sobre tarjeta** (`#A8A29E` / `#1C1917`): **6.93:1** (Cumple AA / AAA ✅)
- **Texto sobre botón primario** (`#0C0A09` / `#F97316`): **7.05:1** (Cumple AA / AAA ✅)
- **Texto primario sobre fondo** (`#F97316` / `#0C0A09`): **7.05:1** (Cumple AA / AAA ✅)
- **Texto primario sobre tarjeta** (`#F97316` / `#1C1917`): **6.24:1** (Cumple AA / AAA ✅)
- **Texto sobre acento** (`#0C0A09` / `#F59E0B`): **9.20:1** (Cumple AA / AAA ✅)
- **Texto destructivo sobre fondo** (`#EF4444` / `#0C0A09`): **5.25:1** (Cumple AA Normal ≥ 4.5:1 ✅)
- **Texto de éxito sobre fondo** (`#22C55E` / `#0C0A09`): **8.67:1** (Cumple AA / AAA ✅)
- **Texto de advertencia sobre fondo** (`#F59E0B` / `#0C0A09`): **9.20:1** (Cumple AA / AAA ✅)
- **Texto de información sobre fondo** (`#3B82F6` / `#0C0A09`): **5.37:1** (Cumple AA Normal ≥ 4.5:1 ✅)
- **Borde de input sobre fondo** (`#78716C` / `#0C0A09`): **4.12:1** (Cumple WCAG 1.4.11 UI ≥ 3.0:1 ✅)

---

## 4. Mediciones de Elementos Interactivos (Inspector DevTools)

Mediciones extraídas mediante la API de DOM / DevTools en el viewport operativo de 1024 px:

| Componente | Elemento | Dimensiones Medidas (Ancho × Alto) | Especificación en DESIGN | Resultado |
|---|---|:---:|:---:|:---:|
| `ProductTile` | Botón producto | 240 × 112 px | 96–120 px de alto (≥ 96 px) | **CUMPLE** ✅ |
| `CategoryRail` | Botón pestaña | 268 × 48 px | ≥ 48 px de alto | **CUMPLE** ✅ |
| `TicketLine` | Stepper decrementar (−) | 44 × 44 px | 44 px (DESIGN §4) | **CUMPLE** ✅ |
| `TicketLine` | Stepper incrementar (+) | 44 × 44 px | 44 px (DESIGN §4) | **CUMPLE** ✅ |
| `TicketLine` | Botón papelera | 44 × 44 px | Botón visible con acción táctil | **CUMPLE** ✅ |
| `NumericKeypad` | Atajos billetes (20k/50k/100k/Exacto) | 78 × 48 px | ≥ 48 px de alto | **CUMPLE** ✅ |
| `NumericKeypad` | Teclas numéricas (0–9, 00) | 106 × 64 px | 64 px de alto (DESIGN §4) | **CUMPLE** ✅ |
| `NumericKeypad` | Tecla borrar (Delete) | 106 × 64 px | 64 px de alto (DESIGN §4) | **CUMPLE** ✅ |
| `KdsTicketCard` | Botón avance de comanda | 362 × 56 px | 56 px ancho completo (DESIGN §4) | **CUMPLE** ✅ |
| `TicketSummary` | Botón Cobrar (acción principal) | 328 × 56 px | h-14 (56 px) | **CUMPLE** ✅ |
| `Dialog` / `Sheet` | Botón cerrar (X) | 44 × 44 px | ≥ 44 px (Apple HIG) / 48 px (POS §1) | **OBSERVACIÓN** (Ver Menor) |

---

## 5. Hallazgos Detallados

### HALLAZGO-01 — [MAYOR] Tipado `any` en interfaz pública de `ToggleGroup`
- **Archivo y Línea:** `apps/web/src/components/ui/toggle-group.tsx:50`
- **Código actual:**
  ```tsx
  export interface ToggleGroupProps extends Omit<ComponentProps<'div'>, 'onChange'> {
    type?: ToggleGroupType;
    value?: string | string[];
    defaultValue?: string | string[];
    onValueChange?: (value: any) => void;
  ```
- **Descripción:** La propiedad `onValueChange` declara el argumento como `any`. Al ser un componente de base utilizado por otros módulos, cualquier consumidor que conecte un listener recibirá un valor no tipado, evadiendo el chequeo de tipos estricto y violando la regla `"Sin any"` de `CLAUDE.md`.
- **Reproducción:** Inspeccionar línea 50 de `apps/web/src/components/ui/toggle-group.tsx` o buscar con regex `onValueChange\?: \(value: any\)`.
- **Corrección recomendada:** Tipar el valor con unión explícita o genérico:
  ```tsx
  onValueChange?: (value: string | string[]) => void;
  ```
  O alternativamente mediante sobrecarga/genérico según el `type` ('single' | 'multiple').

---

### HALLAZGO-02 — [MAYOR] Parámetros de evento tipados con `: any` en triggers y close de modales
- **Archivos y Líneas:**
  - `apps/web/src/components/ui/alert-dialog.tsx:71`: `onClick={(e: any) => {`
  - `apps/web/src/components/ui/dialog.tsx:71`: `onClick={(e: any) => {`
  - `apps/web/src/components/ui/dialog.tsx:98`: `onClick={(e: any) => {`
  - `apps/web/src/components/ui/sheet.tsx:72`: `onClick={(e: any) => {`
  - `apps/web/src/components/ui/sheet.tsx:99`: `onClick={(e: any) => {`
- **Descripción:** En los componentes `AlertDialogTrigger`, `DialogTrigger`, `DialogClose`, `SheetTrigger` y `SheetClose`, el manejador interno `onClick` anota el parámetro `(e: any)`. Dado que `Comp` extiende `ComponentProps<'button'>`, este tipado debilita innecesariamente el tipado de eventos y contraviene la directriz de calidad `"sin any"` requerida en `CLAUDE.md`.
- **Reproducción:** Ejecutar:
  ```powershell
  Select-String -Path "apps/web/src/components/ui/*.tsx" -Pattern ":\s*any\b"
  ```
- **Corrección recomendada:** Eliminar `: any` y permitir la inferencia de tipos o tipar con `React.MouseEvent<HTMLButtonElement>`:
  ```tsx
  onClick={(e) => {
    onClick?.(e);
    context.setOpen(true);
  }}
  ```

---

### HALLAZGO-03 — [MENOR] Botón de cierre (X) en diálogos y hojas con tamaño 44 px en lugar de ≥ 48 px
- **Archivos y Líneas:**
  - `apps/web/src/components/ui/dialog.tsx:177`: `className="absolute top-4 right-4 flex size-11 ..."`
  - `apps/web/src/components/ui/sheet.tsx:194`: `className="absolute top-4 right-4 flex size-11 ..."`
- **Descripción:** Los botones de cierre de `DialogContent` y `SheetContent` tienen clase `size-11` (44×44 px). Si bien 44 px cumple el mínimo de Apple HIG, el principio fundamental nº 2 de `DESIGN.md` §1 establece: *"Táctil primero. Objetivos táctiles ≥ 48 px (botones de producto ≥ 96 px)"*.
- **Reproducción:** Medir el elemento `button[aria-label="Cerrar diálogo"]` con DevTools o verificar la clase CSS `size-11` en el código fuente.
- **Corrección recomendada:** Cambiar `size-11` por `size-12` (48×48 px) en ambos componentes para alinearse al estándar operativo de 48 px.

---

## 6. Dictamen y Próximos Pasos

El kit de componentes presentacionales es de una calidad sobresaliente a nivel de diseño, tokens, contraste y ergonomía visual. Sin embargo, para mantener el rigor del estándar de ingeniería definido en `CLAUDE.md` ("Sin any"), **no es posible aprobar la entrega hasta que se corrijan los hallazgos HALLAZGO-01 y HALLAZGO-02**.

Una vez el autor reemplace las 6 ocurrencias de `any` por sus tipos estrictos correspondientes, el kit estará listo para ser aprobado inmediatamente.
