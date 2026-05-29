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
    // Resetear el input para que el mismo archivo pueda seleccionarse de nuevo
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
        className="relative h-24 w-24 rounded-full overflow-hidden ring-4 ring-border transition-all hover:ring-capta-deep/30 dark:hover:ring-capta-soft/30"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-2xl font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' }}
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
              className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50"
            >
              {uploading
                ? <Icon name="refresh" size={20} className="text-white animate-spin" />
                : <>
                    <Icon name="upload" size={16} className="text-white" />
                    <span className="text-[10px] font-semibold text-white">Cambiar</span>
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmRemove(true)}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
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
            className="flex items-center gap-2 text-xs"
          >
            <span className="text-muted-foreground">¿Quitar foto?</span>
            <button
              type="button"
              onClick={() => { onUploaded(''); setConfirmRemove(false); }}
              className="font-semibold text-destructive hover:underline"
            >
              Sí
            </button>
            <span className="text-muted-foreground/30">·</span>
            <button
              type="button"
              onClick={() => setConfirmRemove(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              No
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sección card ─────────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden"
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 4px 16px rgba(11,31,42,0.04)' }}>
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
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
  const [showPwd, setShowPwd] = useState(false);

  // Info form
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Password form
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd,     setNewPwd]     = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
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
      // Actualizar localStorage para el layout
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
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
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
    if (pwd.length >= 8)               score++;
    if (/[A-Z]/.test(pwd))             score++;
    if (/[a-z]/.test(pwd))             score++;
    if (/\d/.test(pwd))                score++;
    if (/[^A-Za-z0-9]/.test(pwd))     score++;
    if (score <= 2) return { score, label: 'Débil',   color: '#DC2626' };
    if (score === 3) return { score, label: 'Regular', color: '#D97706' };
    if (score === 4) return { score, label: 'Buena',   color: '#059669' };
    return { score, label: 'Fuerte', color: '#1E4F7A' };
  };

  const strength = pwdStrength(newPwd);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl space-y-6">
        <div className="rounded-2xl border border-border bg-card p-8 flex flex-col items-center gap-4 animate-pulse">
          <div className="h-24 w-24 rounded-full bg-muted" />
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-3 w-24 bg-muted rounded" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-muted rounded-xl" />)}
        </div>
      </div>
    );
  }

  const roleColor = profile ? (ROLE_COLORS[profile.role] ?? '#6B7280') : '#6B7280';

  return (
    <div className="p-6 lg:p-8 max-w-2xl space-y-6">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Mi perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gestiona tu información personal y credenciales.</p>
      </motion.div>

      {/* Avatar + info card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.05 }}
      >
        <Card title="Información personal">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">

            {/* Avatar */}
            <AvatarUpload
              avatarUrl={avatarUrl || null}
              initials={initials}
              onUploaded={setAvatarUrl}
            />

            {/* Fields */}
            <div className="flex-1 w-full space-y-4">
              {/* Role badge */}
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white"
                  style={{ background: roleColor }}
                >
                  <Icon name="shield" size={11} />
                  {ROLE_LABELS[profile?.role ?? ''] ?? profile?.role}
                </span>
                {profile?.lastLoginAt && (
                  <span className="text-xs text-muted-foreground">
                    Último acceso: {new Date(profile.lastLoginAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>

              {/* Name fields */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nombre</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    maxLength={100}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-capta-deep/20 dark:focus:ring-capta-soft/20 transition-shadow"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Apellido</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    maxLength={100}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-capta-deep/20 dark:focus:ring-capta-soft/20 transition-shadow"
                  />
                </div>
              </div>

              {/* Email (readonly) */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Correo electrónico
                  <span className="normal-case font-normal text-muted-foreground/50">(no editable)</span>
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2.5">
                  <Icon name="mail" size={14} className="text-muted-foreground/50 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{profile?.email}</span>
                </div>
              </div>

              {/* Save */}
              <div className="flex justify-end pt-1">
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile || !profileDirty}
                  className="flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-md active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)', boxShadow: profileDirty ? '0 2px 8px rgba(30,79,122,0.25)' : 'none' }}
                >
                  {savingProfile
                    ? <><Icon name="refresh" size={13} className="animate-spin" /> Guardando…</>
                    : <><Icon name="save" size={13} /> Guardar</>
                  }
                </button>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Password card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.1 }}
      >
        <div className="rounded-2xl border border-border bg-card overflow-hidden"
          style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 4px 16px rgba(11,31,42,0.04)' }}>

          {/* Header toggle */}
          <button
            type="button"
            onClick={() => setShowPwd(s => !s)}
            className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                <Icon name="shield" size={14} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Seguridad</p>
                <p className="text-xs text-muted-foreground">Cambia tu contraseña de acceso</p>
              </div>
            </div>
            <Icon
              name="chevron-down"
              size={16}
              className={`text-muted-foreground transition-transform duration-200 ${showPwd ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Expandable form */}
          <AnimatePresence>
            {showPwd && (
              <motion.div
                key="pwd-form"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 32 }}
                className="overflow-hidden"
              >
                <div className="border-t border-border px-6 pb-6 pt-4 space-y-4">
                  {/* Current password */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Contraseña actual
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPwd ? 'text' : 'password'}
                        value={currentPwd}
                        onChange={e => setCurrentPwd(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-capta-deep/20 dark:focus:ring-capta-soft/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPwd(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
                      >
                        <Icon name={showCurrentPwd ? 'eye' : 'eye-off'} size={14} />
                      </button>
                    </div>
                  </div>

                  {/* New password */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Nueva contraseña
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPwd ? 'text' : 'password'}
                        value={newPwd}
                        onChange={e => setNewPwd(e.target.value)}
                        placeholder="Mín. 8 chars, mayúscula, minúscula y número"
                        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-capta-deep/20 dark:focus:ring-capta-soft/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPwd(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
                      >
                        <Icon name={showNewPwd ? 'eye' : 'eye-off'} size={14} />
                      </button>
                    </div>

                    {/* Password strength */}
                    {newPwd && (
                      <div className="mt-2 space-y-1">
                        <div className="flex gap-1">
                          {[...Array(5)].map((_, i) => (
                            <div
                              key={i}
                              className="h-1 flex-1 rounded-full transition-all"
                              style={{ background: i < strength.score ? strength.color : '#e5e7eb' }}
                            />
                          ))}
                        </div>
                        <p className="text-xs" style={{ color: strength.color }}>{strength.label}</p>
                      </div>
                    )}
                  </div>

                  {/* Confirm */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Confirmar contraseña
                    </label>
                    <input
                      type="password"
                      value={confirmPwd}
                      onChange={e => setConfirmPwd(e.target.value)}
                      placeholder="Repite la nueva contraseña"
                      className={`w-full rounded-xl border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-capta-deep/20 dark:focus:ring-capta-soft/20 transition-shadow ${
                        confirmPwd && confirmPwd !== newPwd
                          ? 'border-red-300 dark:border-red-700'
                          : 'border-border'
                      }`}
                    />
                    {confirmPwd && confirmPwd !== newPwd && (
                      <p className="mt-1 text-xs text-red-500">Las contraseñas no coinciden</p>
                    )}
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleChangePassword}
                      disabled={savingPwd || !currentPwd || !newPwd || newPwd !== confirmPwd}
                      className="flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-md active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                      style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)', boxShadow: '0 2px 8px rgba(30,79,122,0.2)' }}
                    >
                      {savingPwd
                        ? <><Icon name="refresh" size={13} className="animate-spin" /> Guardando…</>
                        : <><Icon name="shield" size={13} /> Actualizar contraseña</>
                      }
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

    </div>
  );
}
