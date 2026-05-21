'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { CaptaLogo } from '@/components/capta-logo';
import { Icon } from '@/components/capta-icon';

// ─── Schema ───────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  tenantSlug: z
    .string()
    .min(1, 'El identificador de empresa es requerido')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  email: z.string().email('Ingresa un email válido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

type LoginForm = z.infer<typeof loginSchema>;

// ─── Input field ──────────────────────────────────────────────────────────────

function InputField({
  label, error, hint, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string; error?: string; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <input
        {...props}
        className={`w-full rounded-xl border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all
          focus:border-capta-soft/60 focus:ring-2 focus:ring-capta-soft/12
          ${error
            ? 'border-destructive/60 bg-destructive/5'
            : 'border-border bg-background hover:border-capta-deep/30 dark:hover:border-capta-soft/25'
          }`}
      />
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setServerError(null);
    try {
      const res = await api.post<{
        accessToken: string;
        refreshToken: string;
        user: { tenantSlug: string };
      }>('/auth/login', data);

      localStorage.setItem('access_token', res.data.accessToken);
      localStorage.setItem('refresh_token', res.data.refreshToken);
      localStorage.setItem('tenant_slug', res.data.user.tenantSlug);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      router.push('/dashboard');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setServerError(message ?? 'Credenciales inválidas. Verifica tus datos.');
    }
  };

  return (
    <div className="flex min-h-screen">

      {/* ── Panel izquierdo (branding) ── */}
      <aside
        className="relative hidden lg:flex lg:w-[44%] flex-col justify-between overflow-hidden p-12"
        style={{ background: 'linear-gradient(155deg, #0A1419 0%, #1E4F7A 55%, #2D6FA0 100%)' }}
      >
        {/* Decorative grid */}
        <div aria-hidden className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(#FFFFFF06 1px, transparent 1px), linear-gradient(90deg, #FFFFFF06 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* Glow */}
        <div aria-hidden className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full opacity-20 blur-3xl"
          style={{ background: '#8FC4E8' }} />

        {/* Logo */}
        <div className="relative">
          <CaptaLogo markSize={36} showText forceDark />
        </div>

        {/* Quote */}
        <div className="relative space-y-5">
          <div className="h-px w-10"
            style={{ background: 'linear-gradient(90deg, #8FC4E8, transparent)' }} />
          <blockquote className="text-2xl font-semibold leading-snug text-white/90">
            "El talento de tu equipo es tu mayor ventaja competitiva."
          </blockquote>
          <p className="text-sm font-medium text-white/35">
            Capacita, mide y certifica desde una sola plataforma.
          </p>

          {/* Mini stats */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            {[
              { val: '312', label: 'Colaboradores' },
              { val: '78%', label: 'Tasa completado' },
              { val: '24',  label: 'Cursos activos' },
              { val: '8.4h', label: 'Promedio semanal' },
            ].map((s) => (
              <div key={s.label}
                className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
                <div className="text-xl font-bold text-white/90">{s.val}</div>
                <div className="text-xs text-white/40">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Decoración bento mini */}
        <div className="relative grid grid-cols-4 gap-2 opacity-15">
          {['#8FC4E8', '#7FD1AE', '#1E4F7A', '#DCE9F4', '#2D6FA0', '#8FC4E8', '#7FD1AE', '#1E4F7A'].map((c, i) => (
            <div key={i} className="h-8 rounded-lg border"
              style={{ borderColor: `${c}40`, background: `${c}18` }} />
          ))}
        </div>
      </aside>

      {/* ── Panel derecho (formulario) ── */}
      <main className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">

        {/* Mobile logo */}
        <div className="mb-10 lg:hidden">
          <CaptaLogo markSize={32} showText />
        </div>

        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Bienvenido de nuevo
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ingresa los datos de tu empresa para continuar.
            </p>
          </div>

          {/* Error banner */}
          {serverError && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
              <Icon name="alert-circle" size={16} className="flex-shrink-0 mt-0.5 text-destructive" />
              <p className="text-sm font-medium text-destructive">{serverError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <InputField
              label="Identificador de empresa"
              hint="El slug de tu empresa (ej: acme-corp)"
              placeholder="acme-corp"
              autoComplete="organization"
              error={errors.tenantSlug?.message}
              {...register('tenantSlug')}
            />
            <InputField
              label="Correo electrónico"
              type="email"
              placeholder="juan@acme.com"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Contraseña</label>
                <Link href="/forgot-password"
                  className="text-xs font-medium text-capta-deep/60 transition-colors hover:text-capta-deep dark:text-capta-soft/60 dark:hover:text-capta-soft">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                className={`w-full rounded-xl border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all
                  focus:border-capta-soft/60 focus:ring-2 focus:ring-capta-soft/12
                  ${errors.password ? 'border-destructive/60 bg-destructive/5' : 'border-border bg-background hover:border-capta-deep/30 dark:hover:border-capta-soft/25'}`}
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs font-medium text-destructive">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="relative w-full overflow-hidden rounded-xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)',
                boxShadow: '0 4px 20px rgba(30,79,122,0.30)',
              }}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Icon name="refresh" size={16} className="animate-spin" />
                  Iniciando sesión…
                </span>
              ) : 'Iniciar sesión'}
            </button>
          </form>

          <div className="my-7 flex items-center gap-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-muted-foreground/50">¿No tienes cuenta?</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Link href="/register"
            className="block w-full rounded-xl border border-border bg-background py-3.5 text-center text-sm font-semibold text-foreground transition-all hover:border-capta-deep/20 hover:bg-muted dark:hover:border-capta-soft/20">
            Crear cuenta gratis
          </Link>

          <p className="mt-8 text-center text-xs text-muted-foreground/50">
            Al iniciar sesión aceptas nuestros{' '}
            <span className="text-capta-deep/60 dark:text-capta-soft/60">Términos de servicio</span>{' '}
            y{' '}
            <span className="text-capta-deep/60 dark:text-capta-soft/60">Política de privacidad</span>.
          </p>
        </div>
      </main>
    </div>
  );
}
