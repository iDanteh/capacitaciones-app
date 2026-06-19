'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Icon, type IconName } from '@/components/capta-icon';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Overview {
  totalCourses: number;
  publishedCourses: number;
  totalUsers: number;
  totalEnrollments: number;
  completedEnrollments: number;
  completionRate: number;
  totalLessons: number;
  totalCertificates: number;
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

interface WeeklyData {
  labels: string[];
  enrollments: number[];
  completions: number[];
  users: number[];
  courses: number[];
  certificates: number[];
}

type ChartPoint = {
  date: string;
  inscripciones: number;
  completados: number;
  certificados: number;
  usuarios: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convierte un array de objetos a CSV y dispara la descarga sin servidor. */
function downloadCSV(filename: string, rows: string[][]): void {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = rows.map(r => r.map(escape).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM para Excel
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const listItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
};

const PAGE_SIZE = 10;

// ─── TablePager ───────────────────────────────────────────────────────────────

function TablePager({ page, total, count, onChange }: {
  page: number; total: number; count: number; onChange: (p: number) => void;
}) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-muted/20">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        ← Anterior
      </button>
      <span className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, count)}</span>
        {' '}de{' '}
        <span className="font-semibold text-foreground">{count}</span>
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= total}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Siguiente →
      </button>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Nunca';
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(d);
}

