'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import Link from 'next/link';

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z
  .object({
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

type FormData = z.infer<typeof schema>;

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface InviteInfo {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  companyName: string;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador', MANAGER: 'Manager', EMPLOYEE: 'Empleado',
};

// ─── Strength indicator ───────────────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ caracteres', ok: password.length >= 8 },
    { label: 'Mayúscula',     ok: /[A-Z]/.test(password) },
    { label: 'Minúscula',     ok: /[a-z]/.test(password) },
    { label: 'Número',        ok: /\d/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const colors = ['bg-destructive/60', 'bg-orange-400', 'bg-yellow-400', 'bg-sky', 'bg-emerald-400'];

  if (!password) return null;
  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= score ? colors[score] : 'bg-border'}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {checks.map(({ label, ok }) => (
          <span key={label} className={`text-xs transition-colors ${ok ? 'text-emerald-500' : 'text-muted-foreground/50'}`}>
            {ok ? '✓' : '○'} {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Inner form (needs useSearchParams → wrapped in Suspense) ─────────────────

function AcceptInviteForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get('token') ?? '';

  const [info,       setInfo]       = useState<InviteInfo | null>(null);
  const [infoError,  setInfoError]  = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success,    setSuccess]    = useState(false);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  const passwordValue = watch('password', '');

  // Fetch invite info on mount
  useEffect(() => {
    if (!token) { setInfoError('Token de invitación no encontrado'); return; }
    api.get<InviteInfo>(`/users/accept-invite/info?token=${token}`)
      .then((res) => setInfo(res.data))
      .catch((err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setInfoError(msg ?? 'Invitación inválida o expirada');
      });
  }, [token]);

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      await api.post('/users/accept-invite', { token, password: data.password });
      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setServerError(msg ?? 'Error al activar la cuenta. Intenta de nuevo.');
    }
  };

  // ── Token inválido ──
  if (infoError) {
    return (
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5">
          <span className="text-2xl">⚠️</span>
        </div>
        <h1 className="text-xl font-bold text-foreground">Invitación inválida</h1>
        <p className="mt-2 text-sm text-muted-foreground">{infoError}</p>
        <Link href="/login" className="mt-6 inline-block rounded-xl border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-all">
          Ir al inicio de sesión
        </Link>
      </div>
    );
  }

  // ── Cuenta activada con éxito ──
  if (success) {
    return (
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/30">
          <span className="text-2xl">✓</span>
        </div>
        <h1 className="text-xl font-bold text-foreground">¡Cuenta activada!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu cuenta fue creada correctamente. Serás redirigido al login en unos segundos.
        </p>
        <Link href="/login" className="mt-6 inline-block rounded-xl border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-all">
          Ir al login ahora
        </Link>
      </div>
    );
  }

  // ── Cargando info ──
  if (!info) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
        Verificando invitación…
      </div>
    );
  }

  // ── Formulario ──
  return (
    <div className="w-full max-w-md">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Activa tu cuenta</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Crea una contraseña para acceder a{' '}
          <span className="font-medium text-foreground">{info.companyName}</span>.
        </p>
        <div className="mt-3 rounded-xl border border-border bg-muted px-4 py-3">
          <p className="text-sm text-foreground font-medium">{info.firstName} {info.lastName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{info.email}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Rol: {ROLE_LABELS[info.role] ?? info.role}</p>
        </div>
      </div>

      {serverError && (
        <div className="mb-6 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{serverError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {/* Contraseña */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">Contraseña</label>
          <input
            type="password"
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            className={`w-full rounded-xl border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-sky/50 focus:ring-2 focus:ring-sky/15 ${errors.password ? 'border-destructive/60 bg-destructive/5' : 'border-border bg-background hover:border-navy/30 dark:hover:border-sky/30'}`}
            {...register('password')}
          />
          {errors.password
            ? <p className="text-xs text-destructive">{errors.password.message}</p>
            : <PasswordStrength password={passwordValue} />
          }
        </div>

        {/* Confirmar */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">Confirmar contraseña</label>
          <input
            type="password"
            placeholder="Repite tu contraseña"
            autoComplete="new-password"
            className={`w-full rounded-xl border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-sky/50 focus:ring-2 focus:ring-sky/15 ${errors.confirmPassword ? 'border-destructive/60 bg-destructive/5' : 'border-border bg-background hover:border-navy/30 dark:hover:border-sky/30'}`}
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl py-3.5 text-sm font-semibold text-navy shadow-md shadow-sky/20 transition-all hover:shadow-sky/35 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #5AC8FA, #38BDF8)' }}
        >
          {isSubmitting ? 'Activando cuenta…' : 'Activar cuenta'}
        </button>
      </form>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AcceptInvitePage() {
  return (
    <div className="flex min-h-screen">
      {/* Panel izquierdo */}
      <aside
        className="hidden lg:flex lg:w-[40%] flex-col justify-between p-12"
        style={{ background: 'linear-gradient(155deg, #071F30 0%, #0B5A8C 50%, #0E6FAD 100%)' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky to-[#38BDF8] shadow-lg shadow-sky/30">
            <span className="text-sm font-bold text-navy">L</span>
          </div>
          <span className="text-lg font-semibold text-white/90">LMS</span>
        </div>

        <div className="space-y-5">
          <div className="h-px w-12" style={{ background: 'linear-gradient(90deg, #5AC8FA, transparent)' }} />
          <h2 className="text-2xl font-medium leading-snug text-white/85">
            Bienvenido al equipo.
          </h2>
          <p className="text-sm text-white/35">
            Crea tu contraseña y empieza a acceder a los cursos y capacitaciones de tu empresa.
          </p>
        </div>

        <p className="text-xs text-white/20">© {new Date().getFullYear()} Capacitaciones LMS</p>
      </aside>

      {/* Panel derecho */}
      <main className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky to-navy shadow-sm">
            <span className="text-xs font-bold text-white">L</span>
          </div>
          <span className="text-base font-semibold text-navy">LMS</span>
        </div>

        <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando…</div>}>
          <AcceptInviteForm />
        </Suspense>
      </main>
    </div>
  );
}
