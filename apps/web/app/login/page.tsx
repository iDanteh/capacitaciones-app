'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { api, setAccessToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { CaptaLogo } from '@/components/capta-logo';
import { Icon } from '@/components/capta-icon';
import { useTenantBranding } from '@/hooks/useTenantBranding';
import { applyTenantHead, resetTenantHead } from '@/lib/tenant-head';

// ─── Schemas ──────────────────────────────────────────────────────────────────

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

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AuthResponse {
  accessToken: string;
  user: {
    tenantSlug: string;
    [key: string]: unknown;
  };
}

interface MfaChallenge {
  mfaPending: true;
  mfaToken:   string;
}

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

// ─── OTP Input (6 dígitos, auto-avance) ──────────────────────────────────────

function OtpInput({ value, onChange, disabled }: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = value.split('');
      if (next[i]) {
        next[i] = '';
        onChange(next.join(''));
      } else if (i > 0) {
        next[i - 1] = '';
        onChange(next.join(''));
        inputsRef.current[i - 1]?.focus();
      }
    }
  };

  const handleChange = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const digit = e.target.value.replace(/\D/g, '').slice(-1);
    const next  = (value.padEnd(6, ' ')).split('');
    next[i]     = digit;
    const joined = next.join('').trimEnd();
    onChange(joined);
    if (digit && i < 5) inputsRef.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text) { onChange(text); inputsRef.current[Math.min(text.length, 5)]?.focus(); }
    e.preventDefault();
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {[...Array(6)].map((_, i) => (
        <input
          key={i}
          ref={el => { inputsRef.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={value[i] ?? ''}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKeyDown(i, e)}
          onFocus={e => e.target.select()}
          className="h-14 w-12 rounded-xl border border-border bg-background text-center text-xl font-bold text-foreground outline-none transition-all focus:border-capta-deep/60 focus:ring-2 focus:ring-capta-deep/12 dark:focus:border-capta-soft/60 dark:focus:ring-capta-soft/12 disabled:opacity-50"
        />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function readDomainSlugCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const entry = document.cookie.split('; ').find(c => c.startsWith('tenant_domain_slug='));
  if (!entry) return null;
  const value = entry.split('=')[1];
  return value && value !== '__unknown__' ? decodeURIComponent(value) : null;
}

export default function LoginPage() {
  const router = useRouter();

  // Paso 1: credenciales
  const [serverError,  setServerError]  = useState<string | null>(null);
  const [domainMode,   setDomainMode]   = useState(false);

  // Paso 2: MFA
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallenge | null>(null);
  const [otpCode,      setOtpCode]      = useState('');
  const [useBackup,    setUseBackup]    = useState(false);
  const [backupCode,   setBackupCode]   = useState('');
  const [mfaLoading,   setMfaLoading]   = useState(false);
  const [mfaError,     setMfaError]     = useState<string | null>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const watchedSlug = watch('tenantSlug', '');

  // Pre-llenar slug si el usuario llega desde un dominio personalizado del tenant
  useEffect(() => {
    const slug = readDomainSlugCookie();
    if (slug) {
      setValue('tenantSlug', slug);
      setDomainMode(true);
    }
  }, [setValue]);
  const { branding } = useTenantBranding(watchedSlug);

  // Aplicar favicon y theme-color mientras el usuario tipea su slug; restaurar al desmontar
  useEffect(() => {
    applyTenantHead({
      primaryColor: branding?.primaryColor ?? null,
      logoUrl:      branding?.logoUrl      ?? null,
      appName:      branding?.appName      ?? null,
      name:         branding?.name         ?? null,
    });
    return () => { resetTenantHead(); };
  }, [branding]);

  const asideGradient = branding?.primaryColor
    ? `linear-gradient(155deg, #0A1419 0%, ${branding.primaryColor} 55%, color-mix(in srgb, ${branding.primaryColor} 75%, white) 100%)`
    : 'linear-gradient(155deg, #0A1419 0%, #1E4F7A 55%, #2D6FA0 100%)';

  // ── Paso 1: login con credenciales ────────────────────────────────────────

  const persistSession = (data: AuthResponse) => {
    setAccessToken(data.accessToken);
    localStorage.setItem('tenant_slug', data.user.tenantSlug);
    localStorage.setItem('user',        JSON.stringify(data.user));
    router.push('/dashboard');
  };

  const onSubmit = async (data: LoginForm) => {
    setServerError(null);
    try {
      const res = await api.post<AuthResponse | MfaChallenge>('/auth/login', data);
      const body = res.data;

      if ('mfaPending' in body && body.mfaPending) {
        setMfaChallenge(body as MfaChallenge);
      } else {
        persistSession(body as AuthResponse);
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setServerError(message ?? 'Credenciales inválidas. Verifica tus datos.');
    }
  };

  // ── Paso 2: verificar código TOTP ─────────────────────────────────────────

  const submitMfa = async () => {
    if (!mfaChallenge) return;
    const code = useBackup ? backupCode.trim() : otpCode;
    if (!code || code.length < 6) return;

    setMfaLoading(true);
    setMfaError(null);
    try {
      const res = await api.post<AuthResponse>('/auth/mfa/verify', {
        mfaToken: mfaChallenge.mfaToken,
        code,
      });
      persistSession(res.data);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMfaError(message ?? 'Código incorrecto. Inténtalo de nuevo.');
      setOtpCode('');
      setBackupCode('');
    } finally {
      setMfaLoading(false);
    }
  };

  // Auto-submit al completar los 6 dígitos
  const handleOtpChange = (v: string) => {
    setOtpCode(v);
    setMfaError(null);
    if (v.length === 6) {
      setTimeout(() => submitMfa(), 50); // pequeño delay para que el estado se actualice
    }
  };

  return (
    <div className="flex min-h-screen">

      {/* ── Panel izquierdo (branding) ── */}
      <aside
        className="relative hidden lg:flex lg:w-[44%] flex-col justify-between overflow-hidden p-12 transition-[background] duration-700"
        style={{ background: asideGradient }}
      >
        {/* Decorative grid */}
        <div aria-hidden className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(#FFFFFF06 1px, transparent 1px), linear-gradient(90deg, #FFFFFF06 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full opacity-20 blur-3xl"
          style={{ background: '#8FC4E8' }} />

        <div className="relative">
          <Link href="/" className="inline-block">
            {branding?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt={branding.name}
                className="h-9 max-w-[180px] object-contain brightness-0 invert"
              />
            ) : (
              <CaptaLogo markSize={36} showText forceDark />
            )}
          </Link>
        </div>

        <div className="relative space-y-5">
          <div className="h-px w-10"
            style={{ background: 'linear-gradient(90deg, #8FC4E8, transparent)' }} />
          <blockquote className="text-2xl font-semibold leading-snug text-white/90">
            "El talento de tu equipo es tu mayor ventaja competitiva."
          </blockquote>
          <p className="text-sm font-medium text-white/35">
            Capacita, mide y certifica desde una sola plataforma.
          </p>
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

        <div className="relative grid grid-cols-4 gap-2 opacity-15">
          {['#8FC4E8', '#7FD1AE', '#1E4F7A', '#DCE9F4', '#2D6FA0', '#8FC4E8', '#7FD1AE', '#1E4F7A'].map((c, i) => (
            <div key={i} className="h-8 rounded-lg border"
              style={{ borderColor: `${c}40`, background: `${c}18` }} />
          ))}
        </div>
      </aside>

      {/* ── Panel derecho ── */}
      <main className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">

        <div className="mb-10 lg:hidden">
          <Link href="/">
            {branding?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt={branding.name}
                className="h-8 max-w-[160px] object-contain"
              />
            ) : (
              <CaptaLogo markSize={32} showText />
            )}
          </Link>
        </div>

        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">

            {/* ── Paso 1: Credenciales ── */}
            {!mfaChallenge && (
              <motion.div
                key="credentials"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              >
                <div className="mb-8">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Bienvenido de nuevo
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Ingresa los datos de tu empresa para continuar.
                  </p>
                </div>

                {serverError && (
                  <div className="mb-5 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
                    <Icon name="alert-circle" size={16} className="flex-shrink-0 mt-0.5 text-destructive" />
                    <p className="text-sm font-medium text-destructive">{serverError}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
                  {domainMode ? (
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-foreground">Identificador de empresa</label>
                      <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/50 px-4 py-3">
                        <Icon name="building" size={14} className="flex-shrink-0 text-muted-foreground/60" />
                        <span className="flex-1 text-sm font-medium text-foreground">{watchedSlug}</span>
                        <span className="rounded-md bg-capta-tint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-capta-deep dark:bg-white/10 dark:text-capta-soft">
                          Dominio
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground/60">Detectado automáticamente desde tu dominio.</p>
                      <input type="hidden" {...register('tenantSlug')} />
                    </div>
                  ) : (
                    <InputField
                      label="Identificador de empresa"
                      hint="El slug de tu empresa (ej: acme-corp)"
                      placeholder="acme-corp"
                      autoComplete="organization"
                      error={errors.tenantSlug?.message}
                      {...register('tenantSlug')}
                    />
                  )}
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
              </motion.div>
            )}

            {/* ── Paso 2: Código 2FA ── */}
            {mfaChallenge && (
              <motion.div
                key="mfa"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                className="space-y-6"
              >
                {/* Header */}
                <div className="text-center space-y-2">
                  <div
                    className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ background: 'linear-gradient(135deg, #DCE9F4, #8FC4E830)' }}
                  >
                    <Icon name="shield" size={24} style={{ color: '#1E4F7A' }} />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Verificación en dos pasos
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {useBackup
                      ? 'Ingresa uno de tus códigos de respaldo.'
                      : 'Ingresa el código de 6 dígitos de tu aplicación de autenticación.'}
                  </p>
                </div>

                {/* Error */}
                {mfaError && (
                  <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
                    <Icon name="alert-circle" size={16} className="flex-shrink-0 mt-0.5 text-destructive" />
                    <p className="text-sm font-medium text-destructive">{mfaError}</p>
                  </div>
                )}

                <AnimatePresence mode="wait">
                  {!useBackup ? (
                    <motion.div
                      key="totp"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="space-y-4"
                    >
                      <OtpInput
                        value={otpCode}
                        onChange={handleOtpChange}
                        disabled={mfaLoading}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="backup"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="space-y-3"
                    >
                      <label className="block text-sm font-medium text-foreground text-center">
                        Código de respaldo
                      </label>
                      <input
                        type="text"
                        value={backupCode}
                        onChange={e => { setBackupCode(e.target.value); setMfaError(null); }}
                        placeholder="xxxxxxxx"
                        maxLength={8}
                        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-center text-sm font-mono text-foreground tracking-widest outline-none focus:border-capta-deep/60 focus:ring-2 focus:ring-capta-deep/12"
                        autoFocus
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Verify button */}
                <button
                  onClick={submitMfa}
                  disabled={mfaLoading || (useBackup ? backupCode.length < 6 : otpCode.length < 6)}
                  className="w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)',
                    boxShadow: '0 4px 20px rgba(30,79,122,0.30)',
                  }}
                >
                  {mfaLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Icon name="refresh" size={16} className="animate-spin" />
                      Verificando…
                    </span>
                  ) : 'Verificar'}
                </button>

                {/* Acciones secundarias */}
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => { setMfaChallenge(null); setMfaError(null); setOtpCode(''); setBackupCode(''); setUseBackup(false); }}
                    className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <Icon name="arrow-left" size={12} />
                    Volver al inicio
                  </button>
                  <button
                    type="button"
                    onClick={() => { setUseBackup(s => !s); setMfaError(null); setOtpCode(''); setBackupCode(''); }}
                    className="font-medium text-capta-deep/70 hover:text-capta-deep dark:text-capta-soft/70 dark:hover:text-capta-soft transition-colors"
                  >
                    {useBackup ? 'Usar código del autenticador' : 'Usar código de respaldo'}
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
