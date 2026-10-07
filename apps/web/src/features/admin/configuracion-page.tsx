import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Clock, FileText, Loader2, Save } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  configuracionNegocioSchema,
  type ConfiguracionNegocio,
  type ConfiguracionNegocioInput,
} from '@mb/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { t } from '@/i18n/es';
import { api } from '@/lib/api';
import {
  ariaCampo,
  CabeceraPagina,
  Campo,
  EstadoError,
  PaginaAdmin,
  Skeleton,
  Textarea,
} from './components/campos';
import { aEntero, manejarErrorMutacion } from './lib';

const tc = t.admin.configuracion;

export function ConfiguracionPage() {
  const queryClient = useQueryClient();

  const {
    data: config,
    isPending,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['configuracion'],
    queryFn: () => api<ConfiguracionNegocio>('/admin/configuracion'),
  });

  const form = useForm<ConfiguracionNegocioInput>({
    resolver: zodResolver(configuracionNegocioSchema),
    defaultValues: {
      nombre: '',
      nit: '',
      direccion: '',
      telefono: '',
      pieRecibo: '',
      propinaSugeridaPorcentaje: 10,
      horaCorte: '05:00',
    },
  });

  useEffect(() => {
    if (config) {
      form.reset({
        nombre: config.nombre,
        nit: config.nit,
        direccion: config.direccion,
        telefono: config.telefono,
        pieRecibo: config.pieRecibo,
        propinaSugeridaPorcentaje: config.propinaSugeridaPorcentaje,
        horaCorte: config.horaCorte,
      });
    }
  }, [config, form]);

  const mutar = useMutation({
    mutationFn: (datos: ConfiguracionNegocioInput) =>
      api<ConfiguracionNegocio>('/admin/configuracion', {
        method: 'PUT',
        body: JSON.stringify(datos),
      }),
    onSuccess: (guardada) => {
      form.reset(guardada);
      void queryClient.invalidateQueries({ queryKey: ['configuracion'] });
      toast.success(tc.guardada);
    },
    onError: (err) => manejarErrorMutacion(err, form.setError),
  });

  const onSubmit = (datos: ConfiguracionNegocioInput) => {
    mutar.mutate({
      ...datos,
      propinaSugeridaPorcentaje: aEntero(datos.propinaSugeridaPorcentaje) ?? 10,
    });
  };

  return (
    <PaginaAdmin>
      <CabeceraPagina titulo={tc.titulo} descripcion={tc.descripcion} />

      {isPending ? (
        <div role="status" aria-live="polite" className="space-y-6">
          <span className="sr-only">{t.admin.comun.cargando}</span>
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      ) : isError ? (
        <EstadoError onReintentar={() => void refetch()} reintentando={isFetching} />
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* 1. Datos del establecimiento */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="size-5 text-primary" aria-hidden="true" />
                <CardTitle className="text-xl">Datos del Establecimiento</CardTitle>
              </div>
              <CardDescription>
                Información legal y comercial que identifica el restaurante en tickets y recibos.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <Campo
                id="conf-nombre"
                etiqueta={tc.nombre}
                ayuda={tc.nombreAyuda}
                error={form.formState.errors.nombre?.message}
                className="sm:col-span-2"
              >
                <Input
                  {...ariaCampo(
                    'conf-nombre',
                    form.formState.errors.nombre?.message,
                    tc.nombreAyuda,
                  )}
                  {...form.register('nombre')}
                  className="h-12"
                  placeholder="Ej. MonsterBurguer"
                />
              </Campo>

              <Campo
                id="conf-nit"
                etiqueta={tc.nit}
                ayuda={tc.nitAyuda}
                error={form.formState.errors.nit?.message}
              >
                <Input
                  {...ariaCampo('conf-nit', form.formState.errors.nit?.message, tc.nitAyuda)}
                  {...form.register('nit')}
                  className="h-12 font-mono"
                  placeholder="Ej. 901.234.567-8"
                />
              </Campo>

              <Campo
                id="conf-telefono"
                etiqueta={tc.telefono}
                ayuda={tc.telefonoAyuda}
                error={form.formState.errors.telefono?.message}
              >
                <Input
                  {...ariaCampo(
                    'conf-telefono',
                    form.formState.errors.telefono?.message,
                    tc.telefonoAyuda,
                  )}
                  {...form.register('telefono')}
                  className="h-12"
                  placeholder="Ej. 300 123 4567"
                />
              </Campo>

              <Campo
                id="conf-direccion"
                etiqueta={tc.direccion}
                ayuda={tc.direccionAyuda}
                error={form.formState.errors.direccion?.message}
                className="sm:col-span-2"
              >
                <Input
                  {...ariaCampo(
                    'conf-direccion',
                    form.formState.errors.direccion?.message,
                    tc.direccionAyuda,
                  )}
                  {...form.register('direccion')}
                  className="h-12"
                  placeholder="Ej. Calle 30 # 15-20, Centro Histórico"
                />
              </Campo>
            </CardContent>
          </Card>

          {/* 2. Recibos e Impresión */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="size-5 text-primary" aria-hidden="true" />
                <CardTitle className="text-xl">Recibo POS</CardTitle>
              </div>
              <CardDescription>
                Mensajes y notas al pie que acompañan el recibo impreso entregado al comensal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Campo
                id="conf-pierecibo"
                etiqueta={tc.pieRecibo}
                ayuda={tc.pieReciboAyuda}
                error={form.formState.errors.pieRecibo?.message}
              >
                <Textarea
                  {...ariaCampo(
                    'conf-pierecibo',
                    form.formState.errors.pieRecibo?.message,
                    tc.pieReciboAyuda,
                  )}
                  {...form.register('pieRecibo')}
                  rows={3}
                  placeholder="Ej. ¡Gracias por su compra! Síguenos en @monsterburguer"
                />
              </Campo>
            </CardContent>
          </Card>

          {/* 3. Operación y Finanzas */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="size-5 text-primary" aria-hidden="true" />
                <CardTitle className="text-xl">Parámetros Operativos y Financieros</CardTitle>
              </div>
              <CardDescription>
                Reglas de negocio normativas colombianas y ciclo operativo diario.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <Campo
                id="conf-propina"
                etiqueta={tc.propinaSugerida}
                ayuda={tc.propinaAyuda}
                error={form.formState.errors.propinaSugeridaPorcentaje?.message}
              >
                <Input
                  type="number"
                  min={0}
                  max={10}
                  step={1}
                  {...ariaCampo(
                    'conf-propina',
                    form.formState.errors.propinaSugeridaPorcentaje?.message,
                    tc.propinaAyuda,
                  )}
                  {...form.register('propinaSugeridaPorcentaje', { valueAsNumber: true })}
                  className="h-12"
                />
              </Campo>

              <Campo
                id="conf-horacorte"
                etiqueta={tc.horaCorte}
                ayuda={tc.horaCorteAyuda}
                error={form.formState.errors.horaCorte?.message}
              >
                <Input
                  type="text"
                  placeholder="05:00"
                  {...ariaCampo(
                    'conf-horacorte',
                    form.formState.errors.horaCorte?.message,
                    tc.horaCorteAyuda,
                  )}
                  {...form.register('horaCorte')}
                  className="h-12 font-mono"
                />
              </Campo>
            </CardContent>
          </Card>

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              disabled={mutar.isPending || !form.formState.isDirty}
              className="min-h-12 min-w-44 font-semibold text-base"
            >
              {mutar.isPending ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Save aria-hidden="true" />
              )}
              {tc.guardar}
            </Button>
          </div>
        </form>
      )}
    </PaginaAdmin>
  );
}
