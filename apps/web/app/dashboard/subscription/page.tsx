'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, type IconName } from '@/components/capta-icon';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNPAID';
type PlanType = 'FREE' | 'BUSINESS' | 'ENTERPRISE';

interface Plan {
  id: string;
  name: string;
  type: PlanType;
  priceUsd: number;
  storageGb: number;
  maxEmployees: number;
  maxCompanies: number;
  hasEvaluations: boolean;
  hasCertificates: boolean;
  hasAnalytics: boolean;
  hasWhiteLabel: boolean;
  hasApi: boolean;
  stripePriceId: string | null;
}

interface ActiveStoragePack {
  id: string;
  name: string;
  storageGb: number;
  priceUsd: number;
  quantity: number;
}

interface SubscriptionData {
  id: string;
  status: SubscriptionStatus;
  plan: Plan;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  totalStorageGb: number;
  activeStoragePacks: ActiveStoragePack[];
  usedStorageBytes: number;
}

interface StoragePack {
  id: string;
  name: string;
  storageGb: number;
  priceUsd: number;
}

// ─── Config visual ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<SubscriptionStatus, { label: string; icon: IconName; cls: string }> = {
  ACTIVE:   { label: 'Activa',       icon: 'check-circle',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30' },
  TRIALING: { label: 'Prueba',       icon: 'zap',            cls: 'bg-capta-tint text-capta-deep border-capta-soft/30 dark:bg-capta-soft/10 dark:text-capta-soft dark:border-capta-soft/20' },
  PAST_DUE: { label: 'Pago vencido', icon: 'alert-triangle', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30' },
  CANCELED: { label: 'Cancelada',    icon: 'x-circle',       cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30' },
  UNPAID:   { label: 'Sin pagar',    icon: 'alert-triangle', cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30' },
};

const PLAN_STYLE: Record<PlanType, {
  gradient: string;
  accent: string;
  highlight: boolean;
  badge?: string;
}> = {
  FREE:       { gradient: 'from-slate-400 to-slate-600',    accent: '#64748b', highlight: false },
  BUSINESS:   { gradient: 'from-capta-soft to-capta-deep',  accent: '#1E4F7A', highlight: true,  badge: 'Más popular' },
  ENTERPRISE: { gradient: 'from-emerald-400 to-capta-deep', accent: '#059669', highlight: false, badge: 'Máximo poder' },
};

const PLAN_FEATURES: { key: keyof Plan; label: string; icon: IconName }[] = [
  { key: 'hasEvaluations',  label: 'Evaluaciones y quizzes', icon: 'shield' },
  { key: 'hasCertificates', label: 'Certificados digitales',  icon: 'award' },
  { key: 'hasAnalytics',    label: 'Analíticas avanzadas',    icon: 'chart-bar' },
  { key: 'hasWhiteLabel',   label: 'Marca personalizada',     icon: 'gear' },
  { key: 'hasApi',          label: 'Acceso a la API',         icon: 'globe' },
];

// ─── Utilidades ───────────────────────────────────────────────────────────────

const fmtDate  = (iso: string | null) => iso
  ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
  : '—';

const fmtBytes = (b: number) => {
  if (b === 0) return '0 MB';
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
};

const fmtStorage = (gb: number) => gb === -1 ? 'Ilimitado' : `${gb} GB`;

const fmtPrice = (usd: number) =>
  usd === 0
    ? 'Gratis'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(usd);

// ─── Badge de estado ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${cfg.cls}`}>
      <Icon name={cfg.icon} size={12} />
      {cfg.label}
    </span>
  );
}

// ─── Pricing Card ─────────────────────────────────────────────────────────────

function PricingCard({
  plan,
  isCurrent,
  isOwner,
  checkoutLoading,
  onUpgrade,
}: {
  plan: Plan;
  isCurrent: boolean;
  isOwner: boolean;
  checkoutLoading: boolean;
  onUpgrade: (type: PlanType) => void;
}) {
  const style  = PLAN_STYLE[plan.type];
  const price  = plan.priceUsd;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      className={`relative flex flex-col rounded-2xl border bg-card overflow-hidden transition-all ${
        isCurrent
          ? 'border-capta-deep/40 dark:border-capta-soft/40 shadow-lg shadow-capta-deep/10'
          : style.highlight
          ? 'border-capta-deep/20 dark:border-capta-soft/20 shadow-md'
          : 'border-border'
      }`}
      style={isCurrent ? { boxShadow: '0 0 0 2px color-mix(in srgb, var(--tenant-primary) 15%, transparent), 0 8px 24px color-mix(in srgb, var(--tenant-primary) 10%, transparent)' } : {}}
    >
      {/* Acento de color superior */}
      <div
        className={`h-1 w-full bg-gradient-to-r ${style.gradient}`}
      />

      {/* Badge popular / máximo poder */}
      {style.badge && !isCurrent && (
        <div className="absolute right-4 top-4">
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
            style={plan.type === 'BUSINESS'
              ? { background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 80%, transparent) 100%)' }
              : { background: `linear-gradient(135deg, ${style.accent}, ${style.accent}cc)` }
            }
          >
            {style.badge}
          </span>
        </div>
      )}

      {/* Badge "Tu plan" */}
      {isCurrent && (
        <div className="absolute right-4 top-4">
          <span className="inline-flex items-center gap-1 rounded-full border border-capta-deep/30 bg-capta-tint px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-capta-deep dark:border-capta-soft/30 dark:bg-capta-soft/10 dark:text-capta-soft">
            <Icon name="check-circle" size={10} />
            Tu plan
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">

        {/* Nombre del plan */}
        <div className="mb-4">
          <div
            className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${style.gradient}`}
          >
            <Icon name={plan.type === 'FREE' ? 'package' : plan.type === 'BUSINESS' ? 'zap' : 'award'} size={18} className="text-white" />
          </div>
          <h3 className="text-base font-bold text-foreground">{plan.name}</h3>
        </div>

        {/* Precio */}
        <div className="mb-5">
          {price === 0 ? (
            <p className="font-display text-3xl font-normal tracking-tight text-foreground">Gratis</p>
          ) : (
            <div className="flex items-end gap-1">
              <p className="font-display text-3xl font-normal tracking-tight text-foreground">{fmtPrice(price)}</p>
              <span className="mb-1 text-sm text-muted-foreground">/mes</span>
            </div>
          )}
        </div>

        {/* Métricas clave */}
        <div className="mb-5 grid grid-cols-1 gap-2">
          {[
            { icon: 'hard-drive' as IconName, label: fmtStorage(plan.storageGb) + ' storage' },
            { icon: 'users'      as IconName, label: plan.maxEmployees === -1 ? 'Empleados ilimitados' : `${plan.maxEmployees} empleados` },
            { icon: 'package'    as IconName, label: plan.maxCompanies === -1 ? 'Empresas ilimitadas'  : `${plan.maxCompanies} empresa${plan.maxCompanies === 1 ? '' : 's'}` },
          ].map(m => (
            <div key={m.label} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon name={m.icon} size={13} className="flex-shrink-0 text-muted-foreground/60" />
              <span>{m.label}</span>
            </div>
          ))}
        </div>

        {/* Divisor */}
        <div className="mb-4 border-t border-border" />

        {/* Features */}
        <ul className="mb-6 flex-1 space-y-2">
          {PLAN_FEATURES.map(f => {
            const enabled = plan[f.key] as boolean;
            return (
              <li key={f.key} className={`flex items-center gap-2 text-sm ${enabled ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                <div
                  className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: enabled ? `${style.accent}18` : 'transparent',
                    border: `1.5px solid ${enabled ? style.accent + '50' : 'var(--border)'}`,
                  }}
                >
                  {enabled
                    ? <Icon name="check" size={9} style={{ color: style.accent }} />
                    : <Icon name="minus" size={9} className="text-muted-foreground/40" />
                  }
                </div>
                <span className={enabled ? '' : 'line-through opacity-50'}>{f.label}</span>
              </li>
            );
          })}
        </ul>

        {/* CTA */}
        {isOwner && (
          isCurrent ? (
            <div className="flex items-center justify-center gap-1.5 rounded-xl border border-capta-deep/20 bg-capta-tint/60 py-2.5 text-sm font-medium text-capta-deep dark:border-capta-soft/20 dark:bg-capta-soft/10 dark:text-capta-soft">
              <Icon name="check-circle" size={14} />
              Plan actual
            </div>
          ) : plan.type === 'FREE' ? (
            <div className="flex items-center justify-center rounded-xl border border-border py-2.5 text-sm text-muted-foreground">
              Plan base (sin costo)
            </div>
          ) : (
            <button
              onClick={() => onUpgrade(plan.type)}
              disabled={checkoutLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:opacity-90 active:scale-[0.97] disabled:opacity-60"
              style={plan.type === 'BUSINESS'
                ? {
                    background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)',
                    boxShadow:  '0 2px 12px color-mix(in srgb, var(--tenant-primary) 30%, transparent)',
                  }
                : {
                    background: `linear-gradient(135deg, ${style.accent}, ${style.accent}cc)`,
                    boxShadow:  `0 2px 12px ${style.accent}30`,
                  }
              }
            >
              {checkoutLoading
                ? <Icon name="refresh" size={14} className="animate-spin" />
                : <Icon name="zap" size={14} />}
              {plan.type === 'ENTERPRISE' ? 'Actualizar a Enterprise' : 'Actualizar a Business'}
            </button>
          )
        )}
      </div>
    </motion.div>
  );
}

