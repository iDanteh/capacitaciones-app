'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen, Users, TrendingUp, CheckCircle2,
  BarChart2, Clock, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Overview {
  totalCourses: number;
  publishedCourses: number;
  totalUsers: number;
  totalEnrollments: number;
  completedEnrollments: number;
  completionRate: number;
  totalLessons: number;
}

interface CourseStat {
  id: string;
  title: string;
  status: string;
  totalLessons: number;
  thumbnailUrl?: string | null;
  enrolled: number;
  completed: number;
  avgProgress: number;
  completionRate: number;
}

interface EmployeeStat {
  id: string;
  name: string;
  email: string;
  role: string;
  lastLoginAt: string | null;
  enrolled: number;
  completed: number;
  inProgress: number;
  avgProgress: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const listItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
};

function formatDate(iso: string | null): string {
  if (!iso) return 'Nunca';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(d);
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <motion.div
      variants={listItem}
      className="rounded-2xl border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon size={16} className={color} />
      </div>
      <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </motion.div>
  );
}

// ─── Progress bar inline ──────────────────────────────────────────────────────

function MiniBar({ value, color = 'bg-teal' }: { value: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-semibold text-foreground w-8 text-right">{value}%</span>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5 animate-pulse">
            <div className="h-3 bg-muted rounded w-2/3 mb-4" />
            <div className="h-8 bg-muted rounded w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [overview,   setOverview]   = useState<Overview | null>(null);
  const [courses,    setCourses]    = useState<CourseStat[]>([]);
  const [employees,  setEmployees]  = useState<EmployeeStat[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Sorting de tablas
  type CourseSort   = 'enrolled' | 'completionRate' | 'avgProgress';
  type EmployeeSort = 'avgProgress' | 'completed' | 'lastLoginAt';
  const [courseSort,   setCourseSort]   = useState<CourseSort>('enrolled');
  const [employeeSort, setEmployeeSort] = useState<EmployeeSort>('avgProgress');
  const [courseAsc,    setCourseAsc]    = useState(false);
  const [employeeAsc,  setEmployeeAsc]  = useState(false);

  const load = useCallback((isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);

    Promise.all([
      api.get<Overview>('/analytics/overview'),
      api.get<CourseStat[]>('/analytics/courses'),
      api.get<EmployeeStat[]>('/analytics/employees'),
    ])
      .then(([ov, cs, em]) => {
        setOverview(ov.data);
        setCourses(cs.data);
        setEmployees(em.data);
      })
      .catch(() => setError('No se pudieron cargar las analíticas.'))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="p-6 lg:p-8"><Skeleton /></div>;

  if (error || !overview) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">{error ?? 'Error desconocido'}</p>
      </div>
    );
  }

  // Ordenar cursos
  const sortedCourses = [...courses].sort((a, b) => {
    const diff = (a[courseSort] as number) - (b[courseSort] as number);
    return courseAsc ? diff : -diff;
  });

  // Ordenar empleados
  const sortedEmployees = [...employees].sort((a, b) => {
    if (employeeSort === 'lastLoginAt') {
      const ta = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
      const tb = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
      return employeeAsc ? ta - tb : tb - ta;
    }
    const diff = (a[employeeSort] as number) - (b[employeeSort] as number);
    return employeeAsc ? diff : -diff;
  });

  function toggleCourseSort(col: CourseSort) {
    if (courseSort === col) setCourseAsc(p => !p);
    else { setCourseSort(col); setCourseAsc(false); }
  }

  function toggleEmployeeSort(col: EmployeeSort) {
    if (employeeSort === col) setEmployeeAsc(p => !p);
    else { setEmployeeSort(col); setEmployeeAsc(false); }
  }

  function SortIcon({ col, current, asc }: { col: string; current: string; asc: boolean }) {
    if (col !== current) return <ChevronDown size={12} className="opacity-30" />;
    return asc ? <ChevronUp size={12} className="text-navy dark:text-sky" /> : <ChevronDown size={12} className="text-navy dark:text-sky" />;
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Analíticas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Progreso general de capacitación de tu empresa.
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          title="Actualizar datos"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {/* ── Overview cards ── */}
      <motion.div
        initial="initial"
        animate="animate"
        variants={{ animate: { transition: { staggerChildren: 0.06 } } }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatCard label="Cursos publicados"   value={overview.publishedCourses}  sub={`de ${overview.totalCourses} totales`} icon={BookOpen}     color="text-navy dark:text-sky" />
        <StatCard label="Total inscripciones" value={overview.totalEnrollments}  sub={`${overview.completedEnrollments} completadas`}           icon={TrendingUp}   color="text-sky" />
        <StatCard label="Tasa de completado"  value={`${overview.completionRate}%`} sub="del total de inscripciones"          icon={CheckCircle2} color="text-teal" />
        <StatCard label="Empleados activos"   value={overview.totalUsers}        sub={`${overview.totalLessons} lecciones en total`}            icon={Users}        color="text-purple-500" />
      </motion.div>

      {/* ── Tabla de cursos ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.1 }}
        className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Cursos</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{courses.length}</span>
          </div>
        </div>

        {courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart2 size={32} className="text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Sin datos de cursos todavía.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Curso</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Estado</th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                    onClick={() => toggleCourseSort('enrolled')}
                  >
                    <span className="inline-flex items-center gap-1 justify-end">
                      Inscritos <SortIcon col="enrolled" current={courseSort} asc={courseAsc} />
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                    onClick={() => toggleCourseSort('completionRate')}
                  >
                    <span className="inline-flex items-center gap-1 justify-end">
                      Completado <SortIcon col="completionRate" current={courseSort} asc={courseAsc} />
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none hidden lg:table-cell"
                    onClick={() => toggleCourseSort('avgProgress')}
                  >
                    <span className="inline-flex items-center gap-1 justify-end">
                      Progreso prom. <SortIcon col="avgProgress" current={courseSort} asc={courseAsc} />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedCourses.map((c, i) => (
                  <tr key={c.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                    <td className="px-6 py-3.5">
                      <p className="font-medium text-foreground line-clamp-1">{c.title}</p>
                      <p className="text-xs text-muted-foreground">{c.totalLessons} lecciones</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        c.status === 'PUBLISHED' ? 'bg-teal/10 text-teal' :
                        c.status === 'DRAFT' ? 'bg-muted text-muted-foreground' :
                        'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                      }`}>
                        {c.status === 'PUBLISHED' ? 'Publicado' : c.status === 'DRAFT' ? 'Borrador' : 'Archivado'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-foreground">{c.enrolled}</td>
                    <td className="px-4 py-3.5 w-36">
                      <MiniBar value={c.completionRate} color={c.completionRate >= 70 ? 'bg-teal' : c.completionRate >= 40 ? 'bg-sky' : 'bg-muted-foreground'} />
                    </td>
                    <td className="px-4 py-3.5 w-36 hidden lg:table-cell">
                      <MiniBar value={c.avgProgress} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* ── Tabla de empleados ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.15 }}
        className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Empleados</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{employees.length}</span>
          </div>
        </div>

        {employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users size={32} className="text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Sin empleados registrados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Empleado</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Inscritos</th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                    onClick={() => toggleEmployeeSort('completed')}
                  >
                    <span className="inline-flex items-center gap-1 justify-end">
                      Completados <SortIcon col="completed" current={employeeSort} asc={employeeAsc} />
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none hidden lg:table-cell"
                    onClick={() => toggleEmployeeSort('avgProgress')}
                  >
                    <span className="inline-flex items-center gap-1 justify-end">
                      Progreso prom. <SortIcon col="avgProgress" current={employeeSort} asc={employeeAsc} />
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                    onClick={() => toggleEmployeeSort('lastLoginAt')}
                  >
                    <span className="inline-flex items-center gap-1 justify-end">
                      Último acceso <SortIcon col="lastLoginAt" current={employeeSort} asc={employeeAsc} />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedEmployees.map((e, i) => (
                  <tr key={e.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                    <td className="px-6 py-3.5">
                      <p className="font-medium text-foreground">{e.name}</p>
                      <p className="text-xs text-muted-foreground">{e.email}</p>
                    </td>
                    <td className="px-4 py-3.5 text-right text-foreground font-semibold">{e.enrolled}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`font-semibold ${e.completed > 0 ? 'text-teal' : 'text-muted-foreground'}`}>
                        {e.completed}
                      </span>
                      {e.enrolled > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({Math.round((e.completed / e.enrolled) * 100)}%)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 w-36 hidden lg:table-cell">
                      <MiniBar value={e.avgProgress} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                        <Clock size={11} />
                        {formatDate(e.lastLoginAt)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

    </div>
  );
}
