'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { CaptaLogo } from '@/components/capta-logo';
import { Icon } from '@/components/capta-icon';

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .max(72)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
        message: 'Debe tener al menos una mayúscula, una minúscula y un número',
      }),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden',
  });

type FormData = z.infer<typeof schema>;

// ─── Password strength ────────────────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ caracteres', ok: password.length >= 8 },
    { label: 'Mayúscula',     ok: /[A-Z]/.test(password) },
    { label: 'Minúscula',     ok: /[a-z]/.test(password) },
    { label: 'Número',        ok: /\d/.test(password) },
  ];
  const score = checks.filter(c => c.ok).length;
  const colors = ['', 'text-destructive', 'text-amber-500', 'text-amber-400', 'text-emerald-500'];
  const labels = ['', 'Muy débil', 'Débil', 'Buena', 'Fuerte'];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? '' : 'bg-muted'}`}
            style={{
              background: i <= score
                ? score <= 1 ? '#ef4444' : score <= 3 ? '#f59e0b' : '#10b981'
                : undefined,
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {checks.map(({ label, ok }) => (
          <span key={label}
            className={`inline-flex items-center gap-1 text-xs transition-colors ${ok ? 'text-emerald-500' : 'text-muted-foreground/40'}`}>
            {ok
              ? <Icon name="check" size={10} className="flex-shrink-0" />
              : <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full border border-current" />}
            {label}
          </span>
        ))}
        {score > 0 && (
          <span className={`text-xs font-semibold ${colors[score]}`}>{labels[score]}</span>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const router    = useRouter();
  const [done, setDone]           = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const passwordValue = watch('newPassword', '');

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      await api.post('/auth/reset-password', { token, newPassword: data.newPassword });
      setDone(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setServerError(msg ?? 'El enlace es inválido o ha expirado. Solicita uno nuevo.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="mb-8">
          <Link href="/login">
            <CaptaLogo markSize={32} showText />
          </Link>
        </div>

        <AnimatePresence mode="wait">
          {done ? (
            /* ── Estado: éxito ── */
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="rounded-2xl border border-border bg-card p-8 text-center"
            >
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-500/10">
                <Icon name="check-circle" size={28} className="text-emerald-500" />
              </div>
              <h1 className="font-display text-xl font-normal tracking-tight text-foreground">
                Contraseña actualizada
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Tu contraseña fue restablecida correctamente. Redirigiendo al inicio de sesión…
              </p>
              <Link
                href="/login"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium"
                style={{ color: 'var(--tenant-primary)' }}
              >
                Ir al inicio de sesión
                <Icon name="arrow-right" size={14} />
              </Link>
            </motion.div>
          ) : (
            /* ── Formulario ── */
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            >
              <div className="mb-7">
                <h1 className="font-display text-2xl font-normal tracking-tight text-foreground">
                  Nueva contraseña
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Elige una contraseña segura para tu cuenta.
                </p>
              </div>

              {serverError && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
                  <Icon name="alert-circle" size={16} className="flex-shrink-0 mt-0.5 text-destructive" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-destructive">{serverError}</p>
                    <Link href="/forgot-password" className="mt-1 text-xs text-destructive/70 underline underline-offset-2">
                      Solicitar un nuevo enlace
                    </Link>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                {/* Nueva contraseña */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-foreground">
                    Nueva contraseña
                  </label>
                  <input
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                    className={`w-full rounded-xl border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all
                      focus:border-capta-soft/60
                      ${errors.newPassword ? 'border-destructive/60 bg-destructive/5' : 'border-border bg-background hover:border-capta-deep/30 dark:hover:border-capta-soft/25'}`}
                    {...register('newPassword')}
                  />
                  {errors.newPassword
                    ? <p className="text-xs font-medium text-destructive">{errors.newPassword.message}</p>
                    : <PasswordStrength password={passwordValue} />
                  }
                </div>

                {/* Confirmar */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-foreground">
                    Confirmar contraseña
                  </label>
                  <input
                    type="password"
                    placeholder="Repite tu contraseña"
                    autoComplete="new-password"
                    className={`w-full rounded-xl border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all
                      focus:border-capta-soft/60
                      ${errors.confirmPassword ? 'border-destructive/60 bg-destructive/5' : 'border-border bg-background hover:border-capta-deep/30 dark:hover:border-capta-soft/25'}`}
                    {...register('confirmPassword')}
                  />
                  {errors.confirmPassword && (
                    <p className="text-xs font-medium text-destructive">{errors.confirmPassword.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)',
                    boxShadow:  '0 4px 20px color-mix(in srgb, var(--tenant-primary) 30%, transparent)',
                  }}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Icon name="refresh" size={16} className="animate-spin" />
                      Actualizando…
                    </span>
                  ) : 'Restablecer contraseña'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                ¿Recordaste tu contraseña?{' '}
                <Link href="/login" className="font-medium text-foreground hover:underline underline-offset-2">
                  Iniciar sesión
                </Link>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
