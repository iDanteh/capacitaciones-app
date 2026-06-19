'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/capta-icon';
import { api, setAccessToken } from '@/lib/api';
import { useToast } from '@/components/toast';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Subcompany {
  id:        string;
  name:      string;
  slug:      string;
  isActive:  boolean;
  createdAt: string;
  userCount: number;
}

interface CreateForm {
  name:           string;
  slug:           string;
  ownerEmail:     string;
  ownerFirstName: string;
  ownerLastName:  string;
}

interface AuthSwitchResponse {
  accessToken: string;
  user: {
    id:         string;
    email:      string;
    firstName:  string;
    lastName:   string;
    role:       string;
    tenantId:   string;
    tenantSlug: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar diacríticos
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

// ─── Modal: Crear sub-empresa ─────────────────────────────────────────────────

function CreateSubcompanyModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (c: Subcompany) => void }) {
  const [form,        setForm]        = useState<CreateForm>({
    name: '', slug: '', ownerEmail: '', ownerFirstName: '', ownerLastName: '',
  });
  const [inviteMode,  setInviteMode]  = useState(false); // false = usar mis credenciales
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const handleNameChange = (name: string) => {
    setForm(p => ({ ...p, name, slug: slugify(name) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = inviteMode
        ? form
        : { name: form.name, slug: form.slug }; // sin campos de propietario
      const res = await api.post<Subcompany>('/tenants/children', payload);
      onSuccess(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg[0] : (msg ?? 'No se pudo crear la sub-empresa'));
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-capta-soft/50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Nueva sub-empresa</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Crea una división o filial de tu organización.
            </p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
            <Icon name="close" size={16} />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5">
            <Icon name="alert-circle" size={15} className="mt-0.5 flex-shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Empresa */}
          <div className="space-y-3 rounded-xl border border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Empresa</p>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Nombre</label>
              <input
                required
                placeholder="Ej. División Norte"
                value={form.name}
                onChange={e => handleNameChange(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Slug <span className="text-xs text-muted-foreground">(identificador único, URL-friendly)</span>
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5">
                <span className="text-sm text-muted-foreground/50 flex-shrink-0">empresa.com/</span>
                <input
                  required
                  pattern="^[a-z0-9-]+"
                  minLength={3}
                  maxLength={60}
                  placeholder="division-norte"
                  value={form.slug}
                  onChange={e => setForm(p => ({ ...p, slug: e.target.value }))}
                  className="flex-1 bg-transparent text-sm font-mono text-foreground placeholder:text-muted-foreground/60 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Acceso */}
          <div className="space-y-3 rounded-xl border border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">Propietario</p>

            {/* Toggle */}
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-1">
              {[
                { value: false, label: 'Mis credenciales', icon: 'user' as const },
                { value: true,  label: 'Invitar persona',  icon: 'mail' as const },
              ].map(opt => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setInviteMode(opt.value)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all ${
                    inviteMode === opt.value
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon name={opt.icon} size={12} />
                  {opt.label}
                </button>
              ))}
            </div>

            {/* No-invite mode: info card */}
            {!inviteMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-2.5 rounded-xl border border-capta-soft/20 bg-capta-soft/5 px-3 py-2.5"
              >
                <Icon name="shield" size={14} className="mt-0.5 flex-shrink-0 text-capta-deep/60" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Podrás acceder a esta empresa con tus propias credenciales usando el selector en el panel lateral.
                </p>
              </motion.div>
            )}

            {/* Invite mode: owner fields */}
            <AnimatePresence>
              {inviteMode && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 overflow-hidden"
                >
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-foreground">Email del propietario</label>
                    <input
                      type="email"
                      required={inviteMode}
                      placeholder="owner@division.com"
                      value={form.ownerEmail}
                      onChange={e => setForm(p => ({ ...p, ownerEmail: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { key: 'ownerFirstName', label: 'Nombre',   placeholder: 'María' },
                      { key: 'ownerLastName',  label: 'Apellido', placeholder: 'López' },
                    ] as const).map(f => (
                      <div key={f.key} className="space-y-1.5">
                        <label className="block text-sm font-medium text-foreground">{f.label}</label>
                        <input
                          required={inviteMode}
                          placeholder={f.placeholder}
                          value={form[f.key]}
                          onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                          className={inputCls}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground/60">
                    Se enviará una invitación por email para que registre su cuenta.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)', boxShadow: '0 2px 10px color-mix(in srgb, var(--tenant-primary) 25%, transparent)' }}
            >
              {loading ? <Icon name="refresh" size={15} className="animate-spin" /> : <Icon name="plus" size={15} />}
              {loading ? 'Creando…' : 'Crear empresa'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CompaniesPage() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [companies,      setCompanies]      = useState<Subcompany[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [createModal,    setCreateModal]    = useState(false);
  const [deleteId,       setDeleteId]       = useState<string | null>(null);
  const [deleting,       setDeleting]       = useState(false);
  const [planError,      setPlanError]      = useState<string | null>(null);
  const [switchingId,    setSwitchingId]    = useState<string | null>(null);
  const [isInSubcompany] = useState(() => !!localStorage.getItem('parent_session'));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Subcompany[]>('/tenants/children');
      setCompanies(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if ((err as { response?: { status?: number } })?.response?.status === 403) {
        setPlanError(msg ?? 'Tu plan no incluye sub-empresas.');
      } else {
        toastError('No pudimos cargar las empresas. Intenta recargar la página.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!isInSubcompany) void load(); }, [load, isInSubcompany]);

  const handleCreateSuccess = (company: Subcompany) => {
    setCompanies(prev => [company, ...prev]);
    setCreateModal(false);
    toastSuccess(`Sub-empresa "${company.name}" creada correctamente.`);
  };

  const handleSwitchToCompany = async (company: Subcompany) => {
    if (switchingId) return;
    setSwitchingId(company.id);

    const existingParentSess = localStorage.getItem('parent_session');

    try {
      if (!existingParentSess) {
        localStorage.setItem('parent_session', JSON.stringify({
          user:        localStorage.getItem('user'),
          tenantLogo:  localStorage.getItem('tenant_logo'),
          tenantName:  localStorage.getItem('tenant_name'),
          tenantColor: localStorage.getItem('tenant_color'),
        }));
      }

      const res = await api.post<AuthSwitchResponse>('/auth/switch-tenant', { childTenantId: company.id });
      const { accessToken, user: newUser } = res.data;

      setAccessToken(accessToken);
      localStorage.setItem('user', JSON.stringify(newUser));
      localStorage.removeItem('tenant_logo');
      localStorage.removeItem('tenant_name');
      localStorage.removeItem('tenant_color');

      window.location.replace('/dashboard');
    } catch {
      if (!existingParentSess) localStorage.removeItem('parent_session');
      toastError(`No se pudo acceder a "${company.name}"`);
      setSwitchingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await api.delete(`/tenants/children/${id}`);
      setCompanies(prev => prev.filter(c => c.id !== id));
      toastSuccess('Sub-empresa eliminada correctamente');
    } catch {
      toastError('No se pudo eliminar la sub-empresa');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <div className="min-h-full p-6 lg:p-8">

      {/* ── Encabezado ── */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="mb-8 flex flex-wrap items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Sub-empresas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestiona las empresas filiales o divisiones de tu organización.
          </p>
        </div>

        {!planError && !loading && !isInSubcompany && (
          <button
            onClick={() => setCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)', boxShadow: '0 2px 10px color-mix(in srgb, var(--tenant-primary) 25%, transparent)' }}
          >
            <Icon name="plus" size={16} />
            Nueva sub-empresa
          </button>
        )}
      </motion.div>

      {/* ── Aviso: en sub-empresa ── */}
      {isInSubcompany && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center"
          style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Icon name="building" size={24} className="text-muted-foreground" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Función no disponible</h2>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground leading-relaxed">
            Las sub-empresas no pueden crear empresas adicionales. Esta función solo está disponible desde la empresa principal.
          </p>
        </motion.div>
      )}

      {/* ── Error de plan ── */}
      {!isInSubcompany && planError && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center"
          style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-900/20">
            <Icon name="shield" size={24} className="text-amber-500" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Función no disponible en tu plan</h2>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground leading-relaxed">
            Las sub-empresas están disponibles en los planes <strong>Business</strong> y <strong>Enterprise</strong>.
            Actualiza tu plan para gestionar múltiples divisiones o filiales.
          </p>
          <a
            href="/dashboard/subscription"
            className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)' }}
          >
            <Icon name="credit-card" size={14} />
            Ver planes disponibles
          </a>
        </motion.div>
      )}

      {/* ── Loading ── */}
      {loading && !planError && !isInSubcompany && (
        <div className="flex items-center justify-center py-20">
          <Icon name="refresh" size={24} className="animate-spin text-muted-foreground" />
        </div>
      )}

      {/* ── Contenido principal ── */}
      {!loading && !planError && !isInSubcompany && (
        <>
          {/* Stat rápida */}
          {companies.length > 0 && (
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: 'Sub-empresas activas', value: companies.filter(c => c.isActive).length, icon: 'users' as const,        accent: 'var(--tenant-primary)' },
                { label: 'Total usuarios',        value: companies.reduce((s, c) => s + c.userCount, 0), icon: 'user' as const,   accent: '#7FD1AE' },
                { label: 'Total empresas',        value: companies.length,                            icon: 'chart-bar' as const,  accent: '#8FC4E8' },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30, delay: i * 0.06 }}
                  className="rounded-2xl border border-border bg-card px-4 py-3"
                  style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
                >
                  <Icon name={stat.icon} size={14} className="mb-1.5" style={{ color: stat.accent }} />
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          )}

          {/* Lista */}
          {companies.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <Icon name="users" size={24} className="text-muted-foreground/30" />
              </div>
              <p className="text-sm font-semibold text-foreground">Sin sub-empresas</p>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground leading-relaxed">
                Crea tu primera sub-empresa para gestionar divisiones o filiales de forma independiente.
              </p>
              <button
                onClick={() => setCreateModal(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)' }}
              >
                <Icon name="plus" size={14} />
                Crear primera sub-empresa
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <motion.div
                initial="hidden"
                animate="show"
                variants={{ show: { transition: { staggerChildren: 0.05 } } }}
                className="divide-y divide-border/60"
              >
              {companies.map(company => (
                <motion.div
                  key={company.id}
                  variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className={`relative flex items-center gap-4 overflow-hidden px-5 py-4 transition-colors hover:bg-muted/20 ${!company.isActive ? 'opacity-60' : ''}`}
                >
                  {/* Acento lateral */}
                  <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: '#8FC4E8' }} />
                  {/* Avatar empresa */}
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)' }}
                  >
                    {company.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{company.name}</span>
                      {!company.isActive && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Inactiva</span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono">{company.slug}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Icon name="user" size={10} />
                        {company.userCount} usuario{company.userCount !== 1 ? 's' : ''}
                      </span>
                      <span>·</span>
                      <span>Creada {formatDate(company.createdAt)}</span>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Acceder */}
                    <button
                      onClick={() => void handleSwitchToCompany(company)}
                      disabled={!!switchingId}
                      className="hidden md:flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 transition-colors"
                      title="Acceder a esta empresa con tus credenciales"
                    >
                      {switchingId === company.id
                        ? <Icon name="refresh" size={12} className="animate-spin" />
                        : <Icon name="external" size={12} />}
                      {switchingId === company.id ? 'Accediendo…' : 'Acceder'}
                    </button>

                    {/* Eliminar */}
                    <AnimatePresence mode="wait">
                      {deleteId === company.id ? (
                        <motion.div
                          key="confirm"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-1.5"
                        >
                          <span className="text-xs font-medium text-destructive">¿Eliminar?</span>
                          <button
                            onClick={() => setDeleteId(null)}
                            className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                          >
                            No
                          </button>
                          <button
                            disabled={deleting}
                            onClick={() => handleDelete(company.id)}
                            className="rounded bg-destructive px-2 py-0.5 text-xs font-semibold text-white hover:bg-destructive/90 disabled:opacity-60"
                          >
                            {deleting ? '…' : 'Sí'}
                          </button>
                        </motion.div>
                      ) : (
                        <motion.button
                          key="btn"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          onClick={() => setDeleteId(company.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/40 transition-colors hover:bg-destructive/8 hover:text-destructive"
                          title="Eliminar sub-empresa"
                        >
                          <Icon name="trash" size={14} />
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
              </motion.div>
            </div>
          )}
        </>
      )}

      {/* ── Nota informativa ── */}
      {!planError && !loading && (
        <p className="mt-8 text-xs text-muted-foreground/50 text-center max-w-md mx-auto leading-relaxed">
          Cada sub-empresa tiene su propio conjunto de usuarios, cursos y datos.
          Puedes cambiar de contexto usando el selector de empresa en el panel lateral.
        </p>
      )}

      {/* ── Modals ── */}
      <AnimatePresence>
        {createModal && (
          <CreateSubcompanyModal
            onClose={() => setCreateModal(false)}
            onSuccess={handleCreateSuccess}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
