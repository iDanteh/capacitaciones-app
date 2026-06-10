'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { Icon } from '@/components/capta-icon';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformStats {
  totalTenants:      number;
  activeTenants:     number;
  totalUsers:        number;
  totalCourses:      number;
  totalEnrollments:  number;
  totalCertificates: number;
  byPlan: { planType: string; planName: string; count: number }[];
}

interface TenantSummary {
  id:           string;
  name:         string;
  slug:         string;
  isActive:     boolean;
  createdAt:    string;
  logoUrl:      string | null;
  primaryColor: string | null;
  userCount:    number;
  courseCount:  number;
  childCount:   number;
  subscription: {
    status:           string;
    planName:         string;
    planType:         string;
    currentPeriodEnd: string;
  } | null;
}

interface TenantDetail extends TenantSummary {
  domain:           string | null;
  enrollmentCount:  number;
  certificateCount: number;
  users: {
    id:          string;
    firstName:   string;
    lastName:    string;
    email:       string;
    role:        string;
    isActive:    boolean;
    lastLoginAt: string | null;
    createdAt:   string;
  }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLAN_COLORS: Record<string, string> = {
  FREE:       '#6B7280',
  BUSINESS:   '#1E4F7A',
  ENTERPRISE: '#7C3AED',
};

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  ACTIVE:   { label: 'Activa',    class: 'bg-emerald-500/12 text-emerald-600 border-emerald-500/20' },
  TRIALING: { label: 'Trial',     class: 'bg-blue-500/12 text-blue-600 border-blue-500/20' },
  PAST_DUE: { label: 'Mora',      class: 'bg-amber-500/12 text-amber-600 border-amber-500/20' },
  UNPAID:   { label: 'Impaga',    class: 'bg-red-500/12 text-red-600 border-red-500/20' },
  CANCELED: { label: 'Cancelada', class: 'bg-muted text-muted-foreground border-border' },
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  OWNER:       'Propietario',
  ADMIN:       'Administrador',
  MANAGER:     'Manager',
  EMPLOYEE:    'Empleado',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">{label}</p>
      <p className="mt-1.5 text-3xl font-bold tabular-nums text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground/60">{sub}</p>}
    </div>
  );
}

// ─── Detail drawer ────────────────────────────────────────────────────────────

