'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { CaptaLogo } from '@/components/capta-logo';
import { Icon } from '@/components/capta-icon';

// ─── Schema ───────────────────────────────────────────────────────────────────

const registerSchema = z
  .object({
    companyName: z
      .string()
      .min(2, 'El nombre de la empresa debe tener al menos 2 caracteres')
      .max(100),
    firstName: z.string().min(1, 'El nombre es requerido').max(50),
    lastName: z.string().min(1, 'El apellido es requerido').max(50),
    email: z.string().email('Ingresa un email válido').max(254),
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .max(72)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
        message: 'Debe tener al menos una mayúscula, una minúscula y un número',
      }),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden',
  });

type RegisterForm = z.infer<typeof registerSchema>;

// ─── Password strength ────────────────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ caracteres', ok: password.length >= 8 },
    { label: 'Mayúscula',     ok: /[A-Z]/.test(password) },
    { label: 'Minúscula',     ok: /[a-z]/.test(password) },
    { label: 'Número',        ok: /\d/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const barColors = ['bg-destructive/60', 'bg-orange-400', 'bg-yellow-400', 'bg-capta-soft', 'bg-emerald-400'];
  const strengthLabels = ['', 'Débil', 'Regular', 'Buena', 'Fuerte'];
  const strengthColors = ['', 'text-orange-500', 'text-yellow-500', 'text-capta-soft', 'text-emerald-500'];

  if (!password) return null;

  return (
    <div className="mt-2.5 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? barColors[score] : 'bg-border'}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2.5">
          {checks.map(({ label, ok }) => (
            <span key={label}
              className={`text-xs transition-colors ${ok ? 'text-emerald-500' : 'text-muted-foreground/40'}`}>
              {ok ? '✓' : '○'} {label}
            </span>
          ))}
        </div>
        {score > 0 && (
          <span className={`text-xs font-semibold ${strengthColors[score]}`}>
            {strengthLabels[score]}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Input field ──────────────────────────────────────────────────────────────

function InputField({
  label, error, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      <input {...props}
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

// ─── Plan labels ──────────────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  business:   { label: 'Business — $49/mes',   color: '#1E4F7A' },
  enterprise: { label: 'Enterprise — $149/mes', color: '#7FD1AE' },
};

// ─── Register form ────────────────────────────────────────────────────────────

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan') ?? 'free';
  const planInfo = PLAN_LABELS[plan];

  const [serverError, setServerError] = useState<string | null>(null);
  const [passwordValue, setPasswordValue] = useState('');

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const watchedPassword = watch('password', '');
  if (watchedPassword !== passwordValue) setPasswordValue(watchedPassword);

  const onSubmit = async (data: RegisterForm) => {
    setServerError(null);
    const { confirmPassword: _, ...payload } = data;
    try {
      const res = await api.post<{
        accessToken: string;
        refreshToken: string;
        user: { tenantSlug: string };
      }>('/auth/register', payload);
      localStorage.setItem('access_token', res.data.accessToken);
      localStorage.setItem('refresh_token', res.data.refreshToken);
      localStorage.setItem('tenant_slug', res.data.user.tenantSlug);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      router.push('/dashboard');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setServerError(message ?? 'Ocurrió un error al crear tu cuenta. Intenta de nuevo.');
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Crea tu cuenta</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Configura tu empresa y comienza a capacitar a tu equipo.
        </p>
        {planInfo && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
            style={{ borderColor: `${planInfo.color}30`, background: `${planInfo.color}08`, color: planInfo.color }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: planInfo.color }} />
            Plan seleccionado: {planInfo.label}
          </div>
        )}
      </div>

      {serverError && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
          <Icon name="alert-circle" size={16} className="flex-shrink-0 mt-0.5 text-destructive" />
          <p className="text-sm font-medium text-destructive">{serverError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <InputField
          label="Nombre de la empresa"
          placeholder="Acme Corp"
          autoComplete="organization"
          error={errors.companyName?.message}
          {...register('companyName')}
        />

        <div className="grid grid-cols-2 gap-4">
          <InputField
            label="Nombre"
            placeholder="Juan"
            autoComplete="given-name"
            error={errors.firstName?.message}
            {...register('firstName')}
          />
          <InputField
            label="Apellido"
            placeholder="Pérez"
            autoComplete="family-name"
            error={errors.lastName?.message}
            {...register('lastName')}
          />
        </div>

        <InputField
          label="Correo electrónico"
          type="email"
          placeholder="juan@acme.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />

        {/* Password with strength */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">Contraseña</label>
          <input
            type="password"
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            className={`w-full rounded-xl border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all
              focus:border-capta-soft/60 focus:ring-2 focus:ring-capta-soft/12
              ${errors.password ? 'border-destructive/60 bg-destructive/5' : 'border-border bg-background hover:border-capta-deep/30 dark:hover:border-capta-soft/25'}`}
            {...register('password')}
          />
          {errors.password
            ? <p className="text-xs font-medium text-destructive">{errors.password.message}</p>
            : <PasswordStrength password={passwordValue} />
          }
        </div>

        <InputField
          label="Confirmar contraseña"
          type="password"
          placeholder="Repite tu contraseña"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)',
            boxShadow: '0 4px 20px rgba(30,79,122,0.30)',
          }}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <Icon name="refresh" size={16} className="animate-spin" />
              Creando cuenta…
            </span>
          ) : 'Crear cuenta gratis'}
        </button>

        <p className="text-center text-xs text-muted-foreground/50">
          Al registrarte aceptas nuestros{' '}
          <span className="text-capta-deep/60 dark:text-capta-soft/60">Términos de servicio</span>{' '}
          y{' '}
          <span className="text-capta-deep/60 dark:text-capta-soft/60">Política de privacidad</span>.
        </p>
      </form>

      <div className="my-6 flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-muted-foreground/50">¿Ya tienes cuenta?</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Link href="/login"
        className="block w-full rounded-xl border border-border bg-background py-3.5 text-center text-sm font-semibold text-foreground transition-all hover:border-capta-deep/20 hover:bg-muted dark:hover:border-capta-soft/20">
        Iniciar sesión
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen">

      {/* ── Panel izquierdo (branding) ── */}
      <aside
        className="relative hidden lg:flex lg:w-[44%] flex-col justify-between overflow-hidden p-12"
        style={{ background: 'linear-gradient(155deg, #0A1419 0%, #1E4F7A 50%, #2D6FA0 100%)' }}
      >
        {/* Grid decorativo */}
        <div aria-hidden className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(#FFFFFF06 1px, transparent 1px), linear-gradient(90deg, #FFFFFF06 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div aria-hidden className="pointer-events-none absolute -top-20 -left-20 h-80 w-80 rounded-full opacity-15 blur-3xl"
          style={{ background: '#8FC4E8' }} />

        {/* Logo */}
        <div className="relative">
          <CaptaLogo markSize={36} showText forceDark />
        </div>

        {/* Value props */}
        <div className="relative space-y-5">
          <div className="h-px w-10"
            style={{ background: 'linear-gradient(90deg, #8FC4E8, transparent)' }} />
          <h2 className="text-2xl font-semibold leading-snug text-white/90">
            Todo incluido desde el primer día.
          </h2>
          <p className="text-sm font-medium text-white/35">
            Cursos, evaluaciones, certificados y analíticas — en una sola plataforma.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 pt-2">
            {['Multi-empresa', 'Certificados', 'Analíticas', 'API access', 'White-label', 'Storage flexible'].map((f) => (
              <span key={f}
                className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-xs font-medium text-white/50">
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Decoración */}
        <div className="relative space-y-2 opacity-15">
          <div className="flex gap-2">
            {['#8FC4E8', '#7FD1AE', '#DCE9F4', '#1E4F7A'].map((c, i) => (
              <div key={i} className="h-2 flex-1 rounded-full border"
                style={{ background: `${c}30`, borderColor: `${c}40` }} />
            ))}
          </div>
          <div className="h-14 rounded-2xl border border-white/10 bg-white/4" />
        </div>
      </aside>

      {/* ── Panel derecho (formulario) ── */}
      <main className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-10">
        {/* Mobile logo */}
        <div className="mb-8 lg:hidden">
          <CaptaLogo markSize={32} showText />
        </div>

        <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando…</div>}>
          <RegisterForm />
        </Suspense>
      </main>
    </div>
  );
}
