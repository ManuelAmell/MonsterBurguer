// Ruta sugerida para router.tsx:
// import { VitrinaPage } from '@/features/vitrina/vitrina-page';
// { path: '/vitrina', element: <VitrinaPage /> }

import {
  Beef,
  Clock,
  Coffee,
  DollarSign,
  Flame,
  IceCream,
  Moon,
  Package,
  Plus,
  Receipt,
  ShoppingBag,
  Sun,
  UtensilsCrossed,
} from 'lucide-react';
import { useState } from 'react';
import { formatearCOP } from '@mb/shared';
import { EmptyState } from '@/components/empty-state';
import { KpiTile } from '@/components/admin/kpi-tile';
import { StockLevel } from '@/components/admin/stock-level';
import { KdsTicketCard } from '@/components/kds/kds-ticket-card';
import { CategoryRail } from '@/components/pos/category-rail';
import { NumericKeypad } from '@/components/pos/numeric-keypad';
import { ProductTile } from '@/components/pos/product-tile';
import { TicketLine } from '@/components/pos/ticket-line';
import { TicketSummary } from '@/components/pos/ticket-summary';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { StatusBadge, type EstadoPos } from '@/components/ui/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { t } from '@/i18n/es';

export function VitrinaPage() {
  const [temaOscuro, setTemaOscuro] = useState(false);
  const [categoriaActiva, setCategoriaActiva] = useState('hamburguesas');
  const [montoTeclado, setMontoTeclado] = useState('0');

  // Estado del ticket simulado
  const [lineasTicket, setLineasTicket] = useState([
    {
      id: 'item-1',
      nombre: 'Monster Clásica',
      precioUnitario: 19_900,
      cantidad: 2,
      nota: 'Sin cebolla, bien asada',
    },
    {
      id: 'item-2',
      nombre: 'Papas Rústicas Grandes',
      precioUnitario: 9_900,
      cantidad: 1,
      nota: undefined,
    },
  ]);

  // Simulación de régimen tributario (con/sin IVA)
  const [mostrarImpuestoSimulado, setMostrarImpuestoSimulado] = useState(false);

  // Categorías de ejemplo para el rail
  const categoriasEjemplo = [
    { id: 'hamburguesas', nombre: 'Hamburguesas', icono: Beef, conteo: 8 },
    { id: 'combos', nombre: 'Combos', icono: UtensilsCrossed, conteo: 4 },
    { id: 'papas', nombre: 'Papas', icono: Flame, conteo: 3 },
    { id: 'bebidas', nombre: 'Bebidas', icono: Coffee, conteo: 6 },
    { id: 'postres', nombre: 'Postres', icono: IceCream, conteo: 2 },
  ];

  // Productos de ejemplo para los tiles
  const productosEjemplo = [
    { id: 'p1', nombre: 'Monster Clásica 200g', precio: 19_900, categoria: 'Hamburguesas' },
    { id: 'p2', nombre: 'Doble Monster Parrillera', precio: 27_900, categoria: 'Hamburguesas' },
    { id: 'p3', nombre: 'Veggie Monster Crispy', precio: 21_900, categoria: 'Hamburguesas' },
    { id: 'p4', nombre: 'Combo Monster Clásico', precio: 32_900, categoria: 'Combos' },
    { id: 'p5', nombre: 'Papas Rústicas Grandes', precio: 9_900, categoria: 'Papas' },
    { id: 'p6', nombre: 'Tocineta Crunch (Agotado)', precio: 25_900, categoria: 'Hamburguesas', agotado: true },
  ];

  // Cálculos del ticket
  const subtotal = lineasTicket.reduce((acc, l) => acc + l.precioUnitario * l.cantidad, 0);
  const cantidadTotal = lineasTicket.reduce((acc, l) => acc + l.cantidad, 0);
  const baseSimulada = mostrarImpuestoSimulado ? Math.round(subtotal / 1.08) : subtotal;
  const impuestoSimulado = subtotal - baseSimulada;

  // Manejadores del teclado numérico
  const handleDigito = (digito: string) => {
    setMontoTeclado((prev) => {
      if (prev === '0') return digito;
      if (prev.length >= 8) return prev;
      return prev + digito;
    });
  };

  const handleBorrar = () => {
    setMontoTeclado((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
  };

  const handleAtajoMonto = (monto: number) => {
    setMontoTeclado(String(monto));
  };

  const handleExacto = () => {
    setMontoTeclado(String(subtotal));
  };

  const handleLimpiar = () => {
    setMontoTeclado('0');
  };

  // Manejadores del stepper del ticket
  const actualizarCantidad = (id: string, delta: number) => {
    setLineasTicket((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, cantidad: Math.max(1, l.cantidad + delta) } : l,
      ),
    );
  };

  const eliminarLinea = (id: string) => {
    setLineasTicket((prev) => prev.filter((l) => l.id !== id));
  };

  const editarNota = (id: string) => {
    setLineasTicket((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, nota: l.nota ? undefined : t.kit.ejemplos.agregarNota }
          : l,
      ),
    );
  };

  const todosLosEstados: EstadoPos[] = [
    'comanda_pendiente',
    'en_preparacion',
    'lista',
    'entregada',
    'atraso_leve',
    'atraso_grave',
    'agotado',
    'stock_bajo',
    'pagado',
    'anulado',
  ];

  return (
    <div className={temaOscuro ? 'dark bg-background text-foreground' : 'bg-background text-foreground'}>
      <div className="min-h-dvh p-4 md:p-8 space-y-12 max-w-7xl mx-auto">
        {/* Cabecera de la vitrina con selector de tema */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-display text-3xl font-black text-primary">
                MonsterBurguer POS
              </span>
              <Badge variant="outline" className="text-xs font-semibold">
                Kit de UI MVP
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {t.kit.subtitulo}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={temaOscuro ? 'default' : 'outline'}
              size="default"
              onClick={() => setTemaOscuro(!temaOscuro)}
              className="flex items-center gap-2 cursor-pointer font-bold"
            >
              {temaOscuro ? (
                <>
                  <Sun className="size-4" aria-hidden="true" />
                  <span>{t.kit.modoClaro}</span>
                </>
              ) : (
                <>
                  <Moon className="size-4" aria-hidden="true" />
                  <span>{t.kit.modoOscuro}</span>
                </>
              )}
            </Button>
          </div>
        </header>

        {/* ======================================================== */}
        {/* SECCIÓN 1: COMPONENTES DEL POS */}
        {/* ======================================================== */}
        <section className="space-y-6">
          <div className="border-b pb-2">
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
              {t.kit.secciones.pos}
            </h2>
            <p className="text-sm text-muted-foreground">
              ProductTile, CategoryRail, TicketLine, TicketSummary y NumericKeypad.
            </p>
          </div>

          {/* Grilla interactiva de venta */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* CategoryRail */}
            <div className="lg:col-span-3 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                CategoryRail (180 px, teclado y táctil)
              </h3>
              <CategoryRail
                categorias={categoriasEjemplo}
                categoriaSeleccionada={categoriaActiva}
                onSeleccionar={setCategoriaActiva}
                className="w-full"
              />
            </div>

            {/* ProductTiles */}
            <div className="lg:col-span-5 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                ProductTile (≥ 96 px, Agotado con icono CircleSlash)
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {productosEjemplo.map((prod) => (
                  <ProductTile
                    key={prod.id}
                    nombre={prod.nombre}
                    precio={prod.precio}
                    categoria={prod.categoria}
                    agotado={prod.agotado}
                    onClick={() => {
                      setLineasTicket((prev) => [
                        ...prev,
                        {
                          id: `item-${Date.now()}`,
                          nombre: prod.nombre,
                          precioUnitario: prod.precio,
                          cantidad: 1,
                          nota: undefined,
                        },
                      ]);
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Ticket de venta interactivo: TicketLine y TicketSummary */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ticket de Venta (Stepper 44 px, Basurera, Nota)
                </h3>
                <button
                  type="button"
                  onClick={() => setMostrarImpuestoSimulado(!mostrarImpuestoSimulado)}
                  className="text-xs text-primary underline cursor-pointer"
                >
                  {mostrarImpuestoSimulado ? 'Quitar impuesto' : 'Simular INC 8 %'}
                </button>
              </div>

              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {lineasTicket.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No hay productos en el ticket. Haz clic en un producto para agregarlo.
                  </div>
                ) : (
                  lineasTicket.map((linea) => (
                    <TicketLine
                      key={linea.id}
                      id={linea.id}
                      nombre={linea.nombre}
                      precioUnitario={linea.precioUnitario}
                      cantidad={linea.cantidad}
                      nota={linea.nota}
                      onIncrementar={() => actualizarCantidad(linea.id, 1)}
                      onDecrementar={() => actualizarCantidad(linea.id, -1)}
                      onEliminar={() => eliminarLinea(linea.id)}
                      onEditarNota={() => editarNota(linea.id)}
                    />
                  ))
                )}
              </div>

              {/* TicketSummary */}
              <TicketSummary
                cantidadProductos={cantidadTotal}
                total={subtotal}
                base={baseSimulada}
                impuesto={impuestoSimulado}
                tasaBp={mostrarImpuestoSimulado ? 800 : 0}
                nombreImpuesto="INC"
                textoAccionPrincipal={t.kit.ejemplos.cobrar}
                onAccionPrincipal={() => {}}
                textoAccionSecundaria={t.kit.ejemplos.enviarCocina}
                onAccionSecundaria={() => {}}
              />
            </div>
          </div>

          {/* NumericKeypad Showcase */}
          <div className="pt-4 border-t">
            <h3 className="text-sm font-bold text-foreground mb-3">
              NumericKeypad (Matriz 3×4 de 64 px y atajos de billetes)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="p-6 rounded-xl border bg-card max-w-sm mx-auto w-full">
                <div className="mb-4 rounded-lg bg-secondary/40 p-4 text-right">
                  <span className="text-xs font-semibold text-muted-foreground block">
                    Monto recibido (COP)
                  </span>
                  <span className="tabular font-display text-3xl font-extrabold text-foreground">
                    {formatearCOP(Number(montoTeclado) || 0)}
                  </span>
                </div>
                <NumericKeypad
                  onDigito={handleDigito}
                  onBorrar={handleBorrar}
                  onLimpiar={handleLimpiar}
                  onAtajoMonto={handleAtajoMonto}
                  onExacto={handleExacto}
                  totalExacto={subtotal}
                />
              </div>

              <div className="space-y-3 text-sm text-muted-foreground">
                <h4 className="font-semibold text-foreground">Criterios de diseño aplicados:</h4>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Botones de 64 px de alto para pulsación cómoda sin error táctil.</li>
                  <li>Atajos directos de billetes colombianos (20k, 50k, 100k y valor exacto).</li>
                  <li>Icono semántico <code className="text-foreground font-mono">Delete</code> para borrado rápido.</li>
                  <li>Cifras tabulares para evitar saltos visuales de interfaz al escribir.</li>
                  <li>Feedback táctil con reducción de escala en presión (active:scale-[0.97]).</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECCIÓN 2: LENGUAJE DE ESTADOS (StatusBadge) */}
        {/* ======================================================== */}
        <section className="space-y-6">
          <div className="border-b pb-2">
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Lenguaje de Estados (DESIGN.md §5)
            </h2>
            <p className="text-sm text-muted-foreground">
              StatusBadge con icono lucide + texto obligatorio en todos los 10 estados del sistema.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {todosLosEstados.map((estado) => (
              <div
                key={estado}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-card p-4 shadow-2xs text-center"
              >
                <StatusBadge estado={estado} size="default" />
                <span className="text-[11px] font-mono text-muted-foreground">
                  {estado}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECCIÓN 3: COCINA (KDS) */}
        {/* ======================================================== */}
        <section className="space-y-6">
          <div className="border-b pb-2">
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
              {t.kit.secciones.kds}
            </h2>
            <p className="text-sm text-muted-foreground">
              KdsTicketCard con temporizador tabular, umbrales de 8 y 12 min, notas resaltadas y botón de avance de 56 px.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Comanda 1: Normal (< 8 min) */}
            <KdsTicketCard
              numeroPedido="015"
              tipo="LLEVAR"
              tiempoSegundos={134} // 02:14
              estado="PENDIENTE"
              items={[
                { cantidad: 2, nombre: 'Monster Clásica', nota: 'SIN CEBOLLA, BIEN COCIDA' },
                { cantidad: 1, nombre: 'Papas Rústicas', nota: undefined },
              ]}
              onAvanzar={() => {}}
            />

            {/* Comanda 2: Atraso leve (≥ 8 min) */}
            <KdsTicketCard
              numeroPedido="012"
              tipo="MESA"
              mesa="2"
              tiempoSegundos={510} // 08:30
              estado="EN_PREPARACION"
              items={[
                { cantidad: 1, nombre: 'Doble Monster Parrillera', nota: undefined },
                { cantidad: 2, nombre: 'Papas Grandes', nota: 'EXTRA SALSA' },
              ]}
              onAvanzar={() => {}}
            />

            {/* Comanda 3: Atraso grave (≥ 12 min) */}
            <KdsTicketCard
              numeroPedido="009"
              tipo="MESA"
              mesa="5"
              tiempoSegundos={780} // 13:00
              estado="EN_PREPARACION"
              items={[
                { cantidad: 3, nombre: 'Veggie Monster Crispy', nota: 'PAN SIN GLUTEN' },
                { cantidad: 3, nombre: 'Gaseosa 400ml', nota: undefined },
              ]}
              onAvanzar={() => {}}
            />
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECCIÓN 4: ADMINISTRACIÓN E INVENTARIO */}
        {/* ======================================================== */}
        <section className="space-y-6">
          <div className="border-b pb-2">
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
              {t.kit.secciones.admin}
            </h2>
            <p className="text-sm text-muted-foreground">
              StockLevel (Progress + texto), KpiTile (Card + variaciones) y EmptyState reutilizado.
            </p>
          </div>

          {/* KpiTiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiTile
              titulo="Ventas hoy"
              valor={formatearCOP(1_245_000)}
              variacionPorcentaje={12}
              textoComparacion="vs. ayer"
              icono={DollarSign}
            />
            <KpiTile
              titulo="Pedidos despachados"
              valor="63"
              variacionPorcentaje={5}
              textoComparacion="vs. ayer"
              icono={Receipt}
            />
            <KpiTile
              titulo="Ticket promedio"
              valor={formatearCOP(19_760)}
              variacionPorcentaje={-3}
              textoComparacion="vs. ayer"
              icono={ShoppingBag}
            />
            <KpiTile
              titulo="Tiempo promedio"
              valor="09:40"
              variacionPorcentaje={0}
              textoComparacion="meta 10 min"
              icono={Clock}
            />
          </div>

          {/* StockLevel Showcase */}
          <Card className="p-6">
            <CardHeader className="p-0 pb-4">
              <CardTitle>Niveles de inventario (StockLevel)</CardTitle>
              <CardDescription>
                Indicadores visuales con barra Progress y umbrales de stock bajo y agotado.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 grid grid-cols-1 md:grid-cols-3 gap-6">
              <StockLevel
                nombre="Pan Brioche Artesanal"
                actual={1800}
                minimo={1000}
                unidad="UND"
              />
              <StockLevel
                nombre="Carne Molida Premium"
                actual={2400}
                minimo={3000}
                unidad="G"
              />
              <StockLevel
                nombre="Tocineta Ahumada"
                actual={0}
                minimo={800}
                unidad="G"
              />
            </CardContent>
          </Card>

          {/* Reutilización de EmptyState existente */}
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3">
              EmptyState (Reutilizado de components/empty-state.tsx)
            </h3>
            <EmptyState
              icon={Package}
              titulo="Sin movimientos recientes"
              descripcion="Cuando se registren consumos, compras o ajustes de inventario aparecerán en esta bitácora."
              accion={
                <Button type="button" variant="default" size="default">
                  <Plus className="size-4" aria-hidden="true" />
                  <span>Registrar primer movimiento</span>
                </Button>
              }
            />
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECCIÓN 5: COMPONENTES SHADCN BASE NUEVOS */}
        {/* ======================================================== */}
        <section className="space-y-6">
          <div className="border-b pb-2">
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
              {t.kit.secciones.shadcn}
            </h2>
            <p className="text-sm text-muted-foreground">
              Dialog, AlertDialog, Sheet, ToggleGroup, Progress, Table y Badge.
            </p>
          </div>

          {/* Diálogos y Sheets */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Dialog modal */}
            <Card className="p-5 flex flex-col justify-between gap-4">
              <div>
                <h4 className="font-bold text-foreground">Dialog</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Modal accesible con overlay negro al 50% y tecla Escape.
                </p>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="default" className="w-full font-semibold">
                    {t.kit.ejemplos.abrirDialogo}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cobrar pedido N.º 014</DialogTitle>
                    <DialogDescription>
                      Selecciona el método de pago y confirma el importe recibido.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-3">
                    <Label htmlFor="monto-modal">Monto a pagar</Label>
                    <Input id="monto-modal" value={formatearCOP(49_700)} readOnly className="tabular font-bold" />
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">
                        Cancelar
                      </Button>
                    </DialogClose>
                    <Button type="button" variant="default">
                      Confirmar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </Card>

            {/* AlertDialog modal */}
            <Card className="p-5 flex flex-col justify-between gap-4">
              <div>
                <h4 className="font-bold text-foreground">AlertDialog</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Confirmación para acciones destructivas (anular pedido / comanda).
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild className="w-full">
                  <Button type="button" variant="destructive" className="w-full font-semibold">
                    {t.kit.ejemplos.abrirAlerta}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Deseas anular este pedido?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción registrará la anulación y revertirá el consumo de insumos en el inventario. Esta operación no se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Volver</AlertDialogCancel>
                    <AlertDialogAction>Sí, anular pedido</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </Card>

            {/* Sheet lateral */}
            <Card className="p-5 flex flex-col justify-between gap-4">
              <div>
                <h4 className="font-bold text-foreground">Sheet</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Panel lateral para formularios de productos o recetas (DESIGN.md §7.7).
                </p>
              </div>
              <Sheet>
                <SheetTrigger asChild>
                  <Button type="button" variant="outline" className="w-full font-semibold">
                    {t.kit.ejemplos.abrirSheet}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right">
                  <SheetHeader>
                    <SheetTitle>Editar Producto</SheetTitle>
                    <SheetDescription>
                      Modifica los detalles del producto y sus ingredientes de receta.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="py-6 space-y-4">
                    <div className="space-y-1">
                      <Label htmlFor="nombre-prod">Nombre</Label>
                      <Input id="nombre-prod" defaultValue="Monster Clásica" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="precio-prod">Precio (COP)</Label>
                      <Input id="precio-prod" defaultValue="19900" className="tabular" />
                    </div>
                  </div>
                  <SheetFooter>
                    <SheetClose asChild>
                      <Button type="button" variant="outline">
                        Cerrar
                      </Button>
                    </SheetClose>
                    <Button type="button" variant="default">
                      Guardar cambios
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
            </Card>
          </div>

          {/* ToggleGroup y Badges */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h4 className="font-bold text-foreground mb-2">ToggleGroup (Navegable por teclado)</h4>
              <p className="text-xs text-muted-foreground mb-4">
                Grupos de opciones exclusivas (radio) con accesibilidad completa y foco visible.
              </p>
              <div className="space-y-4">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground mb-2 block">
                    Tipo de pedido:
                  </span>
                  <ToggleGroup type="single" defaultValue="mesa">
                    <ToggleGroupItem value="mesa">Mesa</ToggleGroupItem>
                    <ToggleGroupItem value="llevar">Para llevar</ToggleGroupItem>
                    <ToggleGroupItem value="domicilio">Domicilio</ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <div>
                  <span className="text-xs font-semibold text-muted-foreground mb-2 block">
                    Filtros múltiples:
                  </span>
                  <ToggleGroup type="multiple" defaultValue={['hamburguesas']}>
                    <ToggleGroupItem value="hamburguesas">Hamburguesas</ToggleGroupItem>
                    <ToggleGroupItem value="combos">Combos</ToggleGroupItem>
                    <ToggleGroupItem value="bebidas">Bebidas</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h4 className="font-bold text-foreground mb-2">Badge (Variantes semánticas)</h4>
              <p className="text-xs text-muted-foreground mb-4">
                Variantes de diseño basadas en tokens de globals.css.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="success">Success</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="destructive">Destructive</Badge>
                <Badge variant="info">Info</Badge>
                <Badge variant="muted">Muted</Badge>
              </div>
            </Card>
          </div>

          {/* Tabla de datos */}
          <Card className="p-6">
            <h4 className="font-bold text-foreground mb-2">Table (Inventario)</h4>
            <p className="text-xs text-muted-foreground mb-4">
              Componente Table con encabezados, filas interactivas y datos numéricos tabulares.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingrediente</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Stock Actual</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-bold">Pan Brioche</TableCell>
                  <TableCell>Panadería</TableCell>
                  <TableCell className="tabular text-right font-medium">1.800 und</TableCell>
                  <TableCell className="tabular text-right text-muted-foreground">1.000 und</TableCell>
                  <TableCell>
                    <StatusBadge estado="pagado" size="sm">Disponible</StatusBadge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-bold">Carne de Res 150g</TableCell>
                  <TableCell>Cárnicos</TableCell>
                  <TableCell className="tabular text-right font-medium">2.400 g</TableCell>
                  <TableCell className="tabular text-right text-muted-foreground">3.000 g</TableCell>
                  <TableCell>
                    <StatusBadge estado="stock_bajo" size="sm" />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-bold">Tocineta Ahumada</TableCell>
                  <TableCell>Cárnicos</TableCell>
                  <TableCell className="tabular text-right font-medium">0 g</TableCell>
                  <TableCell className="tabular text-right text-muted-foreground">800 g</TableCell>
                  <TableCell>
                    <StatusBadge estado="agotado" size="sm" />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        </section>
      </div>
    </div>
  );
}
