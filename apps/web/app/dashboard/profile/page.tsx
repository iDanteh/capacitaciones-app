'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/capta-icon';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  mfaEnabled: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER:       'Propietario',
  ADMIN:       'Administrador',
  MANAGER:     'Manager',
  EMPLOYEE:    'Empleado',
  SUPER_ADMIN: 'Super Admin',
};

const ROLE_COLORS: Record<string, string> = {
  OWNER:    '#1E4F7A',
  ADMIN:    '#7C3AED',
  MANAGER:  '#059669',
  EMPLOYEE: '#D97706',
};

// ─── Avatar upload ─────────────────────────────────────────────────────────────

function AvatarUpload({ avatarUrl, initials, onUploaded }: {
  avatarUrl: string | null;
  initials: string;
  onUploaded: (url: string) => void;
}) {
  const [uploading,     setUploading]     = useState(false);
  const [hover,         setHover]         = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (inputRef.current) inputRef.current.value = '';
    setUploading(true);
    try {
      const { data: presigned } = await api.post<{ uploadUrl: string; publicUrl: string }>('/storage/presigned-upload', {
        fileName:    file.name,
        folder:      'avatars',
        contentType: file.type,
        isPublic:    true,
      });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);
      try {
        const res = await fetch(presigned.uploadUrl, {
          method:  'PUT',
          body:    file,
          headers: { 'Content-Type': file.type },
          signal:  controller.signal,
        });
        if (!res.ok) throw new Error(`Error al subir (${res.status})`);
      } finally {
        clearTimeout(timeout);
      }
      onUploaded(presigned.publicUrl);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => !uploading && inputRef.current?.click()}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="relative h-[88px] w-[88px] rounded-full overflow-hidden transition-transform duration-200 hover:scale-[1.04] active:scale-[0.97]"
        style={{ boxShadow: '0 0 0 3px rgba(255,255,255,0.9), 0 4px 20px rgba(30,79,122,0.22), 0 0 0 4px rgba(30,79,122,0.10)' }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-2xl font-bold tracking-tight text-white select-none"
            style={{ background: 'linear-gradient(145deg, #1E4F7A 0%, #2D6FA0 60%, #8FC4E8 100%)' }}
          >
            {initials}
          </div>
        )}
        <AnimatePresence>
          {(hover || uploading) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-1"
              style={{ background: 'rgba(0,0,0,0.44)', backdropFilter: 'blur(2px)' }}
            >
              {uploading
                ? <Icon name="refresh" size={20} className="text-white animate-spin" />
                : <>
                    <Icon name="camera" size={16} className="text-white" />
                    <span className="text-[9px] font-semibold tracking-wider text-white/90 uppercase">Cambiar</span>
                  </>
              }
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      <AnimatePresence mode="wait">
        {avatarUrl && !confirmRemove && (
          <motion.button
            key="remove-btn"
            type="button"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            onClick={() => setConfirmRemove(true)}
            className="text-[11px] font-medium text-muted-foreground/50 hover:text-destructive transition-colors"
          >
            Quitar foto
          </motion.button>
        )}
        {confirmRemove && (
          <motion.div
            key="remove-confirm"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-1.5 text-xs"
          >
            <span className="text-muted-foreground/60">¿Quitar?</span>
            <button type="button" onClick={() => { onUploaded(''); setConfirmRemove(false); }}
              className="font-semibold text-destructive hover:underline">Sí</button>
            <span className="text-muted-foreground/30">·</span>
            <button type="button" onClick={() => setConfirmRemove(false)}
              className="text-muted-foreground/60 hover:text-foreground">No</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Bento cell ────────────────────────────────────────────────────────────────

function BentoCell({
  children,
  className = '',
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-2xl border border-border/70 bg-card overflow-hidden ${className}`}
      style={{
        boxShadow: '0 1px 0 rgba(255,255,255,0.7) inset, 0 2px 20px rgba(11,31,42,0.05)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [profile,  setProfile]  = useState<UserProfile | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPwd,     setSavingPwd]     = useState(false);
  const [showPwd,       setShowPwd]       = useState(false);

  // MFA state
  const [mfaEnabled,     setMfaEnabled]     = useState(false);
  const [mfaStep,        setMfaStep]        = useState<'idle' | 'setup' | 'confirm' | 'backup' | 'disable'>('idle');
  const [mfaLoading,     setMfaLoading]     = useState(false);
  const [mfaError,       setMfaError]       = useState('');
  const [mfaQr,          setMfaQr]          = useState('');
  const [mfaSecret,      setMfaSecret]      = useState('');
  const [mfaCode,        setMfaCode]        = useState('');
  const [mfaBackupCodes, setMfaBackupCodes] = useState<string[]>([]);
  const [copiedCodes,    setCopiedCodes]    = useState(false);

  // Info form
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Password form
  const [currentPwd,    setCurrentPwd]    = useState('');
  const [newPwd,        setNewPwd]        = useState('');
  const [confirmPwd,    setConfirmPwd]    = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd,     setShowNewPwd]     = useState(false);

  const profileDirty = profile
    ? firstName !== profile.firstName
      || lastName  !== profile.lastName
      || avatarUrl !== (profile.avatarUrl ?? '')
    : false;

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?';

  useEffect(() => {
    api.get<UserProfile>('/users/me')
      .then(r => {
        const d = r.data;
        setProfile(d);
        setFirstName(d.firstName);
        setLastName(d.lastName);
        setAvatarUrl(d.avatarUrl ?? '');
        setMfaEnabled(d.mfaEnabled);
      })
      .catch(() => toastError('No se pudo cargar el perfil'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveProfile = async () => {
    if (!profileDirty) return;
    setSavingProfile(true);
    try {
      const { data } = await api.patch<UserProfile>('/users/me', {
        firstName: firstName.trim() || undefined,
        lastName:  lastName.trim()  || undefined,
        avatarUrl: avatarUrl || undefined,
      });
      setProfile(data);
      const stored = localStorage.getItem('user');
      if (stored) {
        try {
          const u = JSON.parse(stored);
          u.firstName = data.firstName;
          u.lastName  = data.lastName;
          localStorage.setItem('user', JSON.stringify(u));
        } catch { /* skip */ }
      }
      toastSuccess('Perfil actualizado');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Error al guardar';
      toastError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd) return;
    if (newPwd !== confirmPwd) { toastError('Las contraseñas no coinciden'); return; }
    if (newPwd === currentPwd) { toastError('La nueva contraseña debe ser diferente a la actual'); return; }
    setSavingPwd(true);
    try {
      await api.post('/users/me/change-password', { currentPassword: currentPwd, newPassword: newPwd });
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      setShowPwd(false);
      toastSuccess('Contraseña actualizada. Se cerró la sesión en otros dispositivos.');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Error al cambiar contraseña';
      toastError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSavingPwd(false);
    }
  };

  const pwdStrength = (pwd: string): { score: number; label: string; color: string } => {
    if (!pwd) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 8)           score++;
    if (/[A-Z]/.test(pwd))         score++;
    if (/[a-z]/.test(pwd))         score++;
    if (/\d/.test(pwd))            score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 2) return { score, label: 'Débil',   color: '#DC2626' };
    if (score === 3) return { score, label: 'Regular', color: '#D97706' };
    if (score === 4) return { score, label: 'Buena',   color: '#059669' };
    return { score, label: 'Fuerte', color: '#1E4F7A' };
  };

  const strength = pwdStrength(newPwd);

  const handleMfaSetup = async () => {
    setMfaLoading(true); setMfaError('');
    try {
      const { data } = await api.post<{ secret: string; qrCodeDataUrl: string }>('/auth/mfa/setup');
      setMfaQr(data.qrCodeDataUrl); setMfaSecret(data.secret); setMfaCode('');
      setMfaStep('setup');
    } catch (err: any) {
      toastError(err?.response?.data?.message ?? 'Error al iniciar configuración 2FA');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaConfirm = async () => {
    if (mfaCode.length !== 6) return;
    setMfaLoading(true); setMfaError('');
    try {
      const { data } = await api.post<{ backupCodes: string[] }>('/auth/mfa/confirm', { code: mfaCode });
      setMfaBackupCodes(data.backupCodes); setMfaEnabled(true); setMfaStep('backup');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Código inválido';
      setMfaError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaDisable = async () => {
    if (mfaCode.length < 6) return;
    setMfaLoading(true); setMfaError('');
    try {
      await api.delete('/auth/mfa', { data: { code: mfaCode } });
      setMfaEnabled(false); setMfaStep('idle'); setMfaCode('');
      toastSuccess('Verificación en dos pasos desactivada');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Código incorrecto';
      setMfaError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setMfaLoading(false);
    }
  };

  const downloadBackupCodes = () => {
    const text = `Códigos de respaldo Capta LMS\nGuárdalos en un lugar seguro. Cada código solo puede usarse una vez.\n\n${mfaBackupCodes.join('\n')}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'capta-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-5 lg:p-7">
        <div className="max-w-4xl animate-pulse space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center gap-3 lg:col-span-1">
              <div className="h-[88px] w-[88px] rounded-full bg-muted" />
              <div className="h-4 w-28 rounded-full bg-muted" />
              <div className="h-3 w-20 rounded-full bg-muted" />
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 lg:col-span-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-10 rounded-xl bg-muted" />)}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card h-16" />
            <div className="rounded-2xl border border-border bg-card h-16" />
          </div>
        </div>
      </div>
    );
  }

  const roleColor = profile ? (ROLE_COLORS[profile.role] ?? '#6B7280') : '#6B7280';

  return (
    <div className="p-5 lg:p-7">
      <div className="max-w-4xl space-y-4">

        {/* ── Row 1: Identity card + Personal info ─────────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* Cell A — Identity (bento: tall, narrow) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          >
            <BentoCell className="flex flex-col items-center justify-center gap-4 p-6 h-full min-h-[220px] relative overflow-hidden">
              {/* Background gradient blob */}
              <div
                aria-hidden
                className="pointer-events-none absolute -top-10 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full opacity-[0.08] blur-2xl"
                style={{ background: `radial-gradient(circle, ${roleColor}, #8FC4E8)` }}
              />

              <AvatarUpload
                avatarUrl={avatarUrl || null}
                initials={initials}
                onUploaded={setAvatarUrl}
              />

              <div className="relative text-center space-y-2">
                <p className="text-base font-semibold tracking-tight text-foreground leading-tight">
                  {firstName || '—'} {lastName}
                </p>
                <p className="text-xs text-muted-foreground truncate max-w-[160px]">{profile?.email}</p>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
                  style={{ background: roleColor, boxShadow: `0 2px 8px ${roleColor}55` }}
                >
                  <Icon name="shield" size={9} />
                  {ROLE_LABELS[profile?.role ?? ''] ?? profile?.role}
                </span>
              </div>

              {profile?.lastLoginAt && (
                <div className="relative flex items-center gap-1.5 text-[11px] text-muted-foreground/50">
                  <Icon name="clock" size={11} />
                  {new Date(profile.lastLoginAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}
            </BentoCell>
          </motion.div>

          {/* Cell B — Personal info form (bento: wide) */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26, delay: 0.05 }}
          >
            <BentoCell className="h-full">
              <div className="border-b border-border/60 px-5 py-3.5 flex items-center gap-2">
                <Icon name="user" size={13} className="text-muted-foreground/60" />
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  Información personal
                </p>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      maxLength={100}
                      placeholder="Tu nombre"
                      className="w-full rounded-xl border border-border/70 bg-background/60 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-capta-deep/15 dark:focus:ring-capta-soft/15 transition-shadow"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                      Apellido
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      maxLength={100}
                      placeholder="Tu apellido"
                      className="w-full rounded-xl border border-border/70 bg-background/60 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-capta-deep/15 dark:focus:ring-capta-soft/15 transition-shadow"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                    Correo electrónico
                  </label>
                  <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/30 px-4 py-2.5">
                    <Icon name="mail" size={13} className="text-muted-foreground/40 flex-shrink-0" />
                    <span className="flex-1 text-sm text-muted-foreground">{profile?.email}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground/50">
                      No editable
                    </span>
                  </div>
                </div>

                {/* Save — appears only when dirty */}
                <div className="flex justify-end pt-1">
                  <AnimatePresence>
                    {profileDirty && (
                      <motion.button
                        key="save-btn"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                        onClick={handleSaveProfile}
                        disabled={savingProfile}
                        className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        style={{
                          background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)',
                          boxShadow: '0 4px 16px rgba(30,79,122,0.30)',
                        }}
                      >
                        {savingProfile
                          ? <><Icon name="refresh" size={13} className="animate-spin" /> Guardando…</>
                          : <><Icon name="check" size={13} /> Guardar cambios</>
                        }
                      </motion.button>
                    )}
                  </AnimatePresence>
                  {!profileDirty && (
                    <span className="text-xs text-muted-foreground/40 py-2.5">Sin cambios</span>
                  )}
                </div>
              </div>
            </BentoCell>
          </motion.div>
        </div>

        {/* ── Row 2: Security + 2FA (bento: equal cols) ────────────────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          {/* Cell C — Security / Password */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26, delay: 0.10 }}
          >
            <BentoCell>
              {/* Header */}
              <button
                type="button"
                onClick={() => setShowPwd(s => !s)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
              >
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ background: 'linear-gradient(135deg, #1E4F7A1A, #1E4F7A0A)' }}
                >
                  <Icon name="lock" size={13} className="text-capta-deep dark:text-capta-tint" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Contraseña</p>
                  <p className="text-xs text-muted-foreground">Actualiza tus credenciales</p>
                </div>
                <motion.div
                  animate={{ rotate: showPwd ? 180 : 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                >
                  <Icon name="chevron-down" size={14} className="text-muted-foreground/40" />
                </motion.div>
              </button>

              <AnimatePresence>
                {showPwd && (
                  <motion.div
                    key="pwd-form"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 30 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border/60 px-5 pt-4 pb-5 space-y-3">
                      {/* Current */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                          Contraseña actual
                        </label>
                        <div className="relative">
                          <input
                            type={showCurrentPwd ? 'text' : 'password'}
                            value={currentPwd}
                            onChange={e => setCurrentPwd(e.target.value)}
                            placeholder="••••••••"
                            className="w-full rounded-xl border border-border/70 bg-background/60 px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-capta-deep/15 dark:focus:ring-capta-soft/15"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPwd(s => !s)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                          >
                            <Icon name={showCurrentPwd ? 'eye' : 'eye-off'} size={13} />
                          </button>
                        </div>
                      </div>

                      {/* New */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                          Nueva contraseña
                        </label>
                        <div className="relative">
                          <input
                            type={showNewPwd ? 'text' : 'password'}
                            value={newPwd}
                            onChange={e => setNewPwd(e.target.value)}
                            placeholder="Mín. 8 chars…"
                            className="w-full rounded-xl border border-border/70 bg-background/60 px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-capta-deep/15 dark:focus:ring-capta-soft/15"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPwd(s => !s)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                          >
                            <Icon name={showNewPwd ? 'eye' : 'eye-off'} size={13} />
                          </button>
                        </div>
                        {newPwd && (
                          <div className="flex items-center gap-2 pt-1">
                            <div className="flex flex-1 gap-1">
                              {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                                  style={{ background: i < strength.score ? strength.color : 'var(--border)' }} />
                              ))}
                            </div>
                            <span className="text-[10px] font-semibold" style={{ color: strength.color }}>{strength.label}</span>
                          </div>
                        )}
                      </div>

                      {/* Confirm */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                          Confirmar
                        </label>
                        <input
                          type="password"
                          value={confirmPwd}
                          onChange={e => setConfirmPwd(e.target.value)}
                          placeholder="Repite la contraseña"
                          className={`w-full rounded-xl border bg-background/60 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 transition-shadow ${
                            confirmPwd && confirmPwd !== newPwd
                              ? 'border-red-300 dark:border-red-700 focus:ring-red-500/15'
                              : 'border-border/70 focus:ring-capta-deep/15 dark:focus:ring-capta-soft/15'
                          }`}
                        />
                        {confirmPwd && confirmPwd !== newPwd && (
                          <p className="text-[10px] text-red-500">No coinciden</p>
                        )}
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          onClick={handleChangePassword}
                          disabled={savingPwd || !currentPwd || !newPwd || newPwd !== confirmPwd}
                          className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-md active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                          style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)', boxShadow: '0 2px 10px rgba(30,79,122,0.25)' }}
                        >
                          {savingPwd
                            ? <><Icon name="refresh" size={12} className="animate-spin" /> Actualizando…</>
                            : <><Icon name="lock" size={12} /> Actualizar</>
                          }
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </BentoCell>
          </motion.div>

          {/* Cell D — 2FA */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26, delay: 0.15 }}
          >
            <BentoCell>
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4">
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: mfaEnabled
                      ? 'linear-gradient(135deg, #05966920, #05966908)'
                      : 'linear-gradient(135deg, #6B728018, #6B728008)',
                  }}
                >
                  <Icon name="shield" size={13}
                    className={mfaEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Verificación 2FA</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {mfaEnabled ? 'Cuenta protegida con TOTP' : 'Sin verificación adicional'}
                  </p>
                </div>
                <span className={`flex-shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                  mfaEnabled
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground/60'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${mfaEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                  {mfaEnabled ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              {/* Idle CTA */}
              {mfaStep === 'idle' && (
                <div className="border-t border-border/60 px-5 py-3.5">
                  {mfaEnabled ? (
                    <button
                      onClick={() => { setMfaStep('disable'); setMfaCode(''); setMfaError(''); }}
                      className="text-xs font-medium text-muted-foreground/60 hover:text-destructive transition-colors"
                    >
                      Desactivar verificación en dos pasos
                    </button>
                  ) : (
                    <button
                      onClick={handleMfaSetup}
                      disabled={mfaLoading}
                      className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-md disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' }}
                    >
                      {mfaLoading
                        ? <Icon name="refresh" size={12} className="animate-spin" />
                        : <Icon name="plus" size={12} />
                      }
                      Activar verificación
                    </button>
                  )}
                </div>
              )}

              {/* Expandable flows */}
              <AnimatePresence>
                {mfaStep !== 'idle' && (
                  <motion.div
                    key="mfa-content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 30 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border/60 px-5 pt-4 pb-5 space-y-4">
                      <AnimatePresence mode="wait">

                        {mfaStep === 'setup' && (
                          <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                            <p className="text-xs text-muted-foreground">
                              Escanea con Google Authenticator, Authy o 1Password.
                            </p>
                            <div className="flex justify-center">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={mfaQr} alt="QR 2FA" className="h-36 w-36 rounded-xl border border-border p-1.5 bg-white" />
                            </div>
                            <details className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
                              <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground/60 select-none">
                                Ingresar código manual
                              </summary>
                              <p className="mt-1.5 font-mono text-[10px] break-all text-foreground select-all">{mfaSecret}</p>
                            </details>
                            <input
                              type="text" inputMode="numeric" maxLength={6}
                              value={mfaCode}
                              onChange={e => { setMfaCode(e.target.value.replace(/\D/g, '')); setMfaError(''); }}
                              placeholder="000 000"
                              className="w-full rounded-xl border border-border/70 bg-background/60 px-4 py-2.5 text-center font-mono text-xl tracking-[0.5em] text-foreground focus:outline-none focus:ring-2 focus:ring-capta-deep/15"
                              autoFocus
                            />
                            {mfaError && <p className="text-[11px] text-destructive">{mfaError}</p>}
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => { setMfaStep('idle'); setMfaError(''); }}
                                className="rounded-xl px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                                Cancelar
                              </button>
                              <button
                                onClick={handleMfaConfirm}
                                disabled={mfaLoading || mfaCode.length !== 6}
                                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-40 transition-all hover:scale-[1.02]"
                                style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' }}
                              >
                                {mfaLoading ? <Icon name="refresh" size={12} className="animate-spin" /> : <Icon name="check" size={12} />}
                                Confirmar
                              </button>
                            </div>
                          </motion.div>
                        )}

                        {mfaStep === 'backup' && (
                          <motion.div key="backup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                            <div className="flex items-start gap-2 rounded-xl border border-amber-200/70 bg-amber-50/60 px-3 py-2.5 dark:border-amber-900/40 dark:bg-amber-950/20">
                              <Icon name="alert-triangle" size={13} className="flex-shrink-0 mt-0.5 text-amber-500" />
                              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                                Guarda estos códigos de un solo uso.
                              </p>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              {mfaBackupCodes.map((code, i) => (
                                <div key={i} className="rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2 text-center font-mono text-xs tracking-wider text-foreground">
                                  {code}
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={downloadBackupCodes}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors">
                                <Icon name="download" size={12} /> Descargar
                              </button>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(mfaBackupCodes.join('\n')).then(() => setCopiedCodes(true));
                                  setTimeout(() => setCopiedCodes(false), 2000);
                                }}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors">
                                <Icon name={copiedCodes ? 'check' : 'file'} size={12} />
                                {copiedCodes ? 'Copiado' : 'Copiar'}
                              </button>
                            </div>
                            <button
                              onClick={() => { setMfaStep('idle'); toastSuccess('¡2FA activado exitosamente!'); }}
                              className="w-full rounded-xl py-2 text-xs font-semibold text-white transition-all hover:scale-[1.01]"
                              style={{ background: 'linear-gradient(135deg, #059669, #10B981)' }}
                            >
                              Listo, guardé mis códigos
                            </button>
                          </motion.div>
                        )}

                        {mfaStep === 'disable' && (
                          <motion.div key="disable" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                            <div className="flex items-start gap-2 rounded-xl border border-red-200/60 bg-red-50/40 px-3 py-2.5 dark:border-red-900/30 dark:bg-red-950/20">
                              <Icon name="alert-circle" size={13} className="flex-shrink-0 mt-0.5 text-red-500" />
                              <p className="text-[11px] text-red-600 dark:text-red-400">
                                Esto reducirá la seguridad de tu cuenta.
                              </p>
                            </div>
                            <input
                              type="text" inputMode="numeric" maxLength={8}
                              value={mfaCode}
                              onChange={e => { setMfaCode(e.target.value.replace(/\s/g, '')); setMfaError(''); }}
                              placeholder="Código TOTP o backup"
                              className="w-full rounded-xl border border-border/70 bg-background/60 px-4 py-2.5 text-center font-mono text-xl tracking-widest text-foreground focus:outline-none focus:ring-2 focus:ring-destructive/15"
                              autoFocus
                            />
                            {mfaError && <p className="text-[11px] text-destructive">{mfaError}</p>}
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => { setMfaStep('idle'); setMfaError(''); setMfaCode(''); }}
                                className="rounded-xl px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                                Cancelar
                              </button>
                              <button
                                onClick={handleMfaDisable}
                                disabled={mfaLoading || mfaCode.length < 6}
                                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-40 transition-all hover:scale-[1.02]"
                                style={{ background: 'linear-gradient(135deg, #DC2626, #EF4444)' }}
                              >
                                {mfaLoading ? <Icon name="refresh" size={12} className="animate-spin" /> : <Icon name="shield" size={12} />}
                                Desactivar
                              </button>
                            </div>
                          </motion.div>
                        )}

                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </BentoCell>
          </motion.div>

        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}
