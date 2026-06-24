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

const STATUS_CFG: Record<
  SubscriptionStatus,
  { label: string; icon: IconName; dot: string; pill: string }
> = {
  ACTIVE:   { label: 'Activa',       icon: 'check-circle',   dot: 'bg-emerald-500',  pill: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' },
  TRIALING: { label: 'En prueba',    icon: 'zap',            dot: 'bg-capta-soft',   pill: 'bg-capta-tint text-capta-deep border-capta-soft/30 dark:bg-capta-soft/10 dark:text-capta-soft dark:border-capta-soft/20' },
  PAST_DUE: { label: 'Pago vencido', icon: 'alert-triangle', dot: 'bg-amber-500',    pill: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' },
  CANCELED: { label: 'Cancelada',    icon: 'x-circle',       dot: 'bg-red-500',      pill: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20' },
  UNPAID:   { label: 'Sin pagar',    icon: 'alert-triangle', dot: 'bg-red-500',      pill: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20' },
};

const PLAN_CFG: Record<PlanType, {
  icon: IconName;
  iconBg: string;
  iconColor: string;
  borderActive: string;
  cta: string;
  ctaStyle: 'ghost' | 'primary' | 'success';
  badge?: { label: string; cls: string };
}> = {
  FREE: {
    icon: 'package',
    iconBg: 'bg-slate-100 dark:bg-slate-800',
    iconColor: 'text-slate-500 dark:text-slate-400',
    borderActive: 'border-slate-400',
    cta: 'Plan base',
    ctaStyle: 'ghost',
  },
  BUSINESS: {
    icon: 'zap',
    iconBg: 'bg-blue-50 dark:bg-blue-500/10',
    iconColor: 'text-blue-600 dark:text-blue-400',
    borderActive: 'border-blue-500',
    cta: 'Actualizar a Business',
    ctaStyle: 'primary',
    badge: { label: 'Más popular', cls: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20' },
  },
  ENTERPRISE: {
    icon: 'award',
    iconBg: 'bg-emerald-50 dark:bg-emerald-500/10',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    borderActive: 'border-emerald-500',
    cta: 'Actualizar a Enterprise',
    ctaStyle: 'success',
    badge: { label: 'Máximo poder', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' },
  },
};

const PLAN_FEATURES: { key: keyof Plan; label: string }[] = [
  { key: 'hasEvaluations',  label: 'Evaluaciones y quizzes' },
  { key: 'hasCertificates', label: 'Certificados digitales'  },
  { key: 'hasAnalytics',    label: 'Analíticas avanzadas'    },
  { key: 'hasWhiteLabel',   label: 'Marca personalizada'     },
  { key: 'hasApi',          label: 'Acceso a la API'         },
];

// ─── Utilidades ───────────────────────────────────────────────────────────────

const fmtDate = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
    : '—';

const fmtBytes = (b: number) => {
  if (b === 0) return '0 MB';
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
};

const fmtStorage = (gb: number) => (gb === -1 ? 'Ilimitado' : `${gb} GB`);

const fmtPrice = (usd: number) =>
  usd === 0
    ? 'Gratis'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(usd);

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: SubscriptionStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${cfg.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Alert banner ─────────────────────────────────────────────────────────────

function AlertBanner({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10"
    >
      <Icon name={icon} size={16} className="mt-px flex-shrink-0 text-amber-600 dark:text-amber-400" />
      <div>
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-amber-600/80 dark:text-amber-400/70">{body}</p>
      </div>
    </motion.div>
  );
}

// ─── Status banner (plan activo) ──────────────────────────────────────────────

function StatusBanner({
  plan,
  status,
  currentPeriodStart,
  currentPeriodEnd,
  isOwner,
  portalLoading,
  onPortal,
}: {
  plan: Plan;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  isOwner: boolean;
  portalLoading: boolean;
  onPortal: () => void;
}) {
  const cfg = PLAN_CFG[plan.type];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-3.5">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${cfg.iconBg}`}>
          <Icon name={cfg.icon} size={18} className={cfg.iconColor} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{plan.name}</p>
            <StatusPill status={status} />
          </div>
          {currentPeriodStart && currentPeriodEnd && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {fmtDate(currentPeriodStart)} – {fmtDate(currentPeriodEnd)}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground sm:flex-shrink-0">
        <div className="hidden items-center gap-3 sm:flex">
          <span className="flex items-center gap-1.5">
            <Icon name="hard-drive" size={12} />
            {fmtStorage(plan.storageGb)}
          </span>
          <span className="text-border">·</span>
          <span className="flex items-center gap-1.5">
            <Icon name="users" size={12} />
            {plan.maxEmployees === -1 ? 'Ilimitados' : `${plan.maxEmployees} empleados`}
          </span>
        </div>
        {isOwner && plan.type !== 'FREE' && (
          <button
            onClick={onPortal}
            disabled={portalLoading}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {portalLoading
              ? <Icon name="refresh" size={12} className="animate-spin" />
              : <Icon name="external-link" size={12} />}
            Facturación
          </button>
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
  const fillColor  = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  const textColor  = pct >= 90 ? 'text-red-500' : pct >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.05 }}
      className="rounded-2xl border border-border bg-card p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Icon name="hard-drive" size={14} className="text-muted-foreground" />
          Almacenamiento
        </div>
        <span className={`text-xs font-medium ${textColor}`}>
          {unlimited
            ? `${fmtBytes(usedBytes)} · Ilimitado`
            : `${fmtBytes(usedBytes)} de ${totalGb} GB`}
        </span>
      </div>

      {!unlimited && (
        <>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className={`h-full rounded-full ${fillColor}`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground/60">
            <span>0 GB</span>
            <span className={pct >= 70 ? textColor : ''}>{pct.toFixed(0)}% usado</span>
            <span>{totalGb} GB</span>
          </div>
          {pct >= 80 && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className={`mt-3 flex items-center gap-1.5 text-xs font-medium ${textColor}`}
            >
              <Icon name="alert-triangle" size={12} className="flex-shrink-0" />
              {pct >= 90
                ? `Almacenamiento casi lleno. Agrega un add-on para evitar interrupciones.`
                : `Estás usando el ${pct.toFixed(0)}% de tu almacenamiento.`}
            </motion.p>
          )}
        </>
      )}
    </motion.div>
  );
}

// ─── Pricing card ─────────────────────────────────────────────────────────────

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
  const cfg = PLAN_CFG[plan.type];

  const ctaClass = {
    ghost:   'border border-border bg-transparent text-muted-foreground hover:bg-muted',
    primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-500/20',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-500/20',
  }[cfg.ctaStyle];

  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-card p-5 transition-all ${
        isCurrent
          ? `border-2 ${cfg.borderActive}`
          : 'border-border hover:border-border/80 hover:shadow-sm'
      }`}
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${cfg.iconBg}`}>
          <Icon name={cfg.icon} size={16} className={cfg.iconColor} />
        </div>
        {isCurrent ? (
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
            Tu plan
          </span>
        ) : cfg.badge ? (
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.badge.cls}`}>
            {cfg.badge.label}
          </span>
        ) : null}
      </div>

      {/* Precio */}
      <div className="mb-1">
        {plan.priceUsd === 0 ? (
          <p className="text-2xl font-medium tracking-tight text-foreground">Gratis</p>
        ) : (
          <p className="text-2xl font-medium tracking-tight text-foreground">
            {fmtPrice(plan.priceUsd)}{' '}
            <span className="text-sm font-normal text-muted-foreground">/mes</span>
          </p>
        )}
      </div>
      <p className="mb-4 text-sm font-medium text-foreground">{plan.name}</p>

      {/* Divider */}
      <div className="mb-4 border-t border-border" />

      {/* Features */}
      <ul className="mb-5 flex-1 space-y-2.5">
        {PLAN_FEATURES.map(f => {
          const enabled = plan[f.key] as boolean;
          return (
            <li key={f.key} className={`flex items-center gap-2.5 text-xs ${enabled ? 'text-foreground' : 'text-muted-foreground/40'}`}>
              <div className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full ${enabled ? cfg.iconBg : 'bg-muted'}`}>
                <Icon
                  name={enabled ? 'check' : 'minus'}
                  size={9}
                  className={enabled ? cfg.iconColor : 'text-muted-foreground/30'}
                />
              </div>
              <span className={enabled ? '' : 'line-through'}>{f.label}</span>
            </li>
          );
        })}
      </ul>

      {/* Límites */}
      <div className="mb-5 flex flex-wrap gap-x-3 gap-y-1">
        {[
          { icon: 'hard-drive' as IconName, label: fmtStorage(plan.storageGb) },
          { icon: 'users'      as IconName, label: plan.maxEmployees === -1 ? '∞ empleados' : `${plan.maxEmployees} empl.` },
          { icon: 'package'    as IconName, label: plan.maxCompanies === -1 ? '∞ empresas'  : `${plan.maxCompanies} emp${plan.maxCompanies === 1 ? '.' : 's.'}` },
        ].map(m => (
          <span key={m.label} className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Icon name={m.icon} size={11} className="text-muted-foreground/50" />
            {m.label}
          </span>
        ))}
      </div>

      {/* CTA */}
      {isOwner && (
        isCurrent ? (
          <div className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium ${ctaClass}`}>
            <Icon name="check-circle" size={12} />
            Plan actual
          </div>
        ) : plan.type === 'FREE' ? (
          <div className={`flex items-center justify-center rounded-xl py-2 text-xs ${ctaClass}`}>
            Plan base
          </div>
        ) : (
          <button
            onClick={() => onUpgrade(plan.type)}
            disabled={checkoutLoading}
            className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-60 ${ctaClass}`}
          >
            {checkoutLoading
              ? <Icon name="refresh" size={12} className="animate-spin" />
              : <Icon name="zap" size={12} />}
            {cfg.cta}
          </button>
        )
      )}
    </div>
  );
}

