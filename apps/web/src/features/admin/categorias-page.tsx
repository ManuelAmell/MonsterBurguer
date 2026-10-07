import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CircleSlash,
  FolderTree,
  Loader2,
  Pencil,
  Plus,
  Power,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  crearCategoriaSchema,
  editarCategoriaSchema,
  type Categoria,
  type CrearCategoriaInput,
  type EditarCategoriaInput,
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
  CabeceraPagina,
  Campo,
  CasillaCampo,
  EstadoError,
  PaginaAdmin,
  TablaSkeleton,
} from './components/campos';
import { aEntero, manejarErrorMutacion } from './lib';

const tc = t.admin.categorias;

export function CategoriasPage() {
  const queryClient = useQueryClient();
  const [seleccion, setSeleccion] = useState<Categoria | 'nuevo' | null>(null);

  const {
    data: categorias = [],
    isPending,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => api<Categoria[]>('/categorias'),
  });

  const mutarEstado = useMutation({
    mutationFn: ({ id, activa }: { id: string; activa: boolean }) =>
      api<Categoria>(`/categorias/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ activa }),
      }),
    onSuccess: (cat) => {
      void queryClient.invalidateQueries({ queryKey: ['categorias'] });
      toast.success(cat.activa ? tc.activada : tc.desactivada);
    },
    onError: (err) => manejarErrorMutacion(err),
  });

  const mutarOrden = useMutation({
    mutationFn: ({ id, nuevoOrden }: { id: string; nuevoOrden: number }) =>
      api<Categoria>(`/categorias/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ orden: nuevoOrden }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categorias'] });
      toast.success(tc.actualizada);
    },
    onError: (err) => manejarErrorMutacion(err),
  });

  const ordenadas = [...categorias].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));

  return (
    <PaginaAdmin>
      <CabeceraPagina
        titulo={tc.titulo}
        descripcion={tc.descripcion}
        acciones={
          <Button onClick={() => setSeleccion('nuevo')} className="min-h-12">
            <Plus aria-hidden="true" />
            {tc.nueva}
          </Button>
        }
      />

      {isPending ? (
        <TablaSkeleton />
      ) : isError ? (
        <EstadoError onReintentar={() => void refetch()} reintentando={isFetching} />
      ) : ordenadas.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          titulo={tc.vacioTitulo}
          descripcion={tc.vacioDescripcion}
          accion={
            <Button onClick={() => setSeleccion('nuevo')} className="min-h-12">
              <Plus aria-hidden="true" />
              {tc.nueva}
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24 text-center">{tc.orden}</TableHead>
                <TableHead>{tc.nombre}</TableHead>
                <TableHead>{tc.estado}</TableHead>
                <TableHead className="text-right">{t.admin.comun.acciones}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordenadas.map((cat, idx) => (
                <TableRow key={cat.id} className={cat.activa ? undefined : 'opacity-60'}>
                  <TableCell className="text-center font-mono">
                    <div className="flex items-center justify-center gap-1">
                      <span>{cat.orden}</span>
                      <div className="flex flex-col">
                        <button
                          type="button"
                          aria-label={`Subir orden de ${cat.nombre}`}
                          disabled={idx === 0 || mutarOrden.isPending}
                          onClick={() =>
                            mutarOrden.mutate({
                              id: cat.id,
                              nuevoOrden: Math.max(0, cat.orden - 1),
                            })
                          }
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                        >
                          <ArrowUp className="size-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Bajar orden de ${cat.nombre}`}
                          disabled={idx === ordenadas.length - 1 || mutarOrden.isPending}
                          onClick={() =>
                            mutarOrden.mutate({
                              id: cat.id,
                              nuevoOrden: cat.orden + 1,
                            })
                          }
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                        >
                          <ArrowDown className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">{cat.nombre}</TableCell>
                  <TableCell>
                    {cat.activa ? (
                      <Badge variant="success" className="gap-1.5 font-medium">
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        {t.admin.comun.activo}
                      </Badge>
                    ) : (
                      <Badge variant="muted" className="gap-1.5 font-medium">
                        <CircleSlash className="size-3.5" aria-hidden="true" />
                        {t.admin.comun.inactivo}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          mutarEstado.mutate({ id: cat.id, activa: !cat.activa })
                        }
                        disabled={mutarEstado.isPending}
                        title={cat.activa ? tc.desactivar : tc.activar}
                        aria-label={cat.activa ? tc.desactivar : tc.activar}
                        className="h-10 px-3"
                      >
                        <Power
                          className={`size-4 ${cat.activa ? 'text-destructive' : 'text-success'}`}
                          aria-hidden="true"
                        />
                        <span className="hidden sm:inline">
                          {cat.activa ? tc.desactivar : tc.activar}
                        </span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSeleccion(cat)}
                        className="h-10 px-3"
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                        {t.admin.comun.editar}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={seleccion !== null} onOpenChange={(o) => !o && setSeleccion(null)}>
        <SheetContent
          className="flex w-full flex-col gap-6 overflow-y-auto sm:max-w-md"
          aria-labelledby="sheet-categoria-titulo"
        >
          {seleccion !== null && (
            <FormularioCategoria
              key={seleccion === 'nuevo' ? 'nuevo' : seleccion.id}
              categoria={seleccion === 'nuevo' ? null : seleccion}
              onGuardado={() => {
                setSeleccion(null);
                void queryClient.invalidateQueries({ queryKey: ['categorias'] });
              }}
              onCancelar={() => setSeleccion(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </PaginaAdmin>
  );
}

interface FormularioCategoriaProps {
  categoria: Categoria | null;
  onGuardado: () => void;
  onCancelar: () => void;
}

function FormularioCategoria({ categoria, onGuardado, onCancelar }: FormularioCategoriaProps) {
  const esNuevo = categoria === null;
  const tc = t.admin.categorias;

  const form = useForm<CrearCategoriaInput | EditarCategoriaInput>({
    resolver: zodResolver(esNuevo ? crearCategoriaSchema : editarCategoriaSchema),
    defaultValues: {
      nombre: categoria?.nombre ?? '',
      orden: categoria?.orden ?? 0,
      activa: categoria?.activa ?? true,
    },
  });

  const mutar = useMutation({
    mutationFn: (datos: CrearCategoriaInput | EditarCategoriaInput) =>
      esNuevo
        ? api<Categoria>('/categorias', { method: 'POST', body: JSON.stringify(datos) })
        : api<Categoria>(`/categorias/${categoria.id}`, {
            method: 'PATCH',
            body: JSON.stringify(datos),
          }),
    onSuccess: () => {
      toast.success(esNuevo ? tc.creada : tc.actualizada);
      onGuardado();
    },
    onError: (err) => manejarErrorMutacion(err, form.setError),
  });

  const onSubmit = (datos: CrearCategoriaInput | EditarCategoriaInput) => {
    mutar.mutate({
      nombre: datos.nombre?.trim(),
      orden: aEntero(datos.orden) ?? 0,
      activa: datos.activa,
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <SheetHeader className="p-0 text-left">
        <SheetTitle id="sheet-categoria-titulo">
          {esNuevo ? tc.nuevaTitulo : tc.editarTitulo}
        </SheetTitle>
        <SheetDescription>{tc.descripcion}</SheetDescription>
      </SheetHeader>

      <Campo
        id="categoria-nombre"
        etiqueta={tc.nombre}
        error={form.formState.errors.nombre?.message}
      >
        <Input
          {...ariaCampo('categoria-nombre', form.formState.errors.nombre?.message)}
          {...form.register('nombre')}
          autoFocus
          className="h-12"
          placeholder="Ej. Bebidas, Hamburguesas"
        />
      </Campo>

      <Campo
        id="categoria-orden"
        etiqueta={tc.orden}
        ayuda={tc.ordenAyuda}
        error={form.formState.errors.orden?.message}
      >
        <Input
          type="number"
          min={0}
          {...ariaCampo(
            'categoria-orden',
            form.formState.errors.orden?.message,
            tc.ordenAyuda,
          )}
          {...form.register('orden', { valueAsNumber: true })}
          className="h-12"
        />
      </Campo>

      <CasillaCampo
        id="categoria-activa"
        etiqueta={tc.activa}
        {...form.register('activa')}
      />

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancelar}
          className="min-h-12"
        >
          {t.admin.comun.cancelar}
        </Button>
        <Button
          type="submit"
          disabled={mutar.isPending}
          className="min-h-12 min-w-32"
        >
          {mutar.isPending && (
            <Loader2 className="animate-spin" aria-hidden="true" />
          )}
          {t.admin.comun.guardar}
        </Button>
      </div>
    </form>
  );
}
