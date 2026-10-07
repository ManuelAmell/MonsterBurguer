import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, Boxes, Loader2, Trash } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  crearMermaInventarioSchema,
  type CrearMermaInventarioInput,
  type Ingrediente,
} from '@mb/shared';
import { z } from 'zod';
import { StockLevel } from '@/components/admin/stock-level';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
import { ariaCampo, Campo, CabeceraPagina, EstadoError, PaginaAdmin, TablaSkeleton } from './components/campos';
import { aEntero, formatearCantidad, manejarErrorMutacion } from './lib';
import { useIngredientes } from './productos-page';

const ti = t.admin.inventario;

type Operacion = { tipo: 'entrada' | 'merma'; ingrediente: Ingrediente };

/** Refresca todo lo que depende del stock (tabla, productos agotados, alertas, panel). */
function useInvalidarStock() {
  const qc = useQueryClient();
  return () => {
    for (const key of ['ingredientes', 'productos', 'producto', 'alertas', 'dashboard', 'eventos']) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
  };
}

export function InventarioPage() {
  const ingredientes = useIngredientes();
  const [operacion, setOperacion] = useState<Operacion | null>(null);

  return (
    <PaginaAdmin>
      <CabeceraPagina titulo={ti.titulo} descripcion={ti.descripcion} />

      {ingredientes.isPending ? (
        <TablaSkeleton />
      ) : ingredientes.isError ? (
        <EstadoError
          onReintentar={() => void ingredientes.refetch()}
          reintentando={ingredientes.isFetching}
        />
      ) : ingredientes.data.items.length === 0 ? (
        <EmptyState icon={Boxes} titulo={ti.vacioTitulo} descripcion={ti.vacioDescripcion} />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{ti.nombre}</TableHead>
                <TableHead scope="col" className="w-72">
                  {ti.nivel}
                </TableHead>
                <TableHead scope="col" className="text-right">
                  {t.admin.comun.acciones}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ingredientes.data.items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.nombre}</TableCell>
                  <TableCell>
                    <StockLevel actual={i.stockActual} minimo={i.stockMinimo} unidad={i.unidad} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOperacion({ tipo: 'entrada', ingrediente: i })}
                      >
                        <ArrowDownToLine aria-hidden="true" />
                        {ti.entrada}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOperacion({ tipo: 'merma', ingrediente: i })}
                      >
                        <Trash aria-hidden="true" />
                        {ti.merma}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={operacion !== null} onOpenChange={(o) => !o && setOperacion(null)}>
        <DialogContent aria-labelledby="dlg-inventario">
          {operacion?.tipo === 'entrada' && (
            <FormEntrada ingrediente={operacion.ingrediente} onListo={() => setOperacion(null)} />
          )}
          {operacion?.tipo === 'merma' && (
            <FormMerma ingrediente={operacion.ingrediente} onListo={() => setOperacion(null)} />
          )}
        </DialogContent>
      </Dialog>
    </PaginaAdmin>
  );
}

const entradaFormSchema = z.object({
  cantidad: z
    .number({ error: 'Escribe la cantidad que ingresa' })
    .int('La cantidad debe ser un número entero')
    .positive('La cantidad de entrada debe ser mayor a 0'),
});
type EntradaForm = z.input<typeof entradaFormSchema>;

function Pie({ pendiente, onCancelar, etiqueta }: { pendiente: boolean; onCancelar: () => void; etiqueta: string }) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <Button type="button" variant="outline" onClick={onCancelar}>
        {t.admin.comun.cancelar}
      </Button>
      <Button type="submit" disabled={pendiente}>
        {pendiente && <Loader2 aria-hidden="true" className="animate-spin" />}
        {etiqueta}
      </Button>
    </div>
  );
}