// ─── Storage bar ──────────────────────────────────────────────────────────────

function StorageBar({ usedBytes, totalGb }: { usedBytes: number; totalGb: number }) {
  const unlimited  = totalGb === -1;
  const totalBytes = totalGb * 1024 ** 3;
  const pct        = unlimited ? 0 : Math.min(100, (usedBytes / totalBytes) * 100);
  const color      = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#7FD1AE';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Icon name="hard-drive" size={13} className="text-muted-foreground" />
          Almacenamiento usado
        </div>
        <span className="text-muted-foreground">
          {unlimited ? `${fmtBytes(usedBytes)} de Ilimitado` : `${fmtBytes(usedBytes)} de ${totalGb} GB`}
        </span>
      </div>
      {!unlimited && (
        <>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{ background: color }}
            />
          </div>
          {pct >= 80 && (
            <p className={`flex items-start gap-1.5 text-xs font-medium ${pct >= 90 ? 'text-red-500' : 'text-amber-600 dark:text-amber-400'}`}>
              <Icon name="alert-triangle" size={12} className="mt-px flex-shrink-0" />
              {pct >= 90
                ? `Almacenamiento casi lleno (${pct.toFixed(0)}%). Agrega un pack para evitar interrupciones.`
                : `Estás usando el ${pct.toFixed(0)}% de tu almacenamiento.`}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Storage Pack Row ─────────────────────────────────────────────────────────

function PackRow({
  pack, qty, isOwner, adding, removing, onAdd, onRemove,
}: {
  pack: StoragePack; qty: number; isOwner: boolean;
  adding: boolean; removing: boolean; onAdd: () => void; onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'color-mix(in srgb, var(--tenant-primary) 8%, transparent)', color: 'var(--tenant-primary)' }}>
          <Icon name="hard-drive" size={16} />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{pack.name}</p>
          <p className="text-xs text-muted-foreground">+{pack.storageGb} GB · {fmtPrice(pack.priceUsd)}/mes</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {qty > 0 && (
          <span className="rounded-full bg-capta-tint px-2 py-0.5 text-xs font-semibold text-capta-deep dark:bg-capta-soft/10 dark:text-capta-soft">
            ×{qty}
          </span>
        )}
        {isOwner && (
          <div className="flex items-center gap-1">
            {qty > 0 && (
              <button
                onClick={onRemove} disabled={removing || adding}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Quitar pack"
              >
                {removing ? <Icon name="refresh" size={13} className="animate-spin" /> : <Icon name="minus" size={13} />}
              </button>
            )}
            <button
              onClick={onAdd} disabled={removing || adding}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:border-capta-deep/30 hover:bg-capta-tint hover:text-capta-deep disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Agregar pack"
            >
              {adding ? <Icon name="refresh" size={13} className="animate-spin" /> : <Icon name="plus" size={13} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function SubscriptionPage() {
  const { error: toastError } = useToast();

  const [subscription,    setSubscription]    = useState<SubscriptionData | null>(null);
  const [allPlans,        setAllPlans]        = useState<Plan[]>([]);
  const [availablePacks,  setAvailablePacks]  = useState<StoragePack[]>([]);
  const [userRole,        setUserRole]        = useState('');
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState<string | null>(null);

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading,   setPortalLoading]   = useState(false);
  const [packLoading,     setPackLoading]     = useState<Record<string, 'adding' | 'removing' | null>>({});

  const isOwner = userRole === 'OWNER';

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [subRes, packsRes, plansRes] = await Promise.all([
        api.get<SubscriptionData>('/subscriptions/me'),
        api.get<StoragePack[]>('/subscriptions/storage-packs'),
        api.get<Plan[]>('/subscriptions/plans'),
      ]);
      setSubscription(subRes.data);
      setAvailablePacks(packsRes.data);
      setAllPlans(plansRes.data);
    } catch {
      setError('No se pudo cargar la información de suscripción.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) setUserRole((JSON.parse(raw) as { role: string }).role ?? '');
    } catch { /* ignorar */ }
    fetchData();
  }, [fetchData]);

  const handleUpgrade = async (planType: PlanType) => {
    setCheckoutLoading(true);
    try {
      const { data } = await api.post<{ url: string }>('/subscriptions/checkout', { planType });
      window.location.href = data.url;
    } catch {
      toastError('No se pudo iniciar el cambio de plan.', 'Asegúrate de tener Stripe configurado.');
    } finally { setCheckoutLoading(false); }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const { data } = await api.post<{ url: string }>('/subscriptions/portal');
      window.open(data.url, '_blank');
    } catch {
      toastError('No se pudo abrir el portal de facturación.');
    } finally { setPortalLoading(false); }
  };

  const handleAddPack = async (packId: string) => {
    setPackLoading(p => ({ ...p, [packId]: 'adding' }));
    try { await api.post('/subscriptions/storage-packs', { packId }); await fetchData(); }
    catch { toastError('No se pudo agregar el storage pack.'); }
    finally { setPackLoading(p => ({ ...p, [packId]: null })); }
  };

  const handleRemovePack = async (packId: string) => {
    setPackLoading(p => ({ ...p, [packId]: 'removing' }));
    try { await api.delete(`/subscriptions/storage-packs/${packId}`); await fetchData(); }
    catch { toastError('No se pudo quitar el storage pack.'); }
    finally { setPackLoading(p => ({ ...p, [packId]: null })); }
  };

  // ── Loading ──

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6 animate-pulse">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-5 w-32 rounded-lg bg-muted" />
          <div className="h-3.5 w-56 rounded-md bg-muted/60" />
        </div>
        {/* Status card skeleton */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-4 w-24 rounded-md bg-muted" />
              <div className="h-7 w-40 rounded-lg bg-muted" />
            </div>
            <div className="h-7 w-20 rounded-full bg-muted" />
          </div>
          <div className="h-px bg-border" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-16 rounded bg-muted/60" />
                <div className="h-4 w-24 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
        {/* Plans skeleton */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="h-1 w-full bg-muted" />
              <div className="p-5 space-y-4">
                <div className="h-9 w-9 rounded-xl bg-muted" />
                <div className="h-7 w-20 rounded-lg bg-muted" />
                <div className="space-y-2">
                  {[...Array(3)].map((_, j) => <div key={j} className="h-3 w-full rounded bg-muted/60" />)}
                </div>
                <div className="h-10 w-full rounded-xl bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          <Icon name="alert-triangle" size={20} className="flex-shrink-0" />
          <div>
            <p className="font-medium">{error ?? 'Error desconocido'}</p>
            <button onClick={() => { setLoading(true); fetchData(); }}
              className="mt-1 flex items-center gap-1 text-sm hover:underline underline-offset-2">
              <Icon name="refresh" size={12} /> Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { plan, status, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, totalStorageGb, activeStoragePacks = [], usedStorageBytes = 0 } = subscription;
  const activePackQty: Record<string, number> = {};
  activeStoragePacks.forEach(p => { activePackQty[p.id] = p.quantity; });
  const showStoragePacks = plan.type !== 'FREE';

  return (
    <div className="p-6 lg:p-8 space-y-8">

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Suscripción</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Gestiona tu plan, almacenamiento y facturación.
        </p>
      </motion.div>

      {/* ── Alertas ── */}
      <AnimatePresence>
        {(status === 'PAST_DUE' || status === 'UNPAID') && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10"
          >
            <Icon name="alert-triangle" size={18} className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Pago pendiente</p>
              <p className="mt-0.5 text-xs text-amber-600/80 dark:text-amber-400/80">
                Tu suscripción tiene un pago vencido. Actualiza tu método de pago en el portal de facturación.
              </p>
            </div>
          </motion.div>
        )}
        {cancelAtPeriodEnd && status === 'ACTIVE' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10"
          >
            <Icon name="alert-triangle" size={18} className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Cancelación programada</p>
              <p className="mt-0.5 text-xs text-amber-600/80 dark:text-amber-400/80">
                Tu plan se cancelará el {fmtDate(currentPeriodEnd)}. Puedes reactivarlo desde el portal.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Pricing Cards ── */}
      {allPlans.length > 0 && (
        <section>
          <div className="mb-5">
            <h2 className="text-base font-semibold text-foreground">Planes disponibles</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Elige el plan que mejor se adapte a tu empresa.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {allPlans.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 28, delay: i * 0.06 }}
              >
                <PricingCard
                  plan={p}
                  isCurrent={p.id === plan.id}
                  isOwner={isOwner}
                  checkoutLoading={checkoutLoading}
                  onUpgrade={handleUpgrade}
                />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* ── Detalles de la suscripción activa ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.15 }}
        className="rounded-2xl border border-border bg-card overflow-hidden"
        style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
      >
        {/* Acento superior */}
        <div className={`h-1 w-full bg-gradient-to-r ${PLAN_STYLE[plan.type].gradient}`} />

        <div className="p-6">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-foreground">{plan.name}</h3>
                <StatusBadge status={status} />
              </div>
              {currentPeriodStart && currentPeriodEnd && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon name="calendar" size={12} />
                  Período: {fmtDate(currentPeriodStart)} – {fmtDate(currentPeriodEnd)}
                </div>
              )}
            </div>
            {isOwner && plan.type !== 'FREE' && (
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-all hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {portalLoading
                  ? <Icon name="refresh" size={14} className="animate-spin" />
                  : <Icon name="external-link" size={14} />}
                Portal de facturación
              </button>
            )}
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-2 gap-3 border-t border-border pt-5 sm:grid-cols-4">
            {[
              { icon: 'hard-drive' as IconName, label: 'Storage total', value: fmtStorage(totalStorageGb) },
              { icon: 'users'      as IconName, label: 'Empleados',      value: plan.maxEmployees === -1 ? 'Ilimitados' : String(plan.maxEmployees) },
              { icon: 'package'    as IconName, label: 'Empresas',       value: plan.maxCompanies === -1 ? 'Ilimitadas' : String(plan.maxCompanies) },
              { icon: 'hard-drive' as IconName, label: 'Storage base',   value: `${plan.storageGb} GB` },
            ].map(m => (
              <div key={m.label} className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon name={m.icon} size={12} />
                  <span>{m.label}</span>
                </div>
                <p className="text-sm font-semibold text-foreground">{m.value}</p>
              </div>
            ))}
          </div>

          {/* Storage bar */}
          <div className="mt-5 border-t border-border pt-5">
            <StorageBar usedBytes={usedStorageBytes} totalGb={totalStorageGb} />
          </div>
        </div>
      </motion.div>

      {/* ── Storage Add-ons ── */}
      {showStoragePacks && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.2 }}
          className="rounded-2xl border border-border bg-card p-6"
          style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Storage Add-ons</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Amplía tu capacidad. Los cambios se reflejan en tu próxima factura.
              </p>
            </div>
            {activeStoragePacks.length > 0 && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                +{activeStoragePacks.reduce((s, p) => s + p.storageGb * p.quantity, 0)} GB activos
              </span>
            )}
          </div>

          {availablePacks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Icon name="hard-drive" size={18} className="text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No hay packs disponibles</p>
              <p className="text-xs text-muted-foreground/50">Los packs de almacenamiento estarán disponibles próximamente.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availablePacks.map(pack => (
                <PackRow
                  key={pack.id}
                  pack={pack}
                  qty={activePackQty[pack.id] ?? 0}
                  isOwner={isOwner}
                  adding={packLoading[pack.id] === 'adding'}
                  removing={packLoading[pack.id] === 'removing'}
                  onAdd={() => handleAddPack(pack.id)}
                  onRemove={() => handleRemovePack(pack.id)}
                />
              ))}
            </div>
          )}
          {!isOwner && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Solo el propietario puede gestionar los add-ons.
            </p>
          )}
        </motion.div>
      )}

    </div>
  );
}
