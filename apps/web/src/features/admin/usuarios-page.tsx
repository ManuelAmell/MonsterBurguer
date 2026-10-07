import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  CircleSlash,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Power,
  Shield,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  actualizarUsuarioSchema,
  crearUsuarioSchema,
  restablecerClaveSchema,
  type ActualizarUsuarioInput,
  type CrearUsuarioInput,
  type RestablecerClaveInput,
  type Rol,
  type UsuarioDetalle,
} from '@mb/shared';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useSesion } from '@/features/auth/session';
import { t } from '@/i18n/es';
import { api } from '@/lib/api';
import {
  ariaCampo,
  CabeceraPagina,
  Campo,
  CasillaCampo,
  EstadoError,
  PaginaAdmin,
  Select,
  TablaSkeleton,
} from './components/campos';
import { formatearFechaHora, manejarErrorMutacion } from './lib';

const tu = t.admin.usuarios;

export function UsuariosPage() {
  const queryClient = useQueryClient();
  const { data: usuarioActual } = useSesion();

  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioDetalle | 'nuevo' | null>(null);
  const [usuarioParaClave, setUsuarioParaClave] = useState<UsuarioDetalle | null>(null);

  const {
    data: usuarios = [],
    isPending,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => api<UsuarioDetalle[]>('/usuarios'),
  });

  const mutarEstado = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      api<UsuarioDetalle>(`/usuarios/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ activo }),
      }),
    onSuccess: (u) => {
      void queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success(u.activo ? tu.actualizado : tu.actualizado);
    },
    onError: (err) => manejarErrorMutacion(err),
  });

  const rolBadge = (rol: Rol) => {
    switch (rol) {
      case 'ADMIN':
        return (
          <Badge variant="default" className="gap-1 font-semibold">
            <Shield className="size-3.5" aria-hidden="true" />
            {t.roles.ADMIN}
          </Badge>
        );
      case 'CAJERO':
        return (
          <Badge variant="info" className="gap-1 font-semibold">
            {t.roles.CAJERO}
          </Badge>
        );
      case 'COCINA':
        return (
          <Badge variant="warning" className="gap-1 font-semibold">
            {t.roles.COCINA}
          </Badge>
        );
    }
  };

  return (
    <PaginaAdmin>
      <CabeceraPagina
        titulo={tu.titulo}
        descripcion={tu.descripcion}
        acciones={
          <Button onClick={() => setUsuarioEditando('nuevo')} className="min-h-12">
            <Plus aria-hidden="true" />
            {tu.nuevo}
          </Button>
        }
      />

      {isPending ? (
        <TablaSkeleton />
      ) : isError ? (
        <EstadoError onReintentar={() => void refetch()} reintentando={isFetching} />
      ) : usuarios.length === 0 ? (
        <EmptyState
          icon={Users}
          titulo={tu.vacioTitulo}
          descripcion={tu.vacioDescripcion}
          accion={
            <Button onClick={() => setUsuarioEditando('nuevo')} className="min-h-12">
              <Plus aria-hidden="true" />
              {tu.nuevo}
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tu.nombre}</TableHead>
                <TableHead>{tu.username}</TableHead>
                <TableHead>{tu.rol}</TableHead>
                <TableHead>{t.admin.categorias.estado}</TableHead>
                <TableHead className="hidden md:table-cell">{t.admin.inventario.colFecha}</TableHead>
                <TableHead className="text-right">{t.admin.comun.acciones}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((u) => {
                const esYo = usuarioActual?.id === u.id;
                return (
                  <TableRow key={u.id} className={u.activo ? undefined : 'opacity-60'}>
                    <TableCell className="font-semibold">
                      <div className="flex items-center gap-2">
                        <span>{u.nombre}</span>
                        {esYo && (
                          <Badge variant="secondary" className="text-[11px] px-1.5 py-0 font-normal">
                            {tu.esUsuarioActual}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      @{u.username}
                    </TableCell>
                    <TableCell>{rolBadge(u.rol)}</TableCell>
                    <TableCell>
                      {u.activo ? (
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
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground tabular">
                      {formatearFechaHora(u.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 sm:gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setUsuarioParaClave(u)}
                          title={tu.restablecerTitulo}
                          aria-label={`${tu.restablecerTitulo} para ${u.username}`}
                          className="h-10 px-2.5 sm:px-3 text-muted-foreground hover:text-foreground"
                        >
                          <KeyRound className="size-4" aria-hidden="true" />
                          <span className="hidden lg:inline">{tu.restablecerTitulo}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={esYo || mutarEstado.isPending}
                          onClick={() => mutarEstado.mutate({ id: u.id, activo: !u.activo })}
                          title={esYo ? tu.bloqueoAutoDesactivacion : u.activo ? tu.desactivar : tu.activar}
                          aria-label={esYo ? tu.bloqueoAutoDesactivacion : u.activo ? tu.desactivar : tu.activar}
                          className="h-10 px-2.5 sm:px-3"
                        >
                          <Power
                            className={`size-4 ${u.activo ? 'text-destructive' : 'text-success'}`}
                            aria-hidden="true"
                          />
                          <span className="hidden sm:inline">
                            {u.activo ? tu.desactivar : tu.activar}
                          </span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUsuarioEditando(u)}
                          className="h-10 px-3"
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                          <span className="hidden sm:inline">{t.admin.comun.editar}</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Sheet para Crear / Editar Usuario */}
      <Sheet open={usuarioEditando !== null} onOpenChange={(o) => !o && setUsuarioEditando(null)}>
        <SheetContent
          className="flex w-full flex-col gap-6 overflow-y-auto sm:max-w-md"
          aria-labelledby="sheet-usuario-titulo"
        >
          {usuarioEditando === 'nuevo' && (
            <FormularioCrearUsuario
              onGuardado={() => {
                setUsuarioEditando(null);
                void queryClient.invalidateQueries({ queryKey: ['usuarios'] });
              }}
              onCancelar={() => setUsuarioEditando(null)}
            />
          )}
          {usuarioEditando !== null && usuarioEditando !== 'nuevo' && (
            <FormularioEditarUsuario
              key={usuarioEditando.id}
              usuario={usuarioEditando}
              esYo={usuarioActual?.id === usuarioEditando.id}
              onGuardado={() => {
                setUsuarioEditando(null);
                void queryClient.invalidateQueries({ queryKey: ['usuarios'] });
              }}
              onCancelar={() => setUsuarioEditando(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog para Restablecer Contraseña */}
      {usuarioParaClave && (
        <DialogRestablecerClave
          usuario={usuarioParaClave}
          onCerrar={() => setUsuarioParaClave(null)}
        />
      )}
    </PaginaAdmin>
  );
}

function FormularioCrearUsuario({
  onGuardado,
  onCancelar,
}: {
  onGuardado: () => void;
  onCancelar: () => void;
}) {
  const tu = t.admin.usuarios;

  const form = useForm<CrearUsuarioInput>({
    resolver: zodResolver(crearUsuarioSchema),
    defaultValues: {
      username: '',
      nombre: '',
      rol: 'CAJERO',
      password: '',
    },
  });

  const mutar = useMutation({
    mutationFn: (datos: CrearUsuarioInput) =>
      api<UsuarioDetalle>('/usuarios', { method: 'POST', body: JSON.stringify(datos) }),
    onSuccess: () => {
      toast.success(tu.creado);
      onGuardado();
    },
    onError: (err) => manejarErrorMutacion(err, form.setError),
  });

  const onSubmit = (datos: CrearUsuarioInput) => {
    mutar.mutate(datos);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <SheetHeader className="p-0 text-left">
        <SheetTitle id="sheet-usuario-titulo">{tu.nuevoTitulo}</SheetTitle>
        <SheetDescription>{tu.descripcion}</SheetDescription>
      </SheetHeader>

      <Campo
        id="crear-nombre"
        etiqueta={tu.nombre}
        error={form.formState.errors.nombre?.message}
      >
        <Input
          {...ariaCampo('crear-nombre', form.formState.errors.nombre?.message)}
          {...form.register('nombre')}
          autoFocus
          className="h-12"
          placeholder="Ej. Juan Pérez"
        />
      </Campo>

      <Campo
        id="crear-username"
        etiqueta={tu.username}
        ayuda={tu.usernameAyuda}
        error={form.formState.errors.username?.message}
      >
        <Input
          {...ariaCampo(
            'crear-username',
            form.formState.errors.username?.message,
            tu.usernameAyuda,
          )}
          {...form.register('username')}
          className="h-12 lowercase font-mono"
          placeholder="ej. juanp"
        />
      </Campo>

      <Campo
        id="crear-rol"
        etiqueta={tu.rol}
        error={form.formState.errors.rol?.message}
      >
        <Select
          {...ariaCampo('crear-rol', form.formState.errors.rol?.message)}
          {...form.register('rol')}
        >
          <option value="ADMIN">{t.roles.ADMIN}</option>
          <option value="CAJERO">{t.roles.CAJERO}</option>
          <option value="COCINA">{t.roles.COCINA}</option>
        </Select>
      </Campo>

      <Campo
        id="crear-password"
        etiqueta={tu.password}
        ayuda={tu.passwordAyuda}
        error={form.formState.errors.password?.message}
      >
        <Input
          type="password"
          autoComplete="new-password"
          {...ariaCampo(
            'crear-password',
            form.formState.errors.password?.message,
            tu.passwordAyuda,
          )}
          {...form.register('password')}
          className="h-12"
          placeholder="••••••••"
        />
      </Campo>

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

function FormularioEditarUsuario({
  usuario,
  esYo,
  onGuardado,
  onCancelar,
}: {
  usuario: UsuarioDetalle;
  esYo: boolean;
  onGuardado: () => void;
  onCancelar: () => void;
}) {
  const tu = t.admin.usuarios;

  const form = useForm<ActualizarUsuarioInput>({
    resolver: zodResolver(actualizarUsuarioSchema),
    defaultValues: {
      nombre: usuario.nombre,
      rol: usuario.rol,
      activo: usuario.activo,
    },
  });

  const mutar = useMutation({
    mutationFn: (datos: ActualizarUsuarioInput) =>
      api<UsuarioDetalle>(`/usuarios/${usuario.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nombre: datos.nombre,
          rol: esYo ? undefined : datos.rol,
          activo: esYo ? undefined : datos.activo,
        }),
      }),
    onSuccess: () => {
      toast.success(tu.actualizado);
      onGuardado();
    },
    onError: (err) => manejarErrorMutacion(err, form.setError),
  });

  const onSubmit = (datos: ActualizarUsuarioInput) => {
    mutar.mutate(datos);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <SheetHeader className="p-0 text-left">
        <SheetTitle id="sheet-usuario-titulo">{tu.editarTitulo}</SheetTitle>
        <SheetDescription>{tu.descripcion}</SheetDescription>
      </SheetHeader>

      <Campo
        id="editar-nombre"
        etiqueta={tu.nombre}
        error={form.formState.errors.nombre?.message}
      >
        <Input
          {...ariaCampo('editar-nombre', form.formState.errors.nombre?.message)}
          {...form.register('nombre')}
          autoFocus
          className="h-12"
        />
      </Campo>

      <Campo id="editar-username-ver" etiqueta={tu.username}>
        <Input
          value={usuario.username}
          readOnly
          disabled
          className="h-12 font-mono bg-muted text-muted-foreground"
        />
      </Campo>

      <Campo
        id="editar-rol"
        etiqueta={tu.rol}
        ayuda={esYo ? tu.bloqueoAutoRol : undefined}
        error={form.formState.errors.rol?.message}
      >
        <Select
          {...ariaCampo('editar-rol', form.formState.errors.rol?.message)}
          {...form.register('rol')}
          disabled={esYo}
        >
          <option value="ADMIN">{t.roles.ADMIN}</option>
          <option value="CAJERO">{t.roles.CAJERO}</option>
          <option value="COCINA">{t.roles.COCINA}</option>
        </Select>
      </Campo>

      <CasillaCampo
        id="editar-activo"
        etiqueta={tu.activo}
        disabled={esYo}
        {...form.register('activo')}
      />

      {esYo && (
        <p className="text-xs text-muted-foreground">
          {tu.bloqueoAutoDesactivacion}
        </p>
      )}

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

function DialogRestablecerClave({
  usuario,
  onCerrar,
}: {
  usuario: UsuarioDetalle;
  onCerrar: () => void;
}) {
  const tu = t.admin.usuarios;

  const form = useForm<RestablecerClaveInput>({
    resolver: zodResolver(restablecerClaveSchema),
    defaultValues: { password: '' },
  });

  const mutar = useMutation({
    mutationFn: (datos: RestablecerClaveInput) =>
      api<{ ok: boolean }>(`/usuarios/${usuario.id}/clave`, {
        method: 'POST',
        body: JSON.stringify(datos),
      }),
    onSuccess: () => {
      toast.success(tu.claveRestablecida);
      onCerrar();
    },
    onError: (err) => manejarErrorMutacion(err, form.setError),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onCerrar()}>
      <DialogContent className="max-w-md">
        <form onSubmit={form.handleSubmit((d) => mutar.mutate(d))}>
          <DialogHeader>
            <DialogTitle>{tu.restablecerTitulo}</DialogTitle>
            <DialogDescription>
              {tu.restablecerDescripcion(`@${usuario.username}`)}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <Campo
              id="clave-nueva"
              etiqueta={tu.passwordNueva}
              ayuda={tu.passwordAyuda}
              error={form.formState.errors.password?.message}
            >
              <Input
                type="password"
                autoComplete="new-password"
                autoFocus
                {...ariaCampo(
                  'clave-nueva',
                  form.formState.errors.password?.message,
                  tu.passwordAyuda,
                )}
                {...form.register('password')}
                className="h-12"
                placeholder="••••••••"
              />
            </Campo>

            <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-foreground">
              {tu.desactivarAdvertencia}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCerrar}
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
              {tu.restablecerTitulo}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