function FormEntrada({ ingrediente, onListo }: { ingrediente: Ingrediente; onListo: () => void }) {
  const invalidar = useInvalidarStock();
  const form = useForm<EntradaForm>({ resolver: zodResolver(entradaFormSchema), mode: 'onTouched' });
  const { errors } = form.formState;
  const registrar = useMutation({
    mutationFn: (d: EntradaForm) =>
      api('/inventario/entradas', {
        method: 'POST',
        body: { items: [{ ingredienteId: ingrediente.id, cantidad: d.cantidad }] },
      }),
    onSuccess: () => {
      invalidar();
      toast.success(ti.entradaRegistrada);
      onListo();
    },
    onError: (e) => manejarErrorMutacion(e, form.setError, ['cantidad']),
  });
  return (
    <form noValidate onSubmit={form.handleSubmit((d) => registrar.mutate(d))} className="space-y-5">
      <DialogHeader className="pr-12">
        <DialogTitle id="dlg-inventario">
          {ti.dialogoEntrada}: {ingrediente.nombre}
        </DialogTitle>
        <DialogDescription>{ti.descEntrada}</DialogDescription>
      </DialogHeader>
      <Campo
        id="e-cantidad"
        etiqueta={`${ti.cantidadEntrada} (${ingrediente.unidad.toLowerCase()})`}
        ayuda={ti.stockActualEs(formatearCantidad(ingrediente.stockActual, ingrediente.unidad))}
        error={errors.cantidad?.message}
      >
        <Input
          inputMode="numeric"
          autoFocus
          className="tabular"
          {...ariaCampo('e-cantidad', errors.cantidad?.message, 'x')}
          {...form.register('cantidad', { setValueAs: (v) => aEntero(v) })}
        />
      </Campo>
      <Pie pendiente={registrar.isPending} onCancelar={onListo} etiqueta={ti.entrada} />
    </form>
  );
}

function FormMerma({ ingrediente, onListo }: { ingrediente: Ingrediente; onListo: () => void }) {
  const invalidar = useInvalidarStock();
  const form = useForm<CrearMermaInventarioInput>({
    resolver: zodResolver(crearMermaInventarioSchema),
    defaultValues: { ingredienteId: ingrediente.id, motivo: '' },
    mode: 'onTouched',
  });
  const { errors } = form.formState;
  const registrar = useMutation({
    mutationFn: (d: CrearMermaInventarioInput) => api('/inventario/mermas', { method: 'POST', body: d }),
    onSuccess: () => {
      invalidar();
      toast.success(ti.mermaRegistrada);
      onListo();
    },
    onError: (e) => manejarErrorMutacion(e, form.setError, ['cantidad', 'motivo']),
  });
  return (
    <form noValidate onSubmit={form.handleSubmit((d) => registrar.mutate(d))} className="space-y-5">
      <DialogHeader className="pr-12">
        <DialogTitle id="dlg-inventario">
          {ti.dialogoMerma}: {ingrediente.nombre}
        </DialogTitle>
        <DialogDescription>{ti.descMerma}</DialogDescription>
      </DialogHeader>
      <Campo
        id="m-cantidad"
        etiqueta={`${ti.cantidadMerma} (${ingrediente.unidad.toLowerCase()})`}
        ayuda={ti.stockActualEs(formatearCantidad(ingrediente.stockActual, ingrediente.unidad))}
        error={errors.cantidad?.message}
      >
        <Input
          inputMode="numeric"
          autoFocus
          className="tabular"
          {...ariaCampo('m-cantidad', errors.cantidad?.message, 'x')}
          {...form.register('cantidad', { setValueAs: (v) => aEntero(v) })}
        />
      </Campo>
      <Campo id="m-motivo" etiqueta={ti.motivo} ayuda={ti.motivoAyuda} error={errors.motivo?.message}>
        <Input autoComplete="off" {...ariaCampo('m-motivo', errors.motivo?.message, ti.motivoAyuda)} {...form.register('motivo')} />
      </Campo>
      <Pie pendiente={registrar.isPending} onCancelar={onListo} etiqueta={ti.merma} />
    </form>
  );
}
