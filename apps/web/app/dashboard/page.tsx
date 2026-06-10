'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Icon } from '@/components/capta-icon';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserData {
  id: string;
  firstName: string;
  role: string;
  tenantSlug: string;
}

interface Course {
  status: string;
  enrollmentCount?: number;
}

interface Enrollment {
  id: string;
  status: string;
  progress: number;
  courseTotalLessons: number;
  courseTitle: string;
  courseThumbnailUrl?: string | null;
  courseId: string;
  completedLessons?: number;
  lessonProgress?: { completedAt: Date | null; lessonId: string; watchedSeconds: number | null }[];
}

interface PlanSummary {
  planName: string;
  planType: 'FREE' | 'BUSINESS' | 'ENTERPRISE';
  price: number;
  totalStorageGb: number;
  usedStorageBytes: number;
  nextBillingDate: string | null;
}

interface SubscriptionApiResponse {
  plan: { name: string; type: string; price: number };
  totalStorageGb: number;
  usedStorageBytes: number;
  currentPeriodEnd: string | null;
}

interface WeeklyData {
  labels:       string[];
  enrollments:  number[];
  completions:  number[];
  users:        number[];
  courses:      number[];
  certificates: number[];
}

type ActivityEventType = 'ENROLLMENT' | 'COMPLETION' | 'CERTIFICATE' | 'NEW_USER';

interface ActivityEvent {
  type:      ActivityEventType;
  id:        string;
  userName:  string;
  detail:    string | null;
  timestamp: string;
}

interface Certificate {
  id:            string;
  publicUuid:    string;
  recipientName: string;
  courseTitle:   string;
  tenantName:    string;
  issuedAt:      string;
  verifyUrl:     string;
}

// ─── Animation variants ───────────────────────────────────────────────────────

const container = { animate: { transition: { staggerChildren: 0.07 } } };
const item = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 28 } },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const DAYS_ES   = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function dateES() {
  const d = new Date();
  return `${DAYS_ES[d.getDay()]}, ${d.getDate()} de ${MONTHS_ES[d.getMonth()]}`;
}

