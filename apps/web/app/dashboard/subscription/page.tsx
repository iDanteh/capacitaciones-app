'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, type IconName } from '@/components/capta-icon';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNPAID';
type PlanType = 'FREE' | 'BUSINESS' | 'ENTERPRISE';

interface Plan {
  id: string;
  name: string;
  type: PlanType;
  price: number;
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
  extraStorageGb: number;
  price: number;
  quantity: number;
}

interface SubscriptionData {
  id: string;
  status: SubscriptionStatus;
  plan: Plan;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  totalStorageGb: number; // -1 = ilimitado
  activeStoragePacks: ActiveStoragePack[];
  usedStorageBytes: number;
}

interface StoragePack {
  id: string;
  name: string;
  extraStorageGb: number;
  price: number;
}

// ─── Config visual ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  SubscriptionStatus,
  { label: string; icon: IconName; bg: string; text: string; border: string }
> = {
  ACTIVE:   { label: 'Activa',       icon: 'check-circle',   bg: 'bg-emerald-50 dark:bg-emerald-500/10',  text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-500/30' },
  TRIAL:    { label: 'Prueba',       icon: 'zap',            bg: 'bg-capta-tint dark:bg-capta-soft/10',   text: 'text-capta-deep dark:text-capta-soft',  border: 'border-capta-soft/30 dark:border-capta-soft/20' },
  PAST_DUE: { label: 'Pago vencido', icon: 'alert-triangle', bg: 'bg-amber-50 dark:bg-amber-500/10',      text: 'text-amber-600 dark:text-amber-400',     border: 'border-amber-200 dark:border-amber-500/30' },
  CANCELED: { label: 'Cancelada',    icon: 'x-circle',       bg: 'bg-red-50 dark:bg-red-500/10',          text: 'text-red-600 dark:text-red-400',          border: 'border-red-200 dark:border-red-500/30' },
  UNPAID:   { label: 'Sin pagar',    icon: 'alert-triangle', bg: 'bg-red-50 dark:bg-red-500/10',          text: 'text-red-600 dark:text-red-400',          border: 'border-red-200 dark:border-red-500/30' },
};

const PLAN_GRADIENT: Record<PlanType, string> = {
  FREE:       'from-neutral-400 to-neutral-600',
  BUSINESS:   'from-capta-soft to-capta-deep',
  ENTERPRISE: 'from-emerald-400 to-capta-deep',
};

// ─── Utilidades ───────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

function formatStorage(gb: number): string {
  if (gb === -1) return 'Ilimitado';
  return `${gb} GB`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 MB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatPrice(usd: number): string {
  if (usd === 0) return 'Gratis';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(usd) + '/mes';
}

// ─── Storage bar ──────────────────────────────────────────────────────────────

function StorageBar({ usedBytes, totalGb }: { usedBytes: number; totalGb: number }) {
  const unlimited = totalGb === -1;
  const totalBytes = totalGb * 1024 * 1024 * 1024;
  const pct = unlimited ? 0 : Math.min(100, (usedBytes / totalBytes) * 100);

  const barColor =
    pct >= 90 ? '#ef4444' :
    pct >= 70 ? '#f59e0b' :
    '#7FD1AE';

  return (
    <div className="mt-5 border-t border-border pt-5 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Icon name="hard-drive" size={13} className="text-muted-foreground" />
          Almacenamiento usado
        </div>
        <span className="text-muted-foreground">
          {unlimited
            ? `${formatBytes(usedBytes)} de Ilimitado`
            : `${formatBytes(usedBytes)} de ${totalGb} GB`}
        </span>
      </div>

      {!unlimited && (
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: barColor }}
          />
        </div>
      )}

      {!unlimited && pct >= 80 && (
        <p className={`text-xs font-medium ${pct >= 90 ? 'text-red-500' : 'text-amber-600 dark:text-amber-400'}`}>
          {pct >= 90
            ? `⚠ Almacenamiento casi lleno (${pct.toFixed(0)}%). Agrega un storage pack para evitar interrupciones.`
            : `Estás usando el ${pct.toFixed(0)}% de tu almacenamiento.`}
        </p>
      )}
    </div>
  );
}

// ─── Badge de estado ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      <Icon name={cfg.icon} size={12} />
      {cfg.label}
    </span>
  );
}

// ─── Card de sección ──────────────────────────────────────────────────────────

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card p-6 ${className}`}
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
    >
      {children}
    </div>
  );
}

// ─── Feature chip ─────────────────────────────────────────────────────────────

function FeatureChip({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
        enabled
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
          : 'bg-muted text-muted-foreground line-through opacity-50'
      }`}
    >
      {label}
    </span>
  );
}

// ─── MetricCell ───────────────────────────────────────────────────────────────

