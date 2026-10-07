import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, PackageX, Pencil, Plus, TriangleAlert, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  actualizarRecetaSchema,
  crearProductoSchema,
  formatearCOP,
  type Categoria,
  type CrearProductoInput,
  type Ingrediente,
  type Producto,
  type ProductoDetalle,
} from '@mb/shared';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { t } from '@/i18n/es';
import { api } from '@/lib/api';
import {
  ariaCampo,
  Campo,
  CabeceraPagina,
  CasillaCampo,
  EstadoError,
  PaginaAdmin,
  Select,
  TablaSkeleton,
} from './components/campos';
import { aEntero, manejarErrorMutacion } from './lib';

interface Pagina<T> {
  items: T[];
  nextCursor: string | null;
}

export const useCategorias = () =>
  useQuery({ queryKey: ['categorias'], queryFn: () => api<Categoria[]>('/categorias') });

export const useIngredientes = () =>
  useQuery({
    queryKey: ['ingredientes'],
    queryFn: () => api<Pagina<Ingrediente>>('/ingredientes?limit=100'),
  });

const tp = t.admin.productos;

export function ProductosPage() {
  const productos = useQuery({
    queryKey: ['productos'],
    queryFn: () => api<Pagina<Producto>>('/productos?limit=100'),
  });
  const categorias = useCategorias();
  const [seleccion, setSeleccion] = useState<Producto | 'nuevo' | null>(null);

  const nombreCategoria = new Map((categorias.data ?? []).map((c) => [c.id, c.nombre]));

  return (
    <PaginaAdmin>
      <CabeceraPagina
        titulo={tp.titulo}
        descripcion={tp.descripcion}
        acciones={
          <Button onClick={() => setSeleccion('nuevo')}>
            <Plus aria-hidden="true" />
            {tp.nuevo}
          </Button>
        }
      />

      {productos.isPending ? (
        <TablaSkeleton />
      ) : productos.isError ? (
        <EstadoError onReintentar={() => void productos.refetch()} reintentando={productos.isFetching} />
      ) : productos.data.items.length === 0 ? (
        <EmptyState
          icon={PackageX}
          titulo={tp.vacioTitulo}
          descripcion={tp.vacioDescripcion}
          accion={
            <Button onClick={() => setSeleccion('nuevo')}>
              <Plus aria-hidden="true" />
              {tp.nuevo}
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{tp.nombre}</TableHead>
                <TableHead scope="col">{tp.categoria}</TableHead>
                <TableHead scope="col" className="text-right">
                  {tp.precio}
                </TableHead>
                <TableHead scope="col">{tp.disponibilidad}</TableHead>
                <TableHead scope="col" className="text-right">
                  {t.admin.comun.acciones}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productos.data.items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell>{nombreCategoria.get(p.categoriaId) ?? '—'}</TableCell>
                  <TableCell className="tabular text-right">{formatearCOP(p.precio)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {!p.activo && <Badge variant="muted">{t.admin.comun.inactivo}</Badge>}
                      {p.agotado ? (
                        <StatusBadge estado="agotado">
                          {p.agotadoManual === true ? tp.agotadoManual : tp.agotadoAuto}
                        </StatusBadge>
                      ) : (
                        p.activo && <Badge variant="success">{tp.disponible}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setSeleccion(p)}>
                      <Pencil aria-hidden="true" />
                      {t.admin.comun.editar}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={seleccion !== null} onOpenChange={(o) => !o && setSeleccion(null)}>
        <SheetContent className="flex w-full flex-col gap-6 overflow-y-auto sm:max-w-xl" aria-labelledby="sheet-producto">
          {seleccion !== null && (
            <FormularioProducto
              key={seleccion === 'nuevo' ? 'nuevo' : seleccion.id}
              producto={seleccion === 'nuevo' ? null : seleccion}
              categorias={categorias.data ?? []}
              onCreado={(p) => setSeleccion(p)}
              onCerrar={() => setSeleccion(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </PaginaAdmin>
  );
}

function FormularioProducto({
  producto,
  categorias,
  onCreado,
  onCerrar,
}: {
  producto: Producto | null;
  categorias: Categoria[];
  onCreado: (p: Producto) => void;
  onCerrar: () => void;
}) {
  const qc = useQueryClient();
  const form = useForm<CrearProductoInput>({
    resolver: zodResolver(crearProductoSchema),
    defaultValues: {
      nombre: producto?.nombre ?? '',
      categoriaId: producto?.categoriaId ?? '',
      precio: producto?.precio ?? ('' as unknown as number),
      activo: producto?.activo ?? true,
    },
    mode: 'onTouched',
  });
  const { errors } = form.formState;

  const guardar = useMutation({
    mutationFn: (datos: CrearProductoInput) =>
      producto
        ? api<Producto>(`/productos/${producto.id}`, { method: 'PATCH', body: datos })
        : api<Producto>('/productos', { method: 'POST', body: datos }),
    onSuccess: (p) => {
      void qc.invalidateQueries({ queryKey: ['productos'] });
      void qc.invalidateQueries({ queryKey: ['producto', p.id] });
      toast.success(producto ? tp.actualizado : tp.creado);
      if (!producto) onCreado(p);
    },
    onError: (e) => manejarErrorMutacion(e, form.setError, ['nombre', 'categoriaId', 'precio']),
  });

  return (
    <>
      <SheetHeader>
        <SheetTitle id="sheet-producto">{producto ? tp.editarTitulo : tp.nuevoTitulo}</SheetTitle>
        <SheetDescription>{producto?.nombre ?? tp.descripcion}</SheetDescription>
      </SheetHeader>

      <form noValidate onSubmit={form.handleSubmit((d) => guardar.mutate(d))} className="space-y-5">
        <Campo id="p-nombre" etiqueta={tp.nombre} error={errors.nombre?.message}>
          <Input autoComplete="off" {...ariaCampo('p-nombre', errors.nombre?.message)} {...form.register('nombre')} />
        </Campo>
        <Campo id="p-cat" etiqueta={tp.categoria} error={errors.categoriaId?.message}>
          <Select {...ariaCampo('p-cat', errors.categoriaId?.message)} {...form.register('categoriaId')}>
            <option value="">{tp.elegirCategoria}</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo id="p-precio" etiqueta={tp.precio} ayuda={tp.precioAyuda} error={errors.precio?.message}>
          <Input
            inputMode="numeric"
            className="tabular"
            {...ariaCampo('p-precio', errors.precio?.message, tp.precioAyuda)}
            {...form.register('precio', { setValueAs: (v) => aEntero(v) })}
          />
        </Campo>
        <CasillaCampo id="p-activo" etiqueta={tp.activo} {...form.register('activo')} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCerrar}>
            {t.admin.comun.cerrar}
          </Button>
          <Button type="submit" disabled={guardar.isPending}>
            {guardar.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
            {guardar.isPending ? t.admin.comun.guardando : t.admin.comun.guardar}
          </Button>
        </div>
      </form>

      <hr className="border-border" />
      {producto ? <EditorReceta productoId={producto.id} /> : <p className="text-sm text-muted-foreground">{tp.guardePrimero}</p>}
    </>
  );
}

interface FilaReceta {
  ingredienteId: string;
  cantidad: string;
}

function EditorReceta({ productoId }: { productoId: string }) {
  const detalle = useQuery({
    queryKey: ['producto', productoId],
    queryFn: () => api<ProductoDetalle>(`/productos/${productoId}`),
  });
  const ingredientes = useIngredientes();

  if (detalle.isPending || ingredientes.isPending) return <TablaSkeleton filas={3} />;
  if (detalle.isError || ingredientes.isError) {
    return (
      <EstadoError
        onReintentar={() => {
          void detalle.refetch();
          void ingredientes.refetch();
        }}
      />
    );
  }
  return (
    <RecetaForm
      key={detalle.dataUpdatedAt}
      productoId={productoId}
      inicial={detalle.data.receta.map((r) => ({ ingredienteId: r.ingredienteId, cantidad: String(r.cantidad) }))}
      ingredientes={ingredientes.data.items}
    />
  );
}

function RecetaForm({
  productoId,
  inicial,
  ingredientes,
}: {
  productoId: string;
  inicial: FilaReceta[];
  ingredientes: Ingrediente[];
}) {
  const qc = useQueryClient();
  const [filas, setFilas] = useState<FilaReceta[]>(inicial);
  const [error, setError] = useState<string | null>(null);
  const porId = new Map(ingredientes.map((i) => [i.id, i]));

  const actualizar = (i: number, cambio: Partial<FilaReceta>) =>
    setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, ...cambio } : f)));

  const guardar = useMutation({
    mutationFn: (items: { ingredienteId: string; cantidad: number }[]) =>
      api<ProductoDetalle>(`/productos/${productoId}/receta`, { method: 'PUT', body: { items } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['producto', productoId] });
      void qc.invalidateQueries({ queryKey: ['productos'] });
      toast.success(tp.recetaGuardada);
    },
    onError: (e) => manejarErrorMutacion(e),
  });

  const enviar = () => {
    const parsed = actualizarRecetaSchema.safeParse({
      items: filas.map((f) => ({ ingredienteId: f.ingredienteId, cantidad: aEntero(f.cantidad) ?? Number.NaN })),
    });
    if (!parsed.success) {
      const hayVacio = filas.some((f) => !f.ingredienteId);
      setError(hayVacio ? tp.elegirIngrediente : (parsed.error.issues[0]?.message ?? t.errores.inesperado));
      return;
    }
    setError(null);
    guardar.mutate(parsed.data.items);
  };

  return (
    <section aria-labelledby="receta-titulo" className="space-y-4">
      <div className="space-y-1">
        <h3 id="receta-titulo" className="font-display text-lg font-bold">
          {tp.receta}
        </h3>
        <p className="text-sm text-muted-foreground">{tp.recetaAyuda}</p>
      </div>

      {filas.length === 0 && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/15 p-3 text-sm font-medium text-warning"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {tp.sinRecetaAdvertencia}
        </p>
      )}

      <ul className="space-y-3">
        {filas.map((f, i) => {
          const ing = porId.get(f.ingredienteId);
          return (
            <li key={i} className="grid grid-cols-[1fr_7rem_auto] items-end gap-2">
              <Campo id={`r-ing-${i}`} etiqueta={tp.ingrediente}>
                <Select
                  id={`r-ing-${i}`}
                  value={f.ingredienteId}
                  onChange={(e) => actualizar(i, { ingredienteId: e.target.value })}
                >
                  <option value="">{tp.elegirIngrediente}</option>
                  {ingredientes.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre} ({o.unidad.toLowerCase()})
                    </option>
                  ))}
                </Select>
              </Campo>
              <Campo id={`r-cant-${i}`} etiqueta={`${tp.cantidad}${ing ? ` (${ing.unidad.toLowerCase()})` : ''}`}>
                <Input
                  id={`r-cant-${i}`}
                  inputMode="numeric"
                  className="tabular"
                  value={f.cantidad}
                  onChange={(e) => actualizar(i, { cantidad: e.target.value })}
                />
              </Campo>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={tp.quitarIngrediente(ing?.nombre ?? String(i + 1))}
                onClick={() => setFilas((fs) => fs.filter((_, j) => j !== i))}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setFilas((fs) => [...fs, { ingredienteId: '', cantidad: '' }])}
          disabled={ingredientes.length === 0}
        >
          <Plus aria-hidden="true" />
          {tp.agregarIngrediente}
        </Button>
        <Button type="button" onClick={enviar} disabled={guardar.isPending}>
          {guardar.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
          {tp.guardarReceta}
        </Button>
      </div>
    </section>
  );
}
