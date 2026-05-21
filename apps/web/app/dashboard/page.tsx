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
  status: string;
  progress: number;
  courseTotalLessons: number;
  courseTitle: string;
  courseThumbnailUrl?: string | null;
  courseId: string;
}

// ─── Animation variants ───────────────────────────────────────────────────────

const container = { animate: { transition: { staggerChildren: 0.08 } } };
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

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, iconName, accent, loading }: {
  label: string;
  value: string | number;
  iconName: import('@/components/capta-icon').IconName;
  accent: string;
  loading?: boolean;
}) {
  return (
    <motion.div
      variants={item}
      className="col-span-12 sm:col-span-6 lg:col-span-3 group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5"
      style={{
        boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)',
      }}
    >
      {/* Accent glow en hover */}
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20"
        style={{ background: accent }}
      />

      {/* Ícono */}
      <div
        className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-xl"
        style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}22` }}
      >
        <Icon name={iconName} size={16} />
      </div>

      <div className={`text-2xl font-semibold tracking-tight text-foreground ${loading ? 'animate-pulse-soft opacity-40' : ''}`}>
        {loading ? '—' : value}
      </div>
      <div className="mt-1 text-xs font-medium text-muted-foreground">{label}</div>
    </motion.div>
  );
}

// ─── Quick action ─────────────────────────────────────────────────────────────

function QuickAction({ href, label, desc, iconName, accent = '#1E4F7A' }: {
  href: string;
  label: string;
  desc: string;
  iconName: import('@/components/capta-icon').IconName;
  accent?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border border-border bg-background p-4 transition-all hover:-translate-y-0.5 hover:border-capta-soft/40 hover:shadow-sm"
    >
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-all"
        style={{ background: `${accent}12`, color: accent, border: `1px solid ${accent}18` }}
      >
        <Icon name={iconName} size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground/70">{desc}</p>
      </div>
      <Icon name="arrow-right" size={14} className="flex-shrink-0 text-muted-foreground/25 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-muted-foreground/60" />
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
  const [enrollments,      setEnrollments] = useState<Enrollment[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) { setLoading(false); return; }

      const u = JSON.parse(raw) as UserData;
      setUser(u);
      const isAdmin = ['OWNER', 'ADMIN', 'MANAGER'].includes(u.role);

      if (isAdmin) {
        Promise.all([
          api.get<{ data: unknown[]; total: number }>('/users').catch(() => ({ data: { data: [], total: 0 } })),
          api.get<Course[]>('/courses').catch(() => ({ data: [] })),
        ]).then(([usersRes, coursesRes]) => {
          setUsersCount(usersRes.data.total ?? 0);
          setPublished(coursesRes.data.filter(c => c.status === 'PUBLISHED').length);
          setEnrolled(coursesRes.data.reduce((s, c) => s + (c.enrollmentCount ?? 0), 0));
        }).finally(() => setLoading(false));
      } else {
        api.get<Enrollment[]>('/enrollments/my')
          .then(res => setEnrollments(res.data))
          .catch(() => {})
          .finally(() => setLoading(false));
      }
    } catch { setLoading(false); }
  }, []);

  const isAdmin      = user ? ['OWNER', 'ADMIN', 'MANAGER'].includes(user.role) : false;
  const inProgress   = enrollments.filter(e => e.status === 'ACTIVE' && e.progress > 0 && e.progress < 100).length;
  const completed    = enrollments.filter(e => e.status === 'COMPLETED').length;
  const notStarted   = enrollments.filter(e => e.progress === 0).length;
  const topCourses   = enrollments
    .filter(e => e.status === 'ACTIVE' && e.progress > 0)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 4);

  return (
    <div className="p-6 lg:p-8">

      {/* ── Header ── */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {greeting()}, {user?.firstName ?? '…'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin ? 'Resumen general de tu plataforma.' : 'Tu progreso de hoy.'}
          </p>
        </div>

        {isAdmin && (
          <Link
            href="/dashboard/courses/new"
            className="hidden sm:flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.03] hover:shadow-md active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)', boxShadow: '0 2px 10px rgba(30,79,122,0.25)' }}
          >
            <Icon name="plus" size={15} />
            Nuevo curso
          </Link>
        )}
      </div>

      {/* ── Grid ── */}
      <motion.div
        className="grid grid-cols-12 gap-4"
        variants={container}
        initial="initial"
        animate="animate"
      >

        {/* Stat cards */}
        {isAdmin ? (
          <>
            <StatCard label="Usuarios activos"     value={usersCount}        iconName="users"       accent="#1E4F7A"  loading={loading} />
            <StatCard label="Cursos publicados"     value={publishedCourses}  iconName="book-open"   accent="#7FD1AE"  loading={loading} />
            <StatCard label="Total inscripciones"   value={totalEnrolled}     iconName="chart-line"  accent="#8FC4E8"  loading={loading} />
            <StatCard label="Certificados emitidos" value="—"                 iconName="certificate" accent="#F59E0B"  loading={false}   />
          </>
        ) : (
          <>
            <StatCard label="Cursos inscritos" value={enrollments.length} iconName="book-open"   accent="#1E4F7A"  loading={loading} />
            <StatCard label="En progreso"      value={inProgress}         iconName="play"        accent="#7FD1AE"  loading={loading} />
            <StatCard label="Completados"      value={completed}          iconName="check"       accent="#8FC4E8"  loading={loading} />
            <StatCard label="Sin comenzar"     value={notStarted}         iconName="clock"       accent="#F59E0B"  loading={loading} />
          </>
        )}

        {/* Acciones rápidas */}
        <motion.div
          variants={item}
          className="col-span-12 lg:col-span-8 rounded-2xl border border-border bg-card p-5"
          style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
        >
          <h2 className="mb-4 text-sm font-semibold text-foreground">Acciones rápidas</h2>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {isAdmin ? (
              <>
                <QuickAction href="/dashboard/courses/new" label="Crear nuevo curso"  desc="Sube contenido y asigna empleados"    iconName="plus"       accent="#1E4F7A" />
                <QuickAction href="/dashboard/users"       label="Gestionar usuarios" desc="Invita, edita roles y accesos"        iconName="users"      accent="#7FD1AE" />
                <QuickAction href="/dashboard/courses"     label="Ver catálogo"       desc="Administra todos los cursos"          iconName="book-open"  accent="#8FC4E8" />
                <QuickAction href="/dashboard/analytics"  label="Ver analíticas"     desc="Progreso y métricas del equipo"       iconName="chart-bar"  accent="#F59E0B" />
              </>
            ) : (
              <>
                <QuickAction href="/dashboard/courses" label="Explorar cursos"       desc="Descubre nuevos cursos disponibles"  iconName="search"  accent="#1E4F7A" />
                <QuickAction href="/dashboard/courses" label="Continuar aprendiendo" desc="Retoma donde lo dejaste"            iconName="play"    accent="#7FD1AE" />
              </>
            )}
          </div>
        </motion.div>

        {/* Panel lateral */}
        <motion.div
          variants={item}
          className="col-span-12 lg:col-span-4 rounded-2xl border border-border bg-card p-5"
          style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
        >
          {isAdmin ? (
            <>
              <h2 className="mb-4 text-sm font-semibold text-foreground">Actividad reciente</h2>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-muted">
                  <Icon name="clock" size={20} className="text-muted-foreground/30" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Sin actividad aún</p>
                <p className="mt-1 max-w-[160px] text-xs leading-relaxed text-muted-foreground/60">
                  Aparecerá aquí cuando tu equipo comience a capacitarse.
                </p>
              </div>
            </>
          ) : topCourses.length > 0 ? (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Mis cursos</h2>
                <Link
                  href="/dashboard/courses"
                  className="text-xs font-semibold text-capta-deep hover:text-capta-deep/70 dark:text-capta-soft dark:hover:text-capta-soft/70 transition-colors"
                >
                  Ver todos
                </Link>
              </div>
              <div className="space-y-2.5">
                {topCourses.map(e => (
                  <Link
                    key={e.courseId}
                    href={`/dashboard/courses/${e.courseId}/learn`}
                    className="group flex flex-col gap-2 rounded-xl border border-border bg-background p-3 transition-all hover:border-capta-soft/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-semibold text-foreground">{e.courseTitle}</p>
                      <span className="flex-shrink-0 text-xs font-bold" style={{ color: '#7FD1AE' }}>
                        {e.progress}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${e.progress}%`,
                          background: 'linear-gradient(90deg, #1F5C4D, #7FD1AE)',
                        }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2 className="mb-4 text-sm font-semibold text-foreground">Mis cursos</h2>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-muted">
                  <Icon name="book-open" size={20} className="text-muted-foreground/30" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Sin cursos todavía</p>
                <p className="mt-1 max-w-[150px] text-xs leading-relaxed text-muted-foreground/60">
                  Inscríbete en un curso para empezar.
                </p>
                <Link
                  href="/dashboard/courses"
                  className="mt-4 flex items-center gap-1.5 text-xs font-bold text-capta-deep dark:text-capta-soft hover:underline transition-colors"
                >
                  Ver cursos <Icon name="arrow-right" size={11} />
                </Link>
              </div>
            </>
          )}
        </motion.div>

      </motion.div>
    </div>
  );
}