function TenantDrawer({
  tenantId,
  onClose,
  onStatusChanged,
}: {
  tenantId: string;
  onClose: () => void;
  onStatusChanged: (id: string, isActive: boolean) => void;
}) {
  const [detail, setDetail]   = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get<TenantDetail>(`/super-admin/tenants/${tenantId}`)
      .then(r => setDetail(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tenantId]);

  const handleToggle = async () => {
    if (!detail || acting) return;
    setActing(true);
    const action = detail.isActive ? 'suspend' : 'activate';
    try {
      await api.patch(`/super-admin/tenants/${tenantId}/${action}`);
      const next = !detail.isActive;
      setDetail(d => d ? { ...d, isActive: next } : d);
      onStatusChanged(tenantId, next);
    } catch { /* silencioso */ }
    setActing(false);
  };

  const planColor = detail?.subscription ? PLAN_COLORS[detail.subscription.planType] ?? '#1E4F7A' : '#1E4F7A';

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${planColor}, ${planColor}bb)` }}
          >
            {detail?.name.charAt(0).toUpperCase() ?? '·'}
          </div>
          <div>
            <p className="font-semibold text-foreground">{detail?.name ?? '—'}</p>
            <p className="text-xs text-muted-foreground/60">{detail?.slug ?? ''}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/40 hover:bg-muted hover:text-foreground transition-colors"
        >
          <Icon name="close" size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-6">
        {loading ? (
          <div className="flex justify-center pt-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor: 'var(--tenant-primary)' }} />
          </div>
        ) : !detail ? (
          <p className="text-center text-sm text-muted-foreground">Error cargando datos.</p>
        ) : (
          <>
            {/* Stats mini grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Usuarios',      value: detail.userCount },
                { label: 'Cursos',        value: detail.courseCount },
                { label: 'Inscripciones', value: detail.enrollmentCount },
                { label: 'Certificados',  value: detail.certificateCount },
              ].map(s => (
                <div key={s.label} className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                  <p className="text-xl font-bold tabular-nums text-foreground">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground/60">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Subscription info */}
            {detail.subscription && (
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/40">Suscripción</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{detail.subscription.planName}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[detail.subscription.status]?.class ?? ''}`}>
                    {STATUS_BADGE[detail.subscription.status]?.label ?? detail.subscription.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground/60">
                  Período actual hasta: {fmtDate(detail.subscription.currentPeriodEnd)}
                </p>
              </div>
            )}

            {/* Meta */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground/60">Creado</span>
                <span className="text-foreground">{fmtDate(detail.createdAt)}</span>
              </div>
              {detail.domain && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground/60">Dominio</span>
                  <span className="text-foreground font-mono text-xs">{detail.domain}</span>
                </div>
              )}
              {detail.childCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground/60">Sub-empresas</span>
                  <span className="text-foreground">{detail.childCount}</span>
                </div>
              )}
            </div>

            {/* Users table */}
            {detail.users.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/40">
                  Usuarios ({detail.userCount})
                </p>
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground/50">Nombre</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground/50">Rol</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground/50">Último acceso</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {detail.users.slice(0, 20).map(u => (
                        <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-2">
                            <p className="font-medium text-foreground">{u.firstName} {u.lastName}</p>
                            <p className="text-[11px] text-muted-foreground/60">{u.email}</p>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{ROLE_LABELS[u.role] ?? u.role}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground/60">
                            {u.lastLoginAt ? fmtDateShort(u.lastLoginAt) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer actions */}
      {detail && (
        <div className="flex-shrink-0 border-t border-border p-4">
          <button
            onClick={() => void handleToggle()}
            disabled={acting}
            className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-50 ${
              detail.isActive
                ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20 hover:bg-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20'
            }`}
          >
            {acting ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-transparent border-t-current" />
            ) : (
              <Icon name={detail.isActive ? 'eye-off' : 'check'} size={14} />
            )}
            {detail.isActive ? 'Suspender tenant' : 'Reactivar tenant'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15;

export default function SuperAdminPage() {
  const [stats,         setStats]         = useState<PlatformStats | null>(null);
  const [tenants,       setTenants]       = useState<TenantSummary[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [filterPlan,    setFilterPlan]    = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [page,          setPage]          = useState(1);
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [error,         setError]         = useState('');

  const toastErrRef = useRef<((msg: string) => void) | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, tenantsRes] = await Promise.all([
        api.get<PlatformStats>('/super-admin/stats'),
        api.get<TenantSummary[]>('/super-admin/tenants'),
      ]);
      setStats(statsRes.data);
      setTenants(tenantsRes.data);
    } catch {
      setError('Error cargando datos. Verifica que tu cuenta tiene rol SUPER_ADMIN.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const filtered = tenants.filter(t => {
    const matchSearch = !search.trim()
      || t.name.toLowerCase().includes(search.toLowerCase())
      || t.slug.toLowerCase().includes(search.toLowerCase());
    const matchPlan   = !filterPlan   || t.subscription?.planType === filterPlan;
    const matchStatus = !filterStatus
      || (filterStatus === 'active'    && t.isActive)
      || (filterStatus === 'suspended' && !t.isActive);
    return matchSearch && matchPlan && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paged      = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleStatusChanged = (id: string, isActive: boolean) => {
    setTenants(prev => prev.map(t => t.id === id ? { ...t, isActive } : t));
  };

  const clearFilters = () => { setSearch(''); setFilterPlan(''); setFilterStatus(''); setPage(1); };

  const hasFilters = !!search || !!filterPlan || !!filterStatus;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full">

      {/* ── Main panel ── */}
      <div className={`flex flex-1 flex-col min-w-0 transition-all duration-300 ${selectedId ? 'mr-[420px]' : ''}`}>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">

            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20">
                <Icon name="shield" size={18} className="text-violet-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Panel Super Admin</h1>
                <p className="text-sm text-muted-foreground/60">Gestión global de la plataforma Capta</p>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard label="Tenants"       value={stats.totalTenants}      sub={`${stats.activeTenants} activos`} />
                <StatCard label="Usuarios"      value={stats.totalUsers} />
                <StatCard label="Cursos"        value={stats.totalCourses} />
                <StatCard label="Inscripciones" value={stats.totalEnrollments} />
                <StatCard label="Certificados"  value={stats.totalCertificates} />
                <div className="rounded-2xl border border-border bg-card p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">Por plan</p>
                  <div className="mt-2 space-y-1">
                    {stats.byPlan.map(p => (
                      <div key={p.planType} className="flex items-center justify-between">
                        <span className="text-xs" style={{ color: PLAN_COLORS[p.planType] }}>{p.planName}</span>
                        <span className="text-xs font-bold tabular-nums text-foreground">{p.count}</span>
                      </div>
                    ))}
                    {stats.byPlan.length === 0 && <p className="text-xs text-muted-foreground/40">—</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Icon name="search" size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Buscar por nombre o slug..."
                  className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-4 text-sm outline-none focus:border-capta-deep/40 focus:ring-2 focus:ring-capta-deep/10 placeholder:text-muted-foreground/40"
                />
              </div>

              {/* Plan filter */}
              <div className="relative">
                <select
                  value={filterPlan}
                  onChange={e => { setFilterPlan(e.target.value); setPage(1); }}
                  className="appearance-none rounded-xl border border-border bg-background py-2 pl-3 pr-8 text-sm text-foreground outline-none focus:border-capta-deep/40"
                >
                  <option value="">Todos los planes</option>
                  <option value="FREE">Free</option>
                  <option value="BUSINESS">Business</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
                <Icon name="chevron-down" size={11} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
              </div>

              {/* Status filter */}
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
                  className="appearance-none rounded-xl border border-border bg-background py-2 pl-3 pr-8 text-sm text-foreground outline-none focus:border-capta-deep/40"
                >
                  <option value="">Todos los estados</option>
                  <option value="active">Activos</option>
                  <option value="suspended">Suspendidos</option>
                </select>
                <Icon name="chevron-down" size={11} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
              </div>

              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-muted-foreground/60 hover:text-foreground transition-colors px-2 py-1"
                >
                  Limpiar filtros
                </button>
              )}

              <span className="ml-auto text-xs text-muted-foreground/50">
                {filtered.length} tenant{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              {loading ? (
                <div className="flex justify-center py-16">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor: 'var(--tenant-primary)' }} />
                </div>
              ) : paged.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-sm text-muted-foreground/60">
                    {hasFilters ? 'Sin resultados para los filtros aplicados.' : 'No hay tenants registrados.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">Empresa</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">Plan</th>
                          <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">Usuarios</th>
                          <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">Cursos</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">Estado</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">Creado</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {paged.map(tenant => {
                          const planColor = tenant.subscription ? PLAN_COLORS[tenant.subscription.planType] ?? '#6B7280' : '#6B7280';
                          const isSelected = selectedId === tenant.id;
                          return (
                            <tr
                              key={tenant.id}
                              className={`hover:bg-muted/20 transition-colors cursor-pointer ${isSelected ? 'bg-muted/30' : ''}`}
                              onClick={() => setSelectedId(isSelected ? null : tenant.id)}
                            >
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                                    style={{ background: `linear-gradient(135deg, ${planColor}, ${planColor}bb)` }}
                                  >
                                    {tenant.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-foreground">{tenant.name}</p>
                                    <p className="text-[11px] text-muted-foreground/60 font-mono">{tenant.slug}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {tenant.subscription ? (
                                  <div>
                                    <span className="text-xs font-semibold" style={{ color: planColor }}>
                                      {tenant.subscription.planName}
                                    </span>
                                    <p className="text-[10px] text-muted-foreground/50">
                                      {STATUS_BADGE[tenant.subscription.status]?.label ?? tenant.subscription.status}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground/40">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-foreground">{tenant.userCount}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-foreground">{tenant.courseCount}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                  tenant.isActive
                                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                    : 'bg-muted text-muted-foreground border-border'
                                }`}>
                                  {tenant.isActive ? 'Activo' : 'Suspendido'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground/60">{fmtDateShort(tenant.createdAt)}</td>
                              <td className="px-4 py-3 text-right">
                                <Icon
                                  name={isSelected ? 'close' : 'external'}
                                  size={13}
                                  className="text-muted-foreground/30"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pager */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-border bg-muted/20 px-5 py-3">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={safePage <= 1}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                      >
                        <Icon name="arrow-left" size={11} />
                        Anterior
                      </button>
                      <span className="text-xs text-muted-foreground/60">
                        {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} de {filtered.length}
                      </span>
                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={safePage >= totalPages}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                      >
                        Siguiente
                        <Icon name="arrow-left" size={11} className="rotate-180" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ── Detail drawer ── */}
      <AnimatePresence>
        {selectedId && (
          <motion.aside
            key="drawer"
            initial={{ x: 420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 420, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            className="fixed right-0 top-0 bottom-0 w-[420px] border-l border-border bg-card shadow-2xl z-30"
          >
            <TenantDrawer
              key={selectedId}
              tenantId={selectedId}
              onClose={() => setSelectedId(null)}
              onStatusChanged={handleStatusChanged}
            />
          </motion.aside>
        )}
      </AnimatePresence>

    </div>
  );
}
