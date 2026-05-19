'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  BookOpen,
  CheckCircle2,
  Award,
  ArrowRight,
  Clock,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface UserData {
  firstName: string;
  role: string;
  tenantSlug: string;
}

// ─── Datos de stats ───────────────────────────────────────────────────────────

const STAT_CARDS = [
  {
    label:     'Empleados activos',
    value:     '—',
    icon:      Users,
    iconBg:    'bg-sky/10 dark:bg-sky/5',
    iconColor: 'text-sky',
  },
  {
    label:     'Cursos activos',
    value:     '—',
    icon:      BookOpen,
    iconBg:    'bg-navy/10 dark:bg-sky/10',
    iconColor: 'text-navy dark:text-sky',
  },
  {
    label:     'Completados',
    value:     '—',
    icon:      CheckCircle2,
    iconBg:    'bg-teal/10 dark:bg-teal/5',
    iconColor: 'text-teal',
  },
  {
    label:     'Certificados emitidos',
    value:     '—',
    icon:      Award,
    iconBg:    'bg-amber-50 dark:bg-amber-900/10',
    iconColor: 'text-amber-500',
  },
] as const;

const QUICK_ACTIONS = [
  {
    label: 'Crear nuevo curso',
    desc:  'Sube contenido y asigna empleados',
    icon:  BookOpen,
    href:  '/dashboard/courses/new',
  },
  {
    label: 'Invitar empleados',
    desc:  'Agrega miembros a tu empresa',
    icon:  Users,
    href:  '/dashboard/users/invite',
  },
] as const;

// ─── Variantes de animación ───────────────────────────────────────────────────

const listContainer = {
  animate: { transition: { staggerChildren: 0.07 } },
};

const listItem = {
  initial:  { opacity: 0, y: 14 },
  animate:  {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// ─── Componentes ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
}: (typeof STAT_CARDS)[number]) {
  return (
    <motion.div
      variants={listItem}
      className="col-span-12 sm:col-span-6 lg:col-span-3 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
        <Icon size={20} className={iconColor} />
      </div>
      <div className="text-3xl font-bold tracking-tight text-foreground">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </motion.div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

/**
 * Home del dashboard — Bento Grid con:
 *  · 4 stat cards (empleados, cursos, completados, certificados)
 *  · Acciones rápidas (crear curso, invitar empleados)
 *  · Panel de actividad reciente (vacío hasta que haya datos reales)
 *
 * Los valores "—" se reemplazarán con datos reales cuando CoursesModule,
 * EnrollmentsModule y UsersModule estén completos.
 */
export default function DashboardPage() {
  const [user, setUser] = useState<UserData | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) setUser(JSON.parse(raw) as UserData);
    } catch {
      // silent
    }
  }, []);

  return (
    <div className="p-6 lg:p-8">

      {/* ── Encabezado de página ── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {greeting()}, {user?.firstName ?? '…'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aquí tienes el resumen de tu plataforma.
        </p>
      </div>

      {/* ── Bento Grid ── */}
      <motion.div
        className="grid grid-cols-12 gap-4"
        variants={listContainer}
        initial="initial"
        animate="animate"
      >
        {/* Stats */}
        {STAT_CARDS.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}

        {/* Acciones rápidas — span 8 */}
        <motion.div
          variants={listItem}
          className="col-span-12 lg:col-span-8 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <h2 className="mb-4 text-sm font-semibold text-foreground">Acciones rápidas</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {QUICK_ACTIONS.map(({ label, desc, icon: Icon, href }) => (
              <a
                key={label}
                href={href}
                className="group flex items-center gap-4 rounded-xl border border-border bg-background p-4 transition-all hover:border-navy/20 hover:bg-muted dark:hover:border-sky/20"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-navy/5 dark:bg-sky/5">
                  <Icon size={18} className="text-navy dark:text-sky" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <ArrowRight
                  size={14}
                  className="flex-shrink-0 text-muted-foreground/30 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-muted-foreground/60"
                />
              </a>
            ))}
          </div>
        </motion.div>

        {/* Actividad reciente — span 4 */}
        <motion.div
          variants={listItem}
          className="col-span-12 lg:col-span-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <h2 className="mb-4 text-sm font-semibold text-foreground">Actividad reciente</h2>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Clock size={22} className="text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Sin actividad aún</p>
            <p className="mt-1 max-w-[180px] text-xs leading-relaxed text-muted-foreground">
              Aparecerá aquí cuando tus empleados comiencen a usar la plataforma.
            </p>
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
}
