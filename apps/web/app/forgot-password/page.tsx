'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { api } from '@/lib/api';
import { CaptaLogo } from '@/components/capta-logo';
import { Icon } from '@/components/capta-icon';

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  tenantSlug: z
    .string()
    .min(1, 'El identificador de empresa es requerido')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  email: z.string().email('Ingresa un email válido'),
});

type FormData = z.infer<typeof schema>;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await api.post('/auth/forgot-password', data);
    } catch {
      // Siempre mostramos éxito para no filtrar si el email/empresa existe
    }
    setSent(true);
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
          {sent ? (
            /* ── Estado: enviado ── */
            <motion.div
              key="sent"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="rounded-2xl border border-border bg-card p-8 text-center"
            >
              <div
                className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ background: 'color-mix(in srgb, var(--tenant-primary) 10%, transparent)' }}
              >
                <Icon name="mail" size={26} style={{ color: 'var(--tenant-primary)' }} />
              </div>
              <h1 className="font-display text-xl font-normal tracking-tight text-foreground">
                Revisa tu correo
              </h1>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Si tu cuenta existe, recibirás un enlace para restablecer tu contraseña en los próximos minutos.
              </p>
              <p className="mt-4 text-xs text-muted-foreground/60">
                El enlace expira en 1 hora. Revisa también tu carpeta de spam.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Icon name="arrow-left" size={14} />
                Volver al inicio de sesión
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
                  Recuperar contraseña
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Ingresa tu empresa y correo. Te enviaremos un enlace para restablecer tu contraseña.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                {/* Slug de empresa */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-foreground">
                    Identificador de empresa
                  </label>
                  <input
                    type="text"
                    placeholder="acme-corp"
                    autoComplete="organization"
                    className={`w-full rounded-xl border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all
                      focus:border-capta-soft/60
                      ${errors.tenantSlug ? 'border-destructive/60 bg-destructive/5' : 'border-border bg-background hover:border-capta-deep/30 dark:hover:border-capta-soft/25'}`}
                    {...register('tenantSlug')}
                  />
                  {errors.tenantSlug && (
                    <p className="text-xs font-medium text-destructive">{errors.tenantSlug.message}</p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-foreground">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    placeholder="juan@acme.com"
                    autoComplete="email"
                    className={`w-full rounded-xl border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all
                      focus:border-capta-soft/60
                      ${errors.email ? 'border-destructive/60 bg-destructive/5' : 'border-border bg-background hover:border-capta-deep/30 dark:hover:border-capta-soft/25'}`}
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="text-xs font-medium text-destructive">{errors.email.message}</p>
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
                      Enviando…
                    </span>
                  ) : 'Enviar enlace de recuperación'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                ¿Ya recuerdas tu contraseña?{' '}
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