function bytesToReadable(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatNextBilling(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long' }).format(new Date(iso));
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

/**
 * Acepta un array de 7 números reales del endpoint /analytics/weekly.
 * Si todos los valores son 0 renderiza una línea plana (refleja la realidad).
 */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max   = Math.max(...data);
  const min   = Math.min(...data);
  const range = max - min || 1;          // evitar división por cero
  const w = 76, h = 26;

  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((v - min) / range) * h * 0.75 - h * 0.08,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${w} ${h} L 0 ${h} Z`;
  const uid = color.replace(/[^a-zA-Z0-9]/g, '');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" className="opacity-70">
      <defs>
        <linearGradient id={`sg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.30" />
          <stop offset="100%" stopColor={color} stopOpacity="0"    />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#sg-${uid})`} />
      <path d={linePath} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, iconName, accent, loading, sparkData,
}: {
  label:      string;
  value:      string | number;
  iconName:   import('@/components/capta-icon').IconName;
  accent:     string;
  loading?:   boolean;
  sparkData?: number[];
}) {
  return (
    <motion.div
      variants={item}
      className="col-span-12 sm:col-span-6 lg:col-span-3 group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5"
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20"
        style={{ background: accent }}
      />

      <div
        className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl"
        style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}22` }}
      >
        <Icon name={iconName} size={16} />
      </div>

      <div className={`text-2xl font-semibold tracking-tight text-foreground ${loading ? 'opacity-30' : ''}`}>
        {loading ? '—' : value}
      </div>
      <div className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</div>

      {/* Sparkline real — solo cuando hay datos y no está cargando */}
      {sparkData && !loading && (
        <div className="mt-3 -mx-1">
          <Sparkline data={sparkData} color={accent} />
        </div>
      )}
    </motion.div>
  );
}

// ─── Onboarding Card (admin sin datos) ───────────────────────────────────────

const ONBOARDING_STEPS: { label: string; desc: string; href: string; icon: import('@/components/capta-icon').IconName; accent: string }[] = [
  { label: 'Crea tu primer curso',  desc: 'Añade lecciones de video, texto o archivo',   href: '/dashboard/courses/new',  icon: 'book-open',   accent: '#1E4F7A' },
  { label: 'Invita a tu equipo',    desc: 'Envía invitaciones por email a tus empleados', href: '/dashboard/users',         icon: 'user-plus',   accent: '#7FD1AE' },
  { label: 'Personaliza tu empresa', desc: 'Logo, colores y nombre de marca',             href: '/dashboard/settings',      icon: 'gear',        accent: '#8FC4E8' },
  { label: 'Revisa las analíticas', desc: 'Mide el progreso y tasa de completado',        href: '/dashboard/analytics',     icon: 'chart-bar',   accent: '#F59E0B' },
];

function OnboardingCard({
  publishedCourses, usersCount, tenantCustomized, totalEnrolled, onDismiss,
}: {
  publishedCourses:  number;
  usersCount:        number;
  tenantCustomized:  boolean;
  totalEnrolled:     number;
  onDismiss:         () => void;
}) {
  const stepDone = [
    publishedCourses > 0,
    usersCount > 1,
    tenantCustomized,
    totalEnrolled > 0,
  ];
  const doneCount = stepDone.filter(Boolean).length;

  return (
    <motion.div
      variants={item}
      className="col-span-12 overflow-hidden rounded-2xl border border-border bg-card"
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
    >
      {/* Header con barra de progreso */}
      <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Primeros pasos</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Configura tu plataforma en minutos · {doneCount}/{ONBOARDING_STEPS.length} completados
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Progress pill */}
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width:      `${(doneCount / ONBOARDING_STEPS.length) * 100}%`,
                  background: 'linear-gradient(90deg, #1E4F7A, #7FD1AE)',
                }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {Math.round((doneCount / ONBOARDING_STEPS.length) * 100)}%
            </span>
          </div>
          {/* Dismiss */}
          <button
            onClick={onDismiss}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground/40 transition-colors hover:bg-muted hover:text-muted-foreground"
            title="Ocultar"
          >
            <Icon name="close" size={12} />
          </button>
        </div>
      </div>

      {/* Steps grid */}
      <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        {ONBOARDING_STEPS.map((step, i) => {
          const done = stepDone[i];
          return (
            <Link
              key={step.href}
              href={step.href}
              className="group relative flex flex-col gap-3 bg-card p-5 transition-colors hover:bg-muted/40"
            >
              {/* Step number + icon */}
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
                  style={{
                    background: done ? '#7FD1AE20' : `${step.accent}15`,
                    color:      done ? '#16a34a' : step.accent,
                    border:     `1px solid ${done ? '#7FD1AE30' : `${step.accent}20`}`,
                  }}
                >
                  <Icon name={done ? 'check-circle' : step.icon} size={16} />
                </div>
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors duration-300"
                  style={{
                    background: done ? '#7FD1AE15' : 'var(--muted)',
                    color:      done ? '#16a34a' : 'var(--muted-foreground)',
                  }}
                >
                  {i + 1}
                </span>
              </div>

              {/* Text */}
              <div>
                <p className={`text-sm font-semibold leading-snug transition-colors duration-300 ${done ? 'line-through text-muted-foreground/60' : 'text-foreground'}`}>
                  {step.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground/70 leading-relaxed">{step.desc}</p>
              </div>

              {/* Arrow / done indicator */}
              {done ? (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-emerald-500/70">✓</span>
              ) : (
                <Icon
                  name="arrow-right"
                  size={13}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30 transition-transform duration-150 group-hover:translate-x-0.5"
                />
              )}
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Quick Action ─────────────────────────────────────────────────────────────

function QuickAction({
  href, label, desc, iconName, accent = '#1E4F7A',
}: {
  href:     string;
  label:    string;
  desc:     string;
  iconName: import('@/components/capta-icon').IconName;
  accent?:  string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2.5 rounded-xl border border-border bg-background p-4 transition-all hover:-translate-y-0.5 hover:border-capta-soft/40 hover:shadow-sm"
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl"
        style={{ background: `${accent}12`, color: accent, border: `1px solid ${accent}1A` }}
      >
        <Icon name={iconName} size={16} />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground/70">{desc}</p>
      </div>
    </Link>
  );
}

// ─── Activity Feed ────────────────────────────────────────────────────────────

const ACTIVITY_CFG: Record<ActivityEventType, {
  icon:    import('@/components/capta-icon').IconName;
  color:   string;
  label:   (user: string, detail: string | null) => string;
}> = {
  ENROLLMENT:  { icon: 'users',        color: '#1E4F7A', label: (u, d)  => `${u} se inscribió en "${d}"` },
  COMPLETION:  { icon: 'check-circle', color: '#16a34a', label: (u, d)  => `${u} completó "${d}"` },
  CERTIFICATE: { icon: 'certificate',  color: '#f59e0b', label: (u, d)  => `${u} obtuvo certificado de "${d}"` },
  NEW_USER:    { icon: 'user-plus',    color: '#8b5cf6', label: (u, _d) => `${u} se unió a la plataforma` },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60_000);
  if (min < 1)   return 'Ahora mismo';
  if (min < 60)  return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)    return `Hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)     return `Hace ${d}d`;
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(iso));
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({ data, loading }: { data: PlanSummary | null; loading: boolean }) {
  const usedGb   = data ? data.usedStorageBytes / (1024 * 1024 * 1024) : 0;
  const totalGb  = data?.totalStorageGb ?? 1;
  const unlimited = totalGb === -1;
  const pct      = unlimited ? 0 : Math.min(100, (usedGb / totalGb) * 100);
  const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#8FC4E8';

  const PLAN_LABEL: Record<string, string> = {
    FREE: 'Free', BUSINESS: 'Business', ENTERPRISE: 'Enterprise',
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 h-full"
      style={{ background: 'linear-gradient(150deg, #1E4F7A 0%, #0B2840 100%)' }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full opacity-15 blur-3xl"
        style={{ background: '#8FC4E8' }}
      />

      {/* Plan header */}
      <div className="mb-4 flex items-start justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">Plan actual</p>
        {!loading && data && (
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold text-white/90">
            {PLAN_LABEL[data.planType] ?? data.planType}
          </span>
        )}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-8 w-20 rounded bg-white/10" />
          <div className="h-3 w-32 rounded bg-white/10" />
        </div>
      ) : data ? (
        <>
          {/* Precio */}
          <div className="mb-0.5">
            {!data.price ? (
              <span className="text-2xl font-bold text-white">Gratis</span>
            ) : (
              <>
                <span className="text-3xl font-bold text-white">
                  ${data.price.toLocaleString('en-US')}
                </span>
                <span className="ml-1 text-sm font-normal text-white/50">/mes</span>
              </>
            )}
          </div>
          {data.nextBillingDate && (
            <p className="mb-4 text-[11px] text-white/35">
              Próxima factura el {formatNextBilling(data.nextBillingDate)}
            </p>
          )}

          {/* Barra de almacenamiento */}
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] text-white/50">Almacenamiento</span>
            <span className="text-[11px] font-medium text-white/80">
              {unlimited
                ? `${bytesToReadable(data.usedStorageBytes)} de Ilimitado`
                : `${bytesToReadable(data.usedStorageBytes)} de ${totalGb} GB`}
            </span>
          </div>
          {!unlimited && (
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${barColor}, ${barColor}CC)` }}
              />
            </div>
          )}

          {/* CTA */}
          <Link
            href="/dashboard/subscription"
            className="mt-4 block w-full rounded-xl border border-white/20 bg-white/10 py-2 text-center text-xs font-semibold text-white transition-all hover:bg-white/15 active:scale-[0.98]"
          >
            Gestionar plan →
          </Link>
        </>
      ) : (
        <p className="text-sm italic text-white/40">Sin datos de plan.</p>
      )}
    </div>
  );
}

// ─── Employee: Circular Progress ──────────────────────────────────────────────

function CircularProgress({ pct, size = 88, color = '#1E4F7A' }: {
  pct: number; size?: number; color?: string;
}) {
  const strokeW = 7;
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor"
        strokeWidth={strokeW} className="text-muted/50" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
        strokeWidth={strokeW} strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
    </svg>
  );
}

// ─── Employee: Continue Learning hero card ─────────────────────────────────────

function ContinueLearningCard({ enrollment }: { enrollment: Enrollment | null }) {
  if (!enrollment) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-10 text-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <Icon name="book-open" size={24} className="text-muted-foreground/30" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Sin cursos activos</p>
          <p className="mt-1 max-w-[200px] text-xs leading-relaxed text-muted-foreground/60">
            Inscríbete en un curso para comenzar tu aprendizaje.
          </p>
        </div>
        <Link
          href="/dashboard/courses"
          className="mt-1 flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all hover:scale-[1.03]"
          style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)', boxShadow: '0 2px 10px rgba(30,79,122,0.25)' }}
        >
          <Icon name="search" size={13} /> Explorar cursos
        </Link>
      </div>
    );
  }

  const completed  = enrollment.lessonProgress?.filter((p: { completedAt: Date | null }) => p.completedAt).length ?? 0;
  const total      = enrollment.courseTotalLessons ?? 0;
  const pct        = enrollment.progress ?? 0;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Thumbnail + info */}
      <div className="flex gap-4 items-start">
        <div
          className="relative flex-shrink-0 h-20 w-28 rounded-xl overflow-hidden bg-muted"
        >
          {enrollment.courseThumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={enrollment.courseThumbnailUrl} alt={enrollment.courseTitle}
              className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Icon name="book-open" size={24} className="text-muted-foreground/30" />
            </div>
          )}
          {/* overlay badge */}
          <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5">
            <span className="text-[10px] font-bold text-white">{pct}%</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-capta-deep dark:text-capta-soft mb-1">
            Continuar aprendiendo
          </p>
          <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
            {enrollment.courseTitle}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {completed} de {total} lecciones completadas
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Progreso del curso</span>
          <span className="text-xs font-bold" style={{ color: '#7FD1AE' }}>{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #1F5C4D, #7FD1AE)' }}
          />
        </div>
      </div>

      {/* CTA */}
      <Link
        href={`/dashboard/courses/${enrollment.courseId}/learn`}
        className="mt-auto flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition-all hover:scale-[1.02] hover:shadow-md active:scale-[0.97]"
        style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)', boxShadow: '0 2px 10px rgba(30,79,122,0.22)' }}
      >
        <Icon name="play" size={15} />
        {pct === 0 ? 'Comenzar curso' : 'Continuar curso'}
      </Link>
    </div>
  );
}

// ─── Employee: My Certificates panel ──────────────────────────────────────────

function MyCertificatesPanel({ certs, loading }: { certs: Certificate[]; loading: boolean }) {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';
  const [copied, setCopied] = useState<string | null>(null);

  // Endpoint público por UUID — no requiere autenticación
  function publicDownloadUrl(publicUuid: string) {
    return `${API_BASE}/certificates/verify/${publicUuid}/download`;
  }

  function handleShare(cert: Certificate) {
    navigator.clipboard.writeText(cert.verifyUrl).then(() => {
      setCopied(cert.id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="animate-pulse rounded-xl border border-border bg-muted/30 p-3 space-y-2">
            <div className="h-3 w-3/4 rounded bg-muted" />
            <div className="h-2.5 w-1/2 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (certs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-muted">
          <Icon name="certificate" size={18} className="text-muted-foreground/30" />
        </div>
        <p className="text-xs font-medium text-muted-foreground">Sin certificados aún</p>
        <p className="mt-1 max-w-[160px] text-[11px] leading-relaxed text-muted-foreground/60">
          Completa un curso para obtener tu primer certificado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {certs.map(cert => (
        <div
          key={cert.id}
          className="group relative overflow-hidden rounded-xl border border-border bg-background p-3 transition-all hover:border-amber-300/40 hover:shadow-sm"
        >
          {/* Gold accent left */}
          <div className="absolute left-0 top-0 h-full w-0.5 rounded-l-xl bg-amber-400/50" />

          <div className="pl-2">
            <p className="text-xs font-semibold text-foreground leading-snug line-clamp-2">
              {cert.courseTitle}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(cert.issuedAt))}
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              {/* Descarga directa — sin pasos previos (el UUID es verificación implícita) */}
              <a
                href={publicDownloadUrl(cert.publicUuid)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold text-white transition-all hover:scale-[1.04]"
                style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' }}
              >
                <Icon name="download" size={10} /> Descargar PDF
              </a>
              {/* Compartir — copia URL de verificación pública al portapapeles */}
              <button
                onClick={() => handleShare(cert)}
                title="Copiar enlace de verificación"
                className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-all hover:text-foreground hover:bg-muted"
              >
                {copied === cert.id ? (
                  <><Icon name="check" size={10} className="text-emerald-500" /> Copiado</>
                ) : (
                  <><Icon name="external" size={10} /> Compartir</>
                )}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Employee: All Courses grid ────────────────────────────────────────────────

function CourseCard({ enrollment }: { enrollment: Enrollment }) {
  const statusColor = enrollment.status === 'COMPLETED' ? '#16a34a' : '#1E4F7A';
  const statusLabel = enrollment.status === 'COMPLETED' ? 'Completado' : enrollment.progress > 0 ? 'En progreso' : 'Sin comenzar';

  return (
    <Link
      href={`/dashboard/courses/${enrollment.courseId}/learn`}
      className="group flex flex-col gap-0 overflow-hidden rounded-xl border border-border bg-background transition-all hover:-translate-y-0.5 hover:border-capta-soft/30 hover:shadow-md"
    >
      {/* Thumbnail */}
      <div className="relative h-24 w-full overflow-hidden bg-muted">
        {enrollment.courseThumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={enrollment.courseThumbnailUrl} alt={enrollment.courseTitle}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Icon name="book-open" size={28} className="text-muted-foreground/20" />
          </div>
        )}
        {/* Status badge */}
        <div
          className="absolute right-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
          style={{ background: `${statusColor}CC` }}
        >
          {enrollment.status === 'COMPLETED' && <Icon name="check" size={9} />}
          {statusLabel}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 p-3">
        <p className="text-xs font-semibold text-foreground leading-snug line-clamp-2 mb-2">
          {enrollment.courseTitle}
        </p>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {enrollment.completedLessons ?? 0}/{enrollment.courseTotalLessons ?? 0} lecciones
            </span>
            <span className="text-[10px] font-bold" style={{ color: enrollment.status === 'COMPLETED' ? '#16a34a' : '#8FC4E8' }}>
              {enrollment.progress}%
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width:      `${enrollment.progress}%`,
                background: enrollment.status === 'COMPLETED'
                  ? 'linear-gradient(90deg, #16a34a, #4ade80)'
                  : 'linear-gradient(90deg, #1F5C4D, #7FD1AE)',
              }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [user,             setUser]        = useState<UserData | null>(null);
  const [loading,          setLoading]     = useState(true);
  const [usersCount,       setUsersCount]  = useState(0);
  const [publishedCourses, setPublished]   = useState(0);
  const [totalEnrolled,    setEnrolled]    = useState(0);
  const [totalCerts,       setTotalCerts]  = useState<number | null>(null);
  const [enrollments,      setEnrollments] = useState<Enrollment[]>([]);
  const [planData,           setPlanData]        = useState<PlanSummary | null>(null);
  const [planLoading,        setPlanLoading]      = useState(false);
  const [weekly,             setWeekly]           = useState<WeeklyData | null>(null);
  const [activity,           setActivity]         = useState<ActivityEvent[] | null>(null);
  const [activityLoading,    setActivityLoading]  = useState(false);
  const [certificates,       setCertificates]     = useState<Certificate[]>([]);
  const [certLoading,        setCertLoading]      = useState(false);
  const [tenantCustomized,   setTenantCustomized] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) { setLoading(false); return; }

      const u = JSON.parse(raw) as UserData;
      setUser(u);

      // Onboarding: leer estado desde localStorage
      setOnboardingDismissed(!!localStorage.getItem('onboarding_dismissed'));
      const savedLogo  = localStorage.getItem('tenant_logo') || '';
      const savedColor = localStorage.getItem('tenant_color') || '';
      setTenantCustomized(!!savedLogo || !!savedColor);

      const isAdmin = ['OWNER', 'ADMIN', 'MANAGER'].includes(u.role);

      if (isAdmin) {
        Promise.all([
          api.get<{ data: unknown[]; total: number }>('/users').catch(() => ({ data: { data: [], total: 0 } })),
          api.get<Course[]>('/courses').catch(() => ({ data: [] })),
          api.get<{ totalCertificates: number }>('/analytics/overview').catch(() => ({ data: { totalCertificates: 0 } })),
          api.get<WeeklyData>('/analytics/weekly').catch(() => ({ data: null })),
        ]).then(([usersRes, coursesRes, overviewRes, weeklyRes]) => {
          setUsersCount(usersRes.data.total ?? 0);
          setPublished(coursesRes.data.filter(c => c.status === 'PUBLISHED').length);
          setEnrolled(coursesRes.data.reduce((s, c) => s + (c.enrollmentCount ?? 0), 0));
          setTotalCerts(overviewRes.data.totalCertificates ?? 0);
          setWeekly(weeklyRes.data);
        }).finally(() => setLoading(false));

        // Actividad reciente — fetch independiente para no bloquear los stats
        setActivityLoading(true);
        api.get<ActivityEvent[]>('/analytics/activity')
          .then(res => setActivity(res.data))
          .catch(() => setActivity([]))
          .finally(() => setActivityLoading(false));

        // Suscripción — solo para OWNER
        if (u.role === 'OWNER') {
          setPlanLoading(true);
          api.get<SubscriptionApiResponse>('/subscriptions/me')
            .then(res => setPlanData({
              planName:         res.data.plan.name,
              planType:         res.data.plan.type as PlanSummary['planType'],
              price:            res.data.plan.price,
              totalStorageGb:   res.data.totalStorageGb,
              usedStorageBytes: res.data.usedStorageBytes,
              nextBillingDate:  res.data.currentPeriodEnd,
            }))
            .catch(() => {})
            .finally(() => setPlanLoading(false));
        }
      } else {
        api.get<Enrollment[]>('/enrollments/my')
          .then(res => setEnrollments(res.data))
          .catch(() => {})
          .finally(() => setLoading(false));

        setCertLoading(true);
        api.get<Certificate[]>('/certificates/my')
          .then(res => setCertificates(res.data))
          .catch(() => setCertificates([]))
          .finally(() => setCertLoading(false));
      }
    } catch { setLoading(false); }
  }, []);

  const isAdmin    = user ? ['OWNER', 'ADMIN', 'MANAGER'].includes(user.role) : false;
  const isOwner    = user?.role === 'OWNER';

  const allOnboardingDone = publishedCourses > 0 && usersCount > 1 && tenantCustomized && totalEnrolled > 0;
  const handleDismissOnboarding = () => {
    localStorage.setItem('onboarding_dismissed', '1');
    setOnboardingDismissed(true);
  };
  const inProgress = enrollments.filter(e => e.status === 'ACTIVE' && e.progress > 0 && e.progress < 100).length;
  const completed  = enrollments.filter(e => e.status === 'COMPLETED').length;
  const notStarted = enrollments.filter(e => e.progress === 0).length;
  const topCourses = enrollments
    .filter(e => e.status === 'ACTIVE' && e.progress > 0)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 4);

  return (
    <div className="p-6 lg:p-8">

      {/* ── Page header ── */}
      <div className="mb-8">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/40">
          {dateES()}
        </p>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {greeting()},{' '}
              <span className="text-capta-deep dark:text-capta-soft">
                {user?.firstName ?? '…'}
              </span>
            </h1>
            {isAdmin ? (
              <p className="mt-1.5 text-sm text-muted-foreground/70">
                Resumen general · {usersCount > 0 ? `${usersCount} colaboradores activos` : 'Cargando…'}
              </p>
            ) : (
              <p className="mt-1.5 text-sm text-muted-foreground/70">Tu progreso de hoy.</p>
            )}
          </div>

          {isAdmin && (
            <Link
              href="/dashboard/analytics"
              className="hidden sm:flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:border-capta-deep/20 hover:bg-muted hover:text-foreground"
            >
              <Icon name="chart-bar" size={14} />
              Analíticas
            </Link>
          )}
        </div>
      </div>

      {/* ── Bento grid ── */}
      <motion.div
        className="grid grid-cols-12 gap-4"
        variants={container}
        initial="initial"
        animate="animate"
      >

        {/* ── Stat cards ── */}
        {isAdmin ? (
          <>
            <StatCard
              label="Usuarios registrados"
              value={usersCount}
              iconName="users"
              accent="#1E4F7A"
              loading={loading}
              sparkData={weekly?.users}
            />
            <StatCard
              label="Cursos publicados"
              value={publishedCourses}
              iconName="book-open"
              accent="#7FD1AE"
              loading={loading}
              sparkData={weekly?.courses}
            />
            <StatCard
              label="Total inscripciones"
              value={totalEnrolled}
              iconName="chart-line"
              accent="#8FC4E8"
              loading={loading}
              sparkData={weekly?.enrollments}
            />
            <StatCard
              label="Certificados emitidos"
              value={totalCerts ?? '—'}
              iconName="certificate"
              accent="#F59E0B"
              loading={loading && totalCerts === null}
              sparkData={weekly?.certificates}
            />
          </>
        ) : (
          <>
            <StatCard label="Cursos inscritos" value={enrollments.length}                              iconName="book-open"   accent="#1E4F7A" loading={loading} />
            <StatCard label="En progreso"      value={inProgress}                                  iconName="play"        accent="#7FD1AE" loading={loading} />
            <StatCard label="Completados"      value={completed}                                   iconName="check"       accent="#8FC4E8" loading={loading} />
            <StatCard label="Certificados"     value={certLoading ? '—' : certificates.length}    iconName="certificate" accent="#F59E0B" loading={loading && certLoading} />
          </>
        )}

        {/* ── Admin: Onboarding (visible hasta completar todos los pasos o descartarlo) ── */}
        {isAdmin && !loading && !allOnboardingDone && !onboardingDismissed && (
          <OnboardingCard
            publishedCourses={publishedCourses}
            usersCount={usersCount}
            tenantCustomized={tenantCustomized}
            totalEnrolled={totalEnrolled}
            onDismiss={handleDismissOnboarding}
          />
        )}

        {/* ── Admin: Acciones + Plan card (OWNER) ── */}
        {isAdmin && (
          <>
            {/* Acciones rápidas */}
            <motion.div
              variants={item}
              className={`col-span-12 ${isOwner ? 'lg:col-span-8' : ''} rounded-2xl border border-border bg-card p-5`}
              style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
            >
              <h2 className="mb-4 text-sm font-semibold text-foreground">Acciones rápidas</h2>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                <QuickAction href="/dashboard/courses/new" label="Crear curso"      desc="Video, PDF o quiz"       iconName="plus"        accent="#1E4F7A" />
                <QuickAction href="/dashboard/users"       label="Invitar personas" desc="Email o SSO"             iconName="user-plus"   accent="#7FD1AE" />
                <QuickAction href="/dashboard/analytics"   label="Ver analíticas"   desc="Progreso del equipo"     iconName="chart-bar"   accent="#8FC4E8" />
                <QuickAction href="/dashboard/subscription" label="Facturación"     desc="Plan y almacenamiento"   iconName="credit-card" accent="#F59E0B" />
              </div>
            </motion.div>

            {/* Plan card — solo OWNER */}
            {isOwner && (
              <motion.div variants={item} className="col-span-12 lg:col-span-4">
                <PlanCard data={planData} loading={planLoading} />
              </motion.div>
            )}

            {/* Actividad reciente */}
            <motion.div
              variants={item}
              className="col-span-12 overflow-hidden rounded-2xl border border-border bg-card"
              style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="text-sm font-semibold text-foreground">Actividad reciente</h2>
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-500">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  En vivo
                </span>
              </div>

              {/* Contenido */}
              {activityLoading ? (
                /* Skeleton */
                <div className="divide-y divide-border/60">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-5 py-3.5 animate-pulse">
                      <div className="h-8 w-8 flex-shrink-0 rounded-xl bg-muted" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-3/4 rounded bg-muted" />
                        <div className="h-2.5 w-1/3 rounded bg-muted" />
                      </div>
                      <div className="h-2.5 w-12 rounded bg-muted" />
                    </div>
                  ))}
                </div>
              ) : !activity || activity.length === 0 ? (
                /* Empty state */
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-muted">
                    <Icon name="clock" size={20} className="text-muted-foreground/30" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Sin actividad en los últimos 30 días</p>
                  <p className="mt-1 max-w-[220px] text-xs leading-relaxed text-muted-foreground/60">
                    Aparecerá aquí cuando tu equipo comience a capacitarse.
                  </p>
                </div>
              ) : (
                /* Feed */
                <div className="divide-y divide-border/60">
                  {activity.map((event, i) => {
                    const cfg = ACTIVITY_CFG[event.type];
                    return (
                      <div
                        key={event.id}
                        className="flex items-center gap-3.5 px-5 py-3 transition-colors hover:bg-muted/30"
                      >
                        {/* Ícono del tipo */}
                        <div
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl"
                          style={{ background: `${cfg.color}14`, color: cfg.color }}
                        >
                          <Icon name={cfg.icon} size={14} />
                        </div>

                        {/* Texto */}
                        <p className="flex-1 min-w-0 text-xs text-foreground leading-relaxed">
                          <span className="font-semibold">{event.userName}</span>
                          {event.type === 'ENROLLMENT'  && <> se inscribió en </>}
                          {event.type === 'COMPLETION'  && <> completó </>}
                          {event.type === 'CERTIFICATE' && <> obtuvo certificado de </>}
                          {event.type === 'NEW_USER'    && <span className="text-muted-foreground"> se unió a la plataforma</span>}
                          {event.detail && (
                            <span className="font-medium text-foreground/80">"{event.detail}"</span>
                          )}
                        </p>

                        {/* Timestamp */}
                        <span className="flex-shrink-0 text-[10px] tabular-nums text-muted-foreground/50">
                          {relativeTime(event.timestamp)}
                        </span>

                        {/* Dot de color tipo */}
                        <div
                          className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                          style={{ background: cfg.color }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </>
        )}

        {/* ── Employee: Continuar aprendiendo + Certificados ── */}
        {!isAdmin && (
          <>
            {/* Continuar aprendiendo */}
            <motion.div
              variants={item}
              className="col-span-12 lg:col-span-7 rounded-2xl border border-border bg-card p-5"
              style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
            >
              <ContinueLearningCard
                enrollment={
                  // Prioridad: más avanzado y activo → sin comenzar → null
                  enrollments.find(e => e.status === 'ACTIVE' && e.progress > 0)
                  ?? enrollments.find(e => e.status === 'ACTIVE' && e.progress === 0)
                  ?? null
                }
              />
            </motion.div>

            {/* Mis certificados */}
            <motion.div
              variants={item}
              className="col-span-12 lg:col-span-5 rounded-2xl border border-border bg-card p-5"
              style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Mis certificados</h2>
                {certificates.length > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                    {certificates.length}
                  </span>
                )}
              </div>
              <MyCertificatesPanel certs={certificates} loading={certLoading} />
            </motion.div>

            {/* Cursos activos (excluye completados — esos se ven en certificados) */}
            {(() => {
              const activeEnrollments = enrollments.filter(e => e.status === 'ACTIVE');
              return activeEnrollments.length > 0 ? (
                <motion.div
                  variants={item}
                  className="col-span-12 rounded-2xl border border-border bg-card p-5"
                  style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground">Mis cursos activos</h2>
                    <Link
                      href="/dashboard/courses"
                      className="flex items-center gap-1 text-xs font-semibold text-capta-deep dark:text-capta-soft hover:opacity-70 transition-opacity"
                    >
                      Explorar más <Icon name="arrow-right" size={11} />
                    </Link>
                  </div>

                  {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="animate-pulse rounded-xl border border-border bg-muted/30">
                          <div className="h-24 rounded-t-xl bg-muted" />
                          <div className="p-3 space-y-2">
                            <div className="h-3 w-3/4 rounded bg-muted" />
                            <div className="h-2 w-full rounded bg-muted" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {activeEnrollments.map(e => (
                        <CourseCard key={e.courseId} enrollment={e} />
                      ))}
                    </div>
                  )}
                </motion.div>
              ) : null;
            })()}
          </>
        )}

      </motion.div>
    </div>
  );
}