function MetricCell({ label, value, iconName }: { label: string; value: string; iconName: IconName }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon name={iconName} size={12} />
        <span>{label}</span>
      </div>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

// ─── Storage Pack Row ─────────────────────────────────────────────────────────

function PackRow({
  pack, currentQty, isOwner, adding, removing, onAdd, onRemove,
}: {
  pack: StoragePack; currentQty: number; isOwner: boolean;
  adding: boolean; removing: boolean; onAdd: () => void; onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: '#1E4F7A10', color: '#1E4F7A' }}
          data-dark-style="background: #8FC4E810; color: #8FC4E8">
          <Icon name="hard-drive" size={16} />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{pack.name}</p>
          <p className="text-xs text-muted-foreground">+{pack.extraStorageGb} GB · {formatPrice(pack.price)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {currentQty > 0 && (
          <span className="rounded-full bg-capta-tint dark:bg-capta-soft/10 px-2 py-0.5 text-xs font-semibold text-capta-deep dark:text-capta-soft">
            ×{currentQty}
          </span>
        )}

        {isOwner && (
          <div className="flex items-center gap-1">
            {currentQty > 0 && (
              <button
                onClick={onRemove}
                disabled={removing || adding}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                aria-label="Quitar pack"
              >
                {removing
                  ? <Icon name="refresh" size={13} className="animate-spin" />
                  : <Icon name="minus" size={13} />}
              </button>
            )}
            <button
              onClick={onAdd}
              disabled={removing || adding}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:border-capta-deep/30 hover:bg-capta-tint hover:text-capta-deep disabled:cursor-not-allowed disabled:opacity-50 dark:hover:border-capta-soft/30 dark:hover:bg-capta-soft/10 dark:hover:text-capta-soft"
              aria-label="Agregar pack"
            >
              {adding
                ? <Icon name="refresh" size={13} className="animate-spin" />
                : <Icon name="plus" size={13} />}
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
  const [subscription,   setSubscription]   = useState<SubscriptionData | null>(null);
  const [availablePacks, setAvailablePacks] = useState<StoragePack[]>([]);
  const [userRole,       setUserRole]       = useState<string>('');
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading,   setPortalLoading]   = useState(false);
  const [packLoading,     setPackLoading]      = useState<Record<string, 'adding' | 'removing' | null>>({});

  const isOwner = userRole === 'OWNER';

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [subRes, packsRes] = await Promise.all([
        api.get<SubscriptionData>('/subscriptions/me'),
        api.get<StoragePack[]>('/subscriptions/storage-packs'),
      ]);
      setSubscription(subRes.data);
      setAvailablePacks(packsRes.data);
    } catch {
      setError('No se pudo cargar la información de suscripción.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const parsed = JSON.parse(raw) as { role: string };
        setUserRole(parsed.role ?? '');
      }
    } catch { /* ignorar */ }

    fetchData();
  }, [fetchData]);

  const handleChangePlan = async () => {
    if (!subscription) return;
    setCheckoutLoading(true);
    try {
      const { data } = await api.post<{ url: string }>('/subscriptions/checkout', {
        planType: subscription.plan.type === 'FREE' ? 'BUSINESS' : 'ENTERPRISE',
      });
      window.location.href = data.url;
    } catch {
      toastError('No se pudo iniciar el proceso de cambio de plan.', 'Asegúrate de tener Stripe configurado.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const { data } = await api.post<{ url: string }>('/subscriptions/portal');
      window.open(data.url, '_blank');
    } catch {
      toastError('No se pudo abrir el portal de facturación.', 'Verifica que Stripe esté configurado.');
    } finally {
      setPortalLoading(false);
    }
  };

  const handleAddPack = async (packId: string) => {
    setPackLoading((prev) => ({ ...prev, [packId]: 'adding' }));
    try {
      await api.post('/subscriptions/storage-packs', { packId });
      await fetchData();
    } catch {
      toastError('No se pudo agregar el storage pack. Intenta de nuevo.');
    } finally {
      setPackLoading((prev) => ({ ...prev, [packId]: null }));
    }
  };

  const handleRemovePack = async (packId: string) => {
    setPackLoading((prev) => ({ ...prev, [packId]: 'removing' }));
    try {
      await api.delete(`/subscriptions/storage-packs/${packId}`);
      await fetchData();
    } catch {
      toastError('No se pudo quitar el storage pack. Intenta de nuevo.');
    } finally {
      setPackLoading((prev) => ({ ...prev, [packId]: null }));
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Icon name="refresh" size={24} className="animate-spin text-muted-foreground" />
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
            <button
              onClick={() => { setLoading(true); fetchData(); }}
              className="mt-1 flex items-center gap-1 text-sm underline-offset-2 hover:underline"
            >
              <Icon name="refresh" size={12} /> Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { plan, status, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, totalStorageGb, activeStoragePacks, usedStorageBytes } = subscription;

  const activePackQty: Record<string, number> = {};
  activeStoragePacks.forEach((p) => { activePackQty[p.id] = p.quantity; });

  const showStoragePacks = plan.type !== 'FREE';
  const totalStorageLabel = formatStorage(totalStorageGb);

  return (
    <div className="p-6 lg:p-8 space-y-6">

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

      {/* ── Alerta período de gracia ── */}
      {(status === 'PAST_DUE' || status === 'UNPAID') && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10"
        >
          <Icon name="alert-triangle" size={18} className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Pago pendiente</p>
            <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400/80">
              Tu suscripción tiene un pago vencido. Actualiza tu método de pago en el portal de facturación para evitar la suspensión del servicio.
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Alerta cancelación programada ── */}
      {cancelAtPeriodEnd && status === 'ACTIVE' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10"
        >
          <Icon name="alert-triangle" size={18} className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Cancelación programada</p>
            <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400/80">
              Tu plan se cancelará el {formatDate(currentPeriodEnd)}. Puedes reactivarlo desde el portal de facturación.
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Card del plan activo ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.05 }}
      >
        <SectionCard>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">

            <div className="flex items-start gap-4">
              <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${PLAN_GRADIENT[plan.type]} shadow-sm`}>
                <Icon name="credit-card" size={22} className="text-white" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-foreground">{plan.name}</h2>
                  <StatusBadge status={status} />
                </div>
                <p className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">
                  {formatPrice(plan.price)}
                </p>

                {currentPeriodStart && currentPeriodEnd && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon name="calendar" size={12} />
                    <span>Período: {formatDate(currentPeriodStart)} – {formatDate(currentPeriodEnd)}</span>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <FeatureChip label="Evaluaciones"  enabled={plan.hasEvaluations} />
                  <FeatureChip label="Certificados"  enabled={plan.hasCertificates} />
                  <FeatureChip label="Analíticas"    enabled={plan.hasAnalytics} />
                  <FeatureChip label="White-label"   enabled={plan.hasWhiteLabel} />
                  <FeatureChip label="API"           enabled={plan.hasApi} />
                </div>
              </div>
            </div>

            {isOwner && (
              <div className="flex flex-col gap-2 sm:flex-shrink-0">
                {plan.type !== 'ENTERPRISE' && (
                  <button
                    onClick={handleChangePlan}
                    disabled={checkoutLoading}
                    className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)', boxShadow: '0 2px 10px rgba(30,79,122,0.25)' }}
                  >
                    {checkoutLoading
                      ? <Icon name="refresh" size={14} className="animate-spin" />
                      : <Icon name="zap" size={14} />}
                    {plan.type === 'FREE' ? 'Actualizar plan' : 'Cambiar a Enterprise'}
                  </button>
                )}

                <button
                  onClick={handlePortal}
                  disabled={portalLoading || plan.type === 'FREE'}
                  className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  title={plan.type === 'FREE' ? 'Disponible en planes de pago' : undefined}
                >
                  {portalLoading
                    ? <Icon name="refresh" size={14} className="animate-spin" />
                    : <Icon name="external-link" size={14} />}
                  Portal de facturación
                </button>
              </div>
            )}
          </div>

          {/* ── Métricas del plan ── */}
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-border pt-5 sm:grid-cols-4">
            <MetricCell label="Almacenamiento total" value={totalStorageLabel}   iconName={totalStorageGb === -1 ? 'infinity' : 'hard-drive'} />
            <MetricCell label="Empresas"             value={plan.maxCompanies === -1 ? 'Ilimitadas' : String(plan.maxCompanies)} iconName="package" />
            <MetricCell label="Empleados"            value={plan.maxEmployees === -1 ? 'Ilimitados' : String(plan.maxEmployees)} iconName="users" />
            <MetricCell label="Almacenamiento base"  value={`${plan.storageGb} GB`} iconName="hard-drive" />
          </div>

          <StorageBar usedBytes={usedStorageBytes} totalGb={totalStorageGb} />
        </SectionCard>
      </motion.div>

      {/* ── Storage Add-ons ── */}
      {showStoragePacks && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.1 }}
        >
          <SectionCard>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Storage Add-ons</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Amplía tu capacidad de almacenamiento. Los cambios se reflejan en tu próxima factura.
                </p>
              </div>
              {activeStoragePacks.length > 0 && (
                <span className="rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  +{activeStoragePacks.reduce((sum, p) => sum + p.extraStorageGb * p.quantity, 0)} GB activos
                </span>
              )}
            </div>

            {availablePacks.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">No hay packs disponibles.</p>
            ) : (
              <div className="space-y-2">
                {availablePacks.map((pack) => (
                  <PackRow
                    key={pack.id}
                    pack={pack}
                    currentQty={activePackQty[pack.id] ?? 0}
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
                Solo el propietario puede gestionar los add-ons de almacenamiento.
              </p>
            )}
          </SectionCard>
        </motion.div>
      )}

      {/* ── Nota plan FREE ── */}
      {plan.type === 'FREE' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.1 }}
          className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center"
        >
          <Icon name="package" size={32} className="mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">Desbloquea más funciones</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Los planes Business y Enterprise incluyen evaluaciones, certificados, analíticas y storage add-ons.
          </p>
          {isOwner && (
            <button
              onClick={handleChangePlan}
              disabled={checkoutLoading}
              className="mt-4 mx-auto flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:scale-[1.02] disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)', boxShadow: '0 2px 10px rgba(30,79,122,0.25)' }}
            >
              {checkoutLoading
                ? <Icon name="refresh" size={14} className="animate-spin" />
                : <Icon name="zap" size={14} />}
              Ver planes
            </button>
          )}
        </motion.div>
      )}

    </div>
  );
}
