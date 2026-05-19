'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

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

// ─── Strength indicator ───────────────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ caracteres', ok: password.length >= 8 },
    { label: 'Mayúscula', ok: /[A-Z]/.test(password) },
    { label: 'Minúscula', ok: /[a-z]/.test(password) },
    { label: 'Número', ok: /\d/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const colors = ['bg-destructive/60', 'bg-orange-400', 'bg-yellow-400', 'bg-sky', 'bg-emerald-400'];
  const labels = ['', 'Débil', 'Regular', 'Buena', 'Fuerte'];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i}
            className={`h-1 flex-1 rounded-full transition-all ${i <= score ? colors[score] : 'bg-border'}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {checks.map(({ label, ok }) => (
          <span key={label}
            className={`text-xs transition-colors ${ok ? 'text-emerald-500' : 'text-muted-foreground/50'}`}>
            {ok ? '✓' : '○'} {label}
          </span>
        ))}
        {score > 0 && (
          <span className={`ml-auto text-xs font-medium ${colors[score].replace('bg-', 'text-')}`}>
            {labels[score]}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Input helper ─────────────────────────────────────────────────────────────

function InputField({
  label, error, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      <input {...props}
        className={`w-full rounded-xl border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all
          focus:border-sky/50 focus:ring-2 focus:ring-sky/15
          ${error ? 'border-destructive/60 bg-destructive/5' : 'border-border bg-background hover:border-navy/30 dark:hover:border-sky/30'}`}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── Plan badge ───────────────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  business:   { label: 'Business — $49/mes', color: '#0B5A8C' },
  enterprise: { label: 'Enterprise — $149/mes', color: '#14B8A6' },
};

// ─── Form inner (usa useSearchParams — debe estar en Suspense) ────────────────

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

  // Observar contraseña para el indicador de fortaleza
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Crea tu cuenta</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Configura tu empresa y comienza a capacitar a tu equipo.
        </p>

        {/* Plan seleccionado */}
        {planInfo && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"
            style={{ borderColor: `${planInfo.color}30`, background: `${planInfo.color}08`, color: planInfo.color }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: planInfo.color }} />
            Plan seleccionado: {planInfo.label}
          </div>
        )}
      </div>

      {serverError && (
        <div className="mb-6 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{serverError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {/* Empresa */}
        <InputField
          label="Nombre de la empresa"
          placeholder="Acme Corp"
          autoComplete="organization"
          error={errors.companyName?.message}
          {...register('companyName')}
        />

        {/* Nombre y apellido en fila */}
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

        {/* Contraseña con strength indicator */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">Contraseña</label>
          <input
            type="password"
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            className={`w-full rounded-xl border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all
              focus:border-sky/50 focus:ring-2 focus:ring-sky/15
              ${errors.password ? 'border-destructive/60 bg-destructive/5' : 'border-border bg-background hover:border-navy/30 dark:hover:border-sky/30'}`}
            {...register('password')}
          />
          {errors.password
            ? <p className="text-xs text-destructive">{errors.password.message}</p>
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
          className="w-full rounded-xl py-3.5 text-sm font-semibold text-navy shadow-md shadow-sky/20 transition-all hover:shadow-sky/35 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #5AC8FA, #38BDF8)' }}
        >
          {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta gratis'}
        </button>

        <p className="text-center text-xs text-muted-foreground/50">
          Al registrarte aceptas nuestros{' '}
          <span className="text-navy/60">Términos de servicio</span>{' '}
          y{' '}
          <span className="text-navy/60">Política de privacidad</span>.
        </p>
      </form>

      <div className="my-7 flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground/60">¿Ya tienes cuenta?</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Link href="/login"
        className="block w-full rounded-xl border border-border py-3.5 text-center text-sm font-semibold text-foreground transition-all hover:border-navy/25 hover:bg-secondary">
        Iniciar sesión
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen">
      {/* ── Panel izquierdo ── */}
      <aside
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12"
        style={{ background: 'linear-gradient(155deg, #071F30 0%, #0B5A8C 50%, #0E6FAD 100%)' }}
      >
        {/* Logo placeholder */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky to-[#38BDF8] shadow-lg shadow-sky/30">
            <span className="text-sm font-bold text-navy">L</span>
          </div>
          <span className="text-lg font-semibold text-white/90">LMS</span>
        </div>

        {/* Planes visuales */}
        <div className="space-y-5">
          <div className="h-px w-12" style={{ background: 'linear-gradient(90deg, #5AC8FA, transparent)' }} />
          <h2 className="text-2xl font-medium leading-snug text-white/85">
            Todo incluido desde el primer día.
          </h2>
          <p className="text-sm text-white/35">
            Cursos, evaluaciones, certificados y analíticas — en una sola plataforma.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 pt-2">
            {['Multi-empresa', 'Certificados', 'Analíticas', 'API access', 'White-label', 'Storage flexible'].map((f) => (
              <span key={f}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50">
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Decoración */}
        <div className="space-y-2 opacity-15">
          <div className="flex gap-2">
            {['#5AC8FA', '#14B8A6', '#38BDF8', '#0B5A8C'].map((c, i) => (
              <div key={i} className="h-2 rounded-full flex-1 border"
                style={{ background: `${c}30`, borderColor: `${c}40` }} />
            ))}
          </div>
          <div className="h-16 rounded-2xl border border-white/10 bg-white/5" />
        </div>
      </aside>

      {/* ── Panel derecho (formulario) ── */}
      <main className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
        {/* Logo mobile */}
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky to-navy shadow-sm">
            <span className="text-xs font-bold text-white">L</span>
          </div>
          <span className="text-base font-semibold text-navy">LMS</span>
        </div>

        <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando…</div>}>
          <RegisterForm />
        </Suspense>
      </main>
    </div>
  );
}