function toChartData(w: WeeklyData): ChartPoint[] {
  return w.labels.map((date, i) => ({
    date,
    inscripciones: w.enrollments[i],
    completados:   w.completions[i],
    certificados:  w.certificates[i],
    usuarios:      w.users[i],
  }));
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, iconName, accent }: {
  label: string; value: string | number; sub?: string;
  iconName: IconName; accent: string;
}) {
  return (
    <motion.div
      variants={listItem}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5"
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
    >
      <div className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-15"
        style={{ background: accent }} />
      <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-xl"
        style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}20` }}>
        <Icon name={iconName} size={16} />
      </div>
      <p className="font-display text-2xl font-normal tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide">{label}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground/50">{sub}</p>}
    </motion.div>
  );
}

// ─── MiniBar ──────────────────────────────────────────────────────────────────

function MiniBar({ value, color }: { value: number; color?: string }) {
  const fill = color ?? 'linear-gradient(90deg, #1F5C4D, #7FD1AE)';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: fill }} />
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
            <div className="h-9 w-9 bg-muted rounded-xl mb-4" />
            <div className="h-7 bg-muted rounded w-1/2 mb-2" />
            <div className="h-3 bg-muted rounded w-2/3" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 animate-pulse">
        <div className="h-5 bg-muted rounded w-40 mb-6" />
        <div className="h-52 bg-muted/50 rounded-xl" />
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden animate-pulse">
        <div className="h-14 border-b border-border px-6 flex items-center gap-2">
          <div className="h-4 bg-muted rounded w-24" />
        </div>
        <div className="p-6 space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-muted/50 rounded-xl" />)}
        </div>
      </div>
    </div>
  );
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const visible = payload.filter((p: any) => p.value > 0);
  const rows = visible.length ? visible : payload;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-xl min-w-[130px]">
      <p className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{label}</p>
      {rows.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span className="text-xs text-muted-foreground">{p.name}</span>
          </div>
          <span className="text-xs font-bold text-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Weekly Chart ─────────────────────────────────────────────────────────────

const CHART_VIEWS = [
  {
    key: 'learning',
    label: 'Aprendizaje',
    series: [
      { key: 'inscripciones', label: 'Inscripciones', color: 'var(--tenant-primary)' },
      { key: 'completados',   label: 'Completados',   color: '#7FD1AE' },
      { key: 'certificados',  label: 'Certificados',  color: '#F59E0B' },
    ],
  },
  {
    key: 'people',
    label: 'Personas',
    series: [
      { key: 'usuarios', label: 'Nuevos usuarios', color: '#8FC4E8' },
    ],
  },
] as const;

type ChartView = typeof CHART_VIEWS[number]['key'];

function WeeklyChart({ data }: { data: ChartPoint[] }) {
  const [view, setView] = useState<ChartView>('learning');
  const current = CHART_VIEWS.find(v => v.key === view)!;
  const isEmpty = data.every(p =>
    p.inscripciones === 0 && p.completados === 0 && p.certificados === 0 && p.usuarios === 0
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.08 }}
      className="rounded-2xl border border-border bg-card overflow-hidden"
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <Icon name="trending" size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Tendencia semanal</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Últimos 7 días</p>
        </div>
        <div className="flex rounded-xl border border-border p-0.5 gap-0.5">
          {CHART_VIEWS.map(v => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-[10px] transition-all duration-150 ${
                view === v.key
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart or empty */}
      <AnimatePresence mode="wait">
      {isEmpty ? (
        <motion.div
          key="empty"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex flex-col items-center justify-center h-64 text-center px-6"
        >
          <Icon name="chart-bar" size={32} className="text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">Sin actividad en los últimos 7 días.</p>
          <p className="text-xs text-muted-foreground/50 mt-1">
            Los datos aparecerán conforme los empleados interactúen con la plataforma.
          </p>
        </motion.div>
      ) : (
        <motion.div
          key={view}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="px-6 pt-6 pb-4"
        >
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                {current.series.map(s => (
                  <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={s.color} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0.01} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                dy={6}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={28}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: 'rgba(0,0,0,0.08)', strokeWidth: 1 }}
              />
              {current.series.map(s => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  fill={`url(#grad-${s.key})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: s.color }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-3 pt-3 border-t border-border">
            {current.series.map(s => (
              <div key={s.key} className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { error: toastError } = useToast();
  const toastErrorRef = useRef(toastError);
  useEffect(() => { toastErrorRef.current = toastError; }, [toastError]);

  const [overview,   setOverview]   = useState<Overview | null>(null);
  const [courses,    setCourses]    = useState<CourseStat[]>([]);
  const [employees,  setEmployees]  = useState<EmployeeStat[]>([]);
  const [weekly,     setWeekly]     = useState<WeeklyData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  type CourseSort   = 'enrolled' | 'completionRate' | 'avgProgress';
  type EmployeeSort = 'avgProgress' | 'completed' | 'lastLoginAt';
  const [courseSort,   setCourseSort]   = useState<CourseSort>('enrolled');
  const [employeeSort, setEmployeeSort] = useState<EmployeeSort>('avgProgress');
  const [courseAsc,    setCourseAsc]    = useState(false);
  const [employeeAsc,  setEmployeeAsc]  = useState(false);

  // Paginación client-side — los datos están en memoria, el CSV exporta todo
  const [empSearch,   setEmpSearch]   = useState('');
  const [empPage,     setEmpPage]     = useState(1);
  const [coursePage,  setCoursePage]  = useState(1);

  const load = useCallback((isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);

    Promise.all([
      api.get<Overview>('/analytics/overview'),
      api.get<CourseStat[]>('/analytics/courses'),
      api.get<EmployeeStat[]>('/analytics/employees'),
      api.get<WeeklyData>('/analytics/weekly'),
    ])
      .then(([ov, cs, em, wk]) => {
        setOverview(ov.data);
        setCourses(cs.data);
        setEmployees(em.data);
        setWeekly(wk.data);
      })
      .catch(() => {
        setError('No se pudieron cargar las analíticas.');
        toastErrorRef.current('No pudimos cargar los datos de analíticas. Intenta recargar.');
      })
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

  const chartData = weekly ? toChartData(weekly) : [];

  const sortedCourses = [...courses].sort((a, b) => {
    const diff = (a[courseSort] as number) - (b[courseSort] as number);
    return courseAsc ? diff : -diff;
  });

  const sortedEmployees = [...employees].sort((a, b) => {
    if (employeeSort === 'lastLoginAt') {
      const ta = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
      const tb = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
      return employeeAsc ? ta - tb : tb - ta;
    }
    const diff = (a[employeeSort] as number) - (b[employeeSort] as number);
    return employeeAsc ? diff : -diff;
  });

  // Paginación de cursos — resetea página al cambiar el sort
  const courseTotalPages = Math.max(1, Math.ceil(sortedCourses.length / PAGE_SIZE));
  const coursePageSafe   = Math.min(coursePage, courseTotalPages);
  const pagedCourses     = sortedCourses.slice((coursePageSafe - 1) * PAGE_SIZE, coursePageSafe * PAGE_SIZE);

  // Empleados: primero filtrar por búsqueda, luego paginar
  const empQ              = empSearch.toLowerCase();
  const filteredEmployees = empQ
    ? sortedEmployees.filter(e =>
        e.name.toLowerCase().includes(empQ) || e.email.toLowerCase().includes(empQ)
      )
    : sortedEmployees;
  const empTotalPages  = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const empPageSafe    = Math.min(empPage, empTotalPages);
  const pagedEmployees = filteredEmployees.slice((empPageSafe - 1) * PAGE_SIZE, empPageSafe * PAGE_SIZE);

  function toggleCourseSort(col: CourseSort) {
    if (courseSort === col) setCourseAsc(p => !p);
    else { setCourseSort(col); setCourseAsc(false); }
    setCoursePage(1);
  }

  function toggleEmployeeSort(col: EmployeeSort) {
    if (employeeSort === col) setEmployeeAsc(p => !p);
    else { setEmployeeSort(col); setEmployeeAsc(false); }
    setEmpPage(1);
  }

  function SortIcon({ col, current, asc }: { col: string; current: string; asc: boolean }) {
    if (col !== current) return <Icon name="chevron-down" size={12} className="opacity-30" />;
    return asc
      ? <Icon name="chevron-up" size={12} className="text-capta-deep dark:text-capta-soft" />
      : <Icon name="chevron-down" size={12} className="text-capta-deep dark:text-capta-soft" />;
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Analíticas</h1>
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
          <Icon name="refresh" size={14} className={refreshing ? 'animate-spin' : ''} />
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
        <StatCard label="Cursos publicados"    value={overview.publishedCourses}    sub={`de ${overview.totalCourses} totales`}          iconName="book-open"    accent="var(--tenant-primary)" />
        <StatCard label="Total inscripciones"  value={overview.totalEnrollments}    sub={`${overview.completedEnrollments} completadas`}  iconName="trending"     accent="#8FC4E8" />
        <StatCard label="Tasa de completado"   value={`${overview.completionRate}%`} sub="del total de inscripciones"                    iconName="check-circle" accent="#7FD1AE" />
        <StatCard label="Certificados emitidos" value={overview.totalCertificates ?? 0} sub={`${overview.totalUsers} empleados activos`} iconName="certificate"  accent="#F59E0B" />
      </motion.div>

      {/* ── Gráfica semanal ── */}
      {chartData.length > 0 && <WeeklyChart data={chartData} />}

      {/* ── Tablas de cursos y empleados — lado a lado en pantallas grandes ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

      {/* ── Tabla de cursos ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.12 }}
        className="rounded-2xl border border-border bg-card overflow-hidden"
        style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon name="book-open" size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Cursos</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{courses.length}</span>
          </div>
          {courses.length > 0 && (
            <button
              onClick={() => downloadCSV(`cursos-${new Date().toISOString().slice(0,10)}.csv`, [
                ['Curso', 'Estado', 'Lecciones', 'Inscritos', 'Completados', 'Tasa completado %', 'Progreso prom. %'],
                ...sortedCourses.map(c => [
                  c.title,
                  c.status === 'PUBLISHED' ? 'Publicado' : c.status === 'DRAFT' ? 'Borrador' : 'Archivado',
                  String(c.totalLessons),
                  String(c.enrolled),
                  String(c.completed),
                  String(c.completionRate),
                  String(c.avgProgress),
                ]),
              ])}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Exportar como CSV"
            >
              <Icon name="download" size={13} />
              CSV
            </button>
          )}
        </div>

        {courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Icon name="chart-bar" size={32} className="text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Sin datos de cursos todavía.</p>
          </div>
        ) : (
          <>
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
              <tbody className="divide-y divide-border/60">
                {pagedCourses.map(c => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-3.5">
                      <p className="font-medium text-foreground line-clamp-1">{c.title}</p>
                      <p className="text-xs text-muted-foreground">{c.totalLessons} lecciones</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        c.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' :
                        c.status === 'DRAFT'     ? 'bg-muted text-muted-foreground' :
                                                   'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                      }`}>
                        {c.status === 'PUBLISHED' ? 'Publicado' : c.status === 'DRAFT' ? 'Borrador' : 'Archivado'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-foreground">{c.enrolled}</td>
                    <td className="px-4 py-3.5 w-36">
                      <MiniBar
                        value={c.completionRate}
                        color={c.completionRate >= 70 ? 'linear-gradient(90deg, #1F5C4D, #7FD1AE)' :
                               c.completionRate >= 40 ? '#8FC4E8' : undefined}
                      />
                    </td>
                    <td className="px-4 py-3.5 w-36 hidden lg:table-cell">
                      <MiniBar value={c.avgProgress} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePager
            page={coursePageSafe}
            total={courseTotalPages}
            count={sortedCourses.length}
            onChange={setCoursePage}
          />
          </>
        )}
      </motion.div>

      {/* ── Tabla de empleados ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.14 }}
        className="rounded-2xl border border-border bg-card overflow-hidden"
        style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon name="users" size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Empleados</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{employees.length}</span>
          </div>
          {employees.length > 0 && (
            <button
              onClick={() => downloadCSV(`empleados-${new Date().toISOString().slice(0,10)}.csv`, [
                ['Nombre', 'Email', 'Rol', 'Cursos inscritos', 'Cursos completados', 'En progreso', 'Progreso prom. %', 'Último acceso'],
                ...sortedEmployees.map(e => [
                  e.name,
                  e.email,
                  e.role,
                  String(e.enrolled),
                  String(e.completed),
                  String(e.inProgress),
                  String(e.avgProgress),
                  e.lastLoginAt ? new Date(e.lastLoginAt).toLocaleDateString('es-MX') : 'Nunca',
                ]),
              ])}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Exportar como CSV"
            >
              <Icon name="download" size={13} />
              CSV
            </button>
          )}
        </div>

        {employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Icon name="users" size={32} className="text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Sin empleados registrados.</p>
          </div>
        ) : (
          <>
            {/* Buscador de empleados */}
            <div className="px-6 py-3 border-b border-border">
              <div className="relative">
                <Icon name="search" size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  value={empSearch}
                  onChange={e => { setEmpSearch(e.target.value); setEmpPage(1); }}
                  placeholder="Buscar por nombre o email..."
                  className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:border-capta-soft/60 transition-all"
                />
              </div>
            </div>

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
                <tbody className="divide-y divide-border/60">
                  {pagedEmployees.length > 0 ? pagedEmployees.map(e => (
                    <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-3.5">
                        <p className="font-medium text-foreground">{e.name}</p>
                        <p className="text-xs text-muted-foreground">{e.email}</p>
                      </td>
                      <td className="px-4 py-3.5 text-right text-foreground font-semibold">{e.enrolled}</td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={`font-semibold ${e.completed > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
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
                          <Icon name="clock" size={11} />
                          {formatDate(e.lastLoginAt)}
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-sm text-muted-foreground">
                        Sin resultados para &ldquo;{empSearch}&rdquo;
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <TablePager
              page={empPageSafe}
              total={empTotalPages}
              count={filteredEmployees.length}
              onChange={setEmpPage}
            />
          </>
        )}
      </motion.div>

      </div>{/* fin grid cursos+empleados */}

    </div>
  );
}
