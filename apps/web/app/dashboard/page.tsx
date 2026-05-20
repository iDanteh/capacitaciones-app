'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Users, BookOpen, CheckCircle2, Award,
  ArrowRight, Clock, TrendingUp, PlayCircle,
} from 'lucide-react';
import { api } from '@/lib/api';

// ─── Tipos ────────────────────────────────────────────────────────────────────

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

// ─── Variantes de animación ───────────────────────────────────────────────────

const listContainer = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const listItem = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, iconBg, iconColor, loading,
}: {
  label: string; value: string | number; icon: React.ElementType;
  iconBg: string; iconColor: string; loading?: boolean;
}) {
  return (
    <motion.div
      variants={listItem}
      className="col-span-12 sm:col-span-6 lg:col-span-3 rounded-2xl border border-border bg-card p-6 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
    >
      <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
        <Icon size={20} className={iconColor} />
      </div>
      <div className={`text-3xl font-bold tracking-tight text-foreground ${loading ? 'animate-pulse' : ''}`}>
        {loading ? '—' : value}
      </div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </motion.div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [user,        setUser]        = useState<UserData | null>(null);
  const [loading,     setLoading]     = useState(true);

  // Stats admin/owner
  const [usersCount,  setUsersCount]  = useState(0);
  const [publishedCourses, setPublished] = useState(0);
  const [totalEnrolled, setTotalEnrolled] = useState(0);

  // Stats employee
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw) as UserData;
        setUser(u);

        const isAdmin = ['OWNER', 'ADMIN', 'MANAGER'].includes(u.role);

        if (isAdmin) {
          Promise.all([
            api.get<{ data: unknown[]; total: number }>('/users').catch(() => ({ data: { data: [], total: 0 } })),
            api.get<Course[]>('/courses').catch(() => ({ data: [] })),
          ]).then(([usersRes, coursesRes]) => {
            const courses = coursesRes.data;
            setUsersCount(usersRes.data.total ?? 0);
            setPublished(courses.filter(c => c.status === 'PUBLISHED').length);
            setTotalEnrolled(courses.reduce((sum, c) => sum + (c.enrollmentCount ?? 0), 0));
          }).finally(() => setLoading(false));
        } else {
          api.get<Enrollment[]>('/enrollments/my')
            .then(res => setEnrollments(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
        }
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, []);

  const isAdmin = user ? ['OWNER', 'ADMIN', 'MANAGER'].includes(user.role) : false;

  // Stats employee calculadas
  const inProgress  = enrollments.filter(e => e.status === 'ACTIVE' && e.progress > 0 && e.progress < 100).length;
  const completed   = enrollments.filter(e => e.status === 'COMPLETED').length;
  const notStarted  = enrollments.filter(e => e.progress === 0).length;

  // Mis cursos en progreso (para widget rápido)
  const inProgressEnrollments = enrollments
    .filter(e => e.status === 'ACTIVE' && e.progress > 0)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 3);

  return (
    <div className="p-6 lg:p-8">

      {/* ── Encabezado ── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {greeting()}, {user?.firstName ?? '…'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAdmin ? 'Resumen general de tu plataforma de capacitación.' : 'Tu progreso de aprendizaje.'}
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
        {isAdmin ? (
          <>
            <StatCard label="Usuarios registrados"  value={usersCount}     icon={Users}        iconBg="bg-sky/10 dark:bg-sky/5"         iconColor="text-sky"              loading={loading} />
            <StatCard label="Cursos publicados"      value={publishedCourses} icon={BookOpen}   iconBg="bg-navy/10 dark:bg-sky/10"       iconColor="text-navy dark:text-sky" loading={loading} />
            <StatCard label="Total inscripciones"    value={totalEnrolled}  icon={TrendingUp}   iconBg="bg-teal/10 dark:bg-teal/5"       iconColor="text-teal"             loading={loading} />
            <StatCard label="Certificados emitidos"  value="—"              icon={Award}        iconBg="bg-amber-50 dark:bg-amber-900/10" iconColor="text-amber-500"        loading={false} />
          </>
        ) : (
          <>
            <StatCard label="Cursos inscritos"       value={enrollments.length} icon={BookOpen}    iconBg="bg-navy/10 dark:bg-sky/10"  iconColor="text-navy dark:text-sky" loading={loading} />
            <StatCard label="En progreso"            value={inProgress}         icon={PlayCircle}  iconBg="bg-sky/10 dark:bg-sky/5"    iconColor="text-sky"                loading={loading} />
            <StatCard label="Completados"            value={completed}          icon={CheckCircle2} iconBg="bg-teal/10 dark:bg-teal/5" iconColor="text-teal"               loading={loading} />
            <StatCard label="Sin comenzar"           value={notStarted}         icon={Clock}       iconBg="bg-amber-50 dark:bg-amber-900/10" iconColor="text-amber-500"    loading={loading} />
          </>
        )}

        {/* Acciones rápidas */}
        <motion.div
          variants={listItem}
          className="col-span-12 lg:col-span-8 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <h2 className="mb-4 text-sm font-semibold text-foreground">Acciones rápidas</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {isAdmin ? (
              <>
                <QuickAction href="/dashboard/courses/new"  label="Crear nuevo curso"      desc="Sube contenido y asigna empleados"  icon={BookOpen}  />
                <QuickAction href="/dashboard/users"        label="Gestionar usuarios"     desc="Invita, edita roles y accesos"       icon={Users}     />
                <QuickAction href="/dashboard/courses"      label="Ver todos los cursos"   desc="Gestiona el catálogo de cursos"      icon={TrendingUp}/>
              </>
            ) : (
              <>
                <QuickAction href="/dashboard/courses"       label="Explorar cursos"       desc="Descubre nuevos cursos disponibles"  icon={BookOpen}   />
                <QuickAction href="/dashboard/courses"       label="Continuar aprendiendo" desc="Retoma donde lo dejaste"             icon={PlayCircle} />
              </>
            )}
          </div>
        </motion.div>

        {/* Panel lateral */}
        <motion.div
          variants={listItem}
          className="col-span-12 lg:col-span-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          {isAdmin ? (
            <>
              <h2 className="mb-4 text-sm font-semibold text-foreground">Actividad reciente</h2>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <Clock size={22} className="text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Sin actividad aún</p>
                <p className="mt-1 max-w-[180px] text-xs leading-relaxed text-muted-foreground">
                  Aparecerá aquí cuando tus empleados comiencen a capacitarse.
                </p>
              </div>
            </>
          ) : inProgressEnrollments.length > 0 ? (
            <>
              <h2 className="mb-4 text-sm font-semibold text-foreground">Mis cursos</h2>
              <div className="space-y-3">
                {inProgressEnrollments.map(e => (
                  <Link
                    key={e.courseId}
                    href={`/dashboard/courses/${e.courseId}/learn`}
                    className="group flex flex-col gap-1.5 rounded-xl border border-border bg-background p-3 hover:border-sky/40 hover:bg-muted transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-foreground truncate max-w-[75%]">{e.courseTitle}</p>
                      <span className="text-xs font-semibold text-teal">{e.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-teal transition-all duration-500"
                        style={{ width: `${e.progress}%` }}
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
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <BookOpen size={22} className="text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Sin cursos todavía</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground max-w-[160px]">
                  Inscríbete en un curso para empezar.
                </p>
                <Link
                  href="/dashboard/courses"
                  className="mt-4 flex items-center gap-1 text-xs font-semibold text-navy dark:text-sky hover:underline"
                >
                  Ver cursos disponibles <ArrowRight size={11} />
                </Link>
              </div>
            </>
          )}
        </motion.div>

      </motion.div>
    </div>
  );
}

// ─── QuickAction ──────────────────────────────────────────────────────────────

function QuickAction({ href, label, desc, icon: Icon }: {
  href: string; label: string; desc: string; icon: React.ElementType;
}) {
  return (
    <Link
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
      <ArrowRight size={14} className="flex-shrink-0 text-muted-foreground/30 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-muted-foreground/60" />
    </Link>
  );
}