// ─── Pack row ─────────────────────────────────────────────────────────────────

function PackRow({
  pack, qty, isOwner, adding, removing, onAdd, onRemove,
}: {
  pack: StoragePack; qty: number; isOwner: boolean;
  adding: boolean; removing: boolean; onAdd: () => void; onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/40">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10">
          <Icon name="hard-drive" size={14} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{pack.name}</p>
          <p className="text-xs text-muted-foreground">+{pack.storageGb} GB · {fmtPrice(pack.priceUsd)}/mes</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {qty > 0 && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
            ×{qty}
          </span>
        )}
        {isOwner && (
          <div className="flex items-center gap-1">
            {qty > 0 && (
              <button
                onClick={onRemove}
                disabled={removing || adding}
                aria-label="Quitar pack"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-400"
              >
                {removing
                  ? <Icon name="refresh" size={12} className="animate-spin" />
                  : <Icon name="minus" size={12} />}
              </button>
            )}
            <button
              onClick={onAdd}
              disabled={removing || adding}
              aria-label="Agregar pack"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10 dark:hover:text-blue-400"
            >
              {adding
                ? <Icon name="refresh" size={12} className="animate-spin" />
                : <Icon name="plus" size={12} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-5 p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-5 w-28 rounded-lg bg-muted" />
          <div className="h-3 w-44 rounded-md bg-muted/60" />
        </div>
        <div className="h-7 w-24 rounded-lg bg-muted" />
      </div>
      <div className="h-16 w-full rounded-2xl bg-muted" />
      <div className="h-20 w-full rounded-2xl bg-muted" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-64 rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="h-32 w-full rounded-2xl bg-muted" />
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function SubscriptionPage() {
  const { error: toastError } = useToast();

  const [subscription,   setSubscription]   = useState<SubscriptionData | null>(null);
  const [allPlans,       setAllPlans]       = useState<Plan[]>([]);
  const [availablePacks, setAvailablePacks] = useState<StoragePack[]>([]);
  const [userRole,       setUserRole]       = useState('');
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);

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

  // ── Estados de carga / error ──

  if (loading) return <Skeleton />;

  if (error || !subscription) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-500/20 dark:bg-red-500/10">
          <Icon name="alert-triangle" size={18} className="flex-shrink-0 text-red-500 dark:text-red-400" />
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">{error ?? 'Error desconocido'}</p>
            <button
              onClick={() => { setLoading(true); fetchData(); }}
              className="mt-1 flex items-center gap-1 text-xs text-red-600 hover:underline underline-offset-2 dark:text-red-400"
            >
              <Icon name="refresh" size={11} /> Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const {
    plan, status, currentPeriodStart, currentPeriodEnd,
    cancelAtPeriodEnd, totalStorageGb, activeStoragePacks = [], usedStorageBytes = 0,
  } = subscription;

  const activePackQty: Record<string, number> = {};
  activeStoragePacks.forEach(p => { activePackQty[p.id] = p.quantity; });
  const showStoragePacks = plan.type !== 'FREE';
  const activeAddonGb    = activeStoragePacks.reduce((s, p) => s + p.storageGb * p.quantity, 0);

  return (
    <div className="p-6 lg:p-8 space-y-5">

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Suscripción</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Plan, almacenamiento y facturación.</p>
        </div>
        {/* Portal en header solo para paid + owner */}
        {isOwner && plan.type !== 'FREE' && (
          <button
            onClick={handlePortal}
            disabled={portalLoading}
            className="hidden sm:flex items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {portalLoading
              ? <Icon name="refresh" size={12} className="animate-spin" />
              : <Icon name="external-link" size={12} />}
            Portal de facturación
          </button>
        )}
      </motion.div>

      {/* ── Alertas ── */}
      <AnimatePresence>
        {(status === 'PAST_DUE' || status === 'UNPAID') && (
          <AlertBanner
            key="past-due"
            icon="alert-triangle"
            title="Pago pendiente"
            body="Tu suscripción tiene un pago vencido. Actualiza tu método de pago en el portal de facturación."
          />
        )}
        {cancelAtPeriodEnd && status === 'ACTIVE' && (
          <AlertBanner
            key="cancel"
            icon="alert-triangle"
            title="Cancelación programada"
            body={`Tu plan se cancelará el ${fmtDate(currentPeriodEnd)}. Puedes reactivarlo desde el portal.`}
          />
        )}
      </AnimatePresence>

      {/* ── Status banner ── */}
      <StatusBanner
        plan={plan}
        status={status}
        currentPeriodStart={currentPeriodStart}
        currentPeriodEnd={currentPeriodEnd}
        isOwner={isOwner}
        portalLoading={portalLoading}
        onPortal={handlePortal}
      />

      {/* ── Storage ── */}
      <StorageBar usedBytes={usedStorageBytes} totalGb={totalStorageGb} />

      {/* ── Planes ── */}
      {allPlans.length > 0 && (
        <section>
          <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground/60">
            Planes disponibles
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {allPlans.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 28, delay: i * 0.07 }}
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

      {/* ── Storage add-ons ── */}
      {showStoragePacks && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.22 }}
          className="rounded-2xl border border-border bg-card p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Storage add-ons</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Los cambios se reflejan en tu próxima factura.
              </p>
            </div>
            {activeAddonGb > 0 && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                +{activeAddonGb} GB activos
              </span>
            )}
          </div>

          {availablePacks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Icon name="hard-drive" size={18} className="text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No hay packs disponibles</p>
              <p className="text-xs text-muted-foreground/50">Estarán disponibles próximamente.</p>
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
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Solo el propietario puede gestionar los add-ons.
            </p>
          )}
        </motion.div>
      )}

    </div>
  );
}