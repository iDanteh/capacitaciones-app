'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

// ─── Schema de validación ─────────────────────────────────────────────────────

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

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function InputField({
  label,
  error,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <input
        {...props}
        className={`w-full rounded-xl border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all
          focus:border-navy/40 focus:ring-2 focus:ring-sky/20
          ${error ? 'border-destructive/60 bg-destructive/5' : 'border-border bg-white hover:border-navy/25'}`}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

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
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12"
        style={{ background: 'linear-gradient(155deg, #0B5A8C 0%, #071F30 60%, #050E1A 100%)' }}
      >
        {/* Logo placeholder */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky to-[#38BDF8] shadow-lg shadow-sky/30">
            <span className="text-sm font-bold text-navy">L</span>
          </div>
          <span className="text-lg font-semibold text-white/90">LMS</span>
        </div>

        {/* Quote central */}
        <div className="space-y-6">
          <div className="h-px w-12" style={{ background: 'linear-gradient(90deg, #5AC8FA, transparent)' }} />
          <blockquote className="text-2xl font-medium leading-snug text-white/85">
            "El talento de tu equipo es tu mayor ventaja competitiva."
          </blockquote>
          <p className="text-sm text-white/35">
            Capacita, mide y certifica desde una sola plataforma.
          </p>
        </div>

        {/* Decoración bento mini */}
        <div className="grid grid-cols-3 gap-3 opacity-20">
          {[`#5AC8FA`, `#14B8A6`, `#0B5A8C`, `#38BDF8`, `#0E6FAD`, `#5AC8FA`].map((c, i) => (
            <div key={i} className="h-12 rounded-xl border"
              style={{ borderColor: `${c}30`, background: `${c}15` }} />
          ))}
        </div>
      </aside>

      {/* ── Panel derecho (formulario) ── */}
      <main className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-12">
        {/* Logo mobile */}
        <div className="mb-10 flex items-center gap-2.5 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky to-navy shadow-sm">
            <span className="text-xs font-bold text-white">L</span>
          </div>
          <span className="text-base font-semibold text-navy">LMS</span>
        </div>

        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">Bienvenido de nuevo</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ingresa los datos de tu empresa para continuar.
            </p>
          </div>

          {/* Error de servidor */}
          {serverError && (
            <div className="mb-6 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
              <p className="text-sm text-destructive">{serverError}</p>
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
                  className="text-xs text-navy/60 transition-colors hover:text-navy">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                className={`w-full rounded-xl border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all focus:border-navy/40 focus:ring-2 focus:ring-sky/20
                  ${errors.password ? 'border-destructive/60 bg-destructive/5' : 'border-border bg-white hover:border-navy/25'}`}
                {...register('password')}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl py-3.5 text-sm font-semibold text-navy shadow-md shadow-sky/20 transition-all hover:shadow-sky/35 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #5AC8FA, #38BDF8)' }}
            >
              {isSubmitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
            </button>
          </form>

          {/* Divisor */}
          <div className="my-7 flex items-center gap-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground/60">¿No tienes cuenta?</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Link href="/register"
            className="block w-full rounded-xl border border-border py-3.5 text-center text-sm font-semibold text-foreground transition-all hover:border-navy/25 hover:bg-secondary">
            Crear cuenta gratis
          </Link>

          <p className="mt-8 text-center text-xs text-muted-foreground/50">
            Al iniciar sesión aceptas nuestros{' '}
            <span className="text-navy/60">Términos de servicio</span>{' '}
            y{' '}
            <span className="text-navy/60">Política de privacidad</span>.
          </p>
        </div>
      </main>
    </div>
  );
}
