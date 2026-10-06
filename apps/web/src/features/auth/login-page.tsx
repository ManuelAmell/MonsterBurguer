import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { loginSchema, type LoginInput } from '@mb/shared';
import type { z } from 'zod';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { t } from '@/i18n/es';
import { ApiError } from '@/lib/api';
import { RUTA_INICIO_POR_ROL, useLogin, useSesion } from './session';

/** HU-01 · DESIGN.md §7.1 */
export function LoginPage() {
  const { data: usuario } = useSesion();
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const [verContrasena, setVerContrasena] = useState(false);
  const errorId = useId();

  const form = useForm<LoginInput, unknown, z.output<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
    mode: 'onTouched',
  });
  const { errors } = form.formState;

  if (usuario) return <Navigate to={RUTA_INICIO_POR_ROL[usuario.rol]} replace />;

  const onSubmit = form.handleSubmit(async (datos) => {
    const { usuario: u } = await login.mutateAsync(datos).catch(() => ({ usuario: null }));
    if (!u) {
      form.setFocus('password');
      return;
    }
    const desde = (location.state as { desde?: string } | null)?.desde;
    navigate(desde && desde !== '/' ? desde : RUTA_INICIO_POR_ROL[u.rol], { replace: true });
  });

  const mensajeServidor = login.error
    ? login.error instanceof ApiError
      ? login.error.message
      : t.errores.inesperado
    : null;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(ellipse_at_top,var(--color-muted),transparent_60%)] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="gap-6">
          <Logo />
          <div className="space-y-1.5">
            <CardTitle>{t.login.titulo}</CardTitle>
            <CardDescription>{t.login.descripcion}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={onSubmit} className="space-y-5" aria-describedby={mensajeServidor ? errorId : undefined}>
            <div className="space-y-2">
              <Label htmlFor="username">{t.login.usuario}</Label>
              <Input
                id="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                aria-invalid={errors.username ? true : undefined}
                aria-describedby={errors.username ? 'username-error' : undefined}
                {...form.register('username')}
              />
              {errors.username && (
                <p id="username-error" role="alert" className="text-sm font-medium text-destructive">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t.login.contrasena}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={verContrasena ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="pr-14"
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  {...form.register('password')}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-0 right-0 text-muted-foreground"
                  aria-label={verContrasena ? t.login.ocultarContrasena : t.login.mostrarContrasena}
                  aria-pressed={verContrasena}
                  onClick={() => setVerContrasena((v) => !v)}
                >
                  {verContrasena ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </Button>
              </div>
              {errors.password && (
                <p id="password-error" role="alert" className="text-sm font-medium text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            {mensajeServidor && (
              <p
                id={errorId}
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
              >
                {mensajeServidor}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
              {login.isPending ? t.login.ingresando : t.login.ingresar}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
