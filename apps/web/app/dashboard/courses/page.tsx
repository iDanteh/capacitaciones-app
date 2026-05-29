'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/capta-icon';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Course {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  totalLessons: number;
  enrollmentCount?: number;
  authorName?: string;
  isEnrolled?: boolean;
  myProgress?: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Animaciones ──────────────────────────────────────────────────────────────

const listContainer = { animate: { transition: { staggerChildren: 0.04 } } };
const listItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 28 } },
};

// ─── Admin: status config ─────────────────────────────────────────────────────

const STATUS_CONFIG = {
  DRAFT:     { label: 'Borrador',  className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  PUBLISHED: { label: 'Publicado', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' },
  ARCHIVED:  { label: 'Archivado', className: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' },
};

// ─── Admin: CourseCard (sin cambios respecto al diseño anterior) ───────────────

function AdminCourseCard({ course, onDelete }: { course: Course; onDelete: (id: string) => Promise<void> }) {
  const status = STATUS_CONFIG[course.status];
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try { await onDelete(course.id); }
    finally { setDeleting(false); setDeleteConfirm(false); }
  };

  return (
    <motion.div
      variants={listItem}
      className="group relative flex flex-col rounded-2xl border border-border bg-card hover:border-capta-soft/30 transition-all duration-200 overflow-hidden"
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
    >
      <div className="relative h-40 flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, rgba(30,79,122,0.05), rgba(143,196,232,0.10))' }}>
        {course.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon name="book-open" size={36} className="text-capta-soft/40" />
          </div>
        )}
        <span className={`absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-xs font-semibold ${status.className}`}>
          {status.label}
        </span>
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <Link
            href={`/dashboard/courses/${course.id}`}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 dark:bg-gray-900/90 shadow-sm text-gray-600 dark:text-gray-400 hover:text-capta-deep dark:hover:text-capta-soft transition-colors"
          >
            <Icon name="more-vertical" size={14} />
          </Link>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-foreground leading-snug line-clamp-2 mb-1">{course.title}</h3>
          {course.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{course.description}</p>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Icon name="file" size={12} />
            {course.totalLessons} {course.totalLessons === 1 ? 'lección' : 'lecciones'}
          </span>
          {course.enrollmentCount !== undefined && (
            <span className="flex items-center gap-1"><Icon name="users" size={12} />
              {course.enrollmentCount} {course.enrollmentCount === 1 ? 'inscrito' : 'inscritos'}
            </span>
          )}
        </div>
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            {course.authorName && (
              <span className="text-xs text-muted-foreground truncate max-w-[60%]">{course.authorName}</span>
            )}
            <div className="flex items-center gap-2 ml-auto">
              {!deleteConfirm && (
                <button onClick={() => setDeleteConfirm(true)}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Eliminar curso">
                  <Icon name="trash" size={12} />
                </button>
              )}
              <Link href={`/dashboard/courses/${course.id}`}
                className="flex items-center gap-1 text-xs font-medium text-capta-deep dark:text-capta-soft hover:underline">
                Editar <Icon name="arrow-right" size={12} />
              </Link>
              {course.status === 'PUBLISHED' && (
                <Link href={`/dashboard/courses/${course.id}/learn`}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all hover:scale-[1.03]"
                  style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)', boxShadow: '0 2px 8px rgba(30,79,122,0.25)' }}>
                  <Icon name="play" size={11} /> Ver
                </Link>
              )}
            </div>
          </div>
          {deleteConfirm && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
              <p className="text-xs text-destructive font-medium">¿Eliminar curso?</p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setDeleteConfirm(false)}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors">No</button>
                <button onClick={handleDelete} disabled={deleting}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-white bg-destructive hover:bg-destructive/90 disabled:opacity-60 transition-all">
                  {deleting && <Icon name="refresh" size={10} className="animate-spin" />} Eliminar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Employee: EmployeeCourseCard ─────────────────────────────────────────────

function EmployeeCourseCard({ course, onEnroll }: {
  course:   Course;
  onEnroll: (courseId: string) => Promise<void>;
}) {
  const [enrolling, setEnrolling] = useState(false);

  const isCompleted  = course.isEnrolled && course.myProgress === 100;
  const isInProgress = course.isEnrolled && (course.myProgress ?? 0) > 0 && !isCompleted;
  const isNotStarted = course.isEnrolled && (course.myProgress ?? 0) === 0;

  const handleEnroll = async () => {
    setEnrolling(true);
    try { await onEnroll(course.id); }
    finally { setEnrolling(false); }
  };

  return (
    <motion.div
      variants={listItem}
      className="group relative flex flex-col rounded-2xl border border-border bg-card overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-capta-soft/30"
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.04)' }}
    >
      {/* Thumbnail */}
      <div className="relative h-40 flex-shrink-0 overflow-hidden bg-muted">
        {course.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.thumbnailUrl} alt={course.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(30,79,122,0.06), rgba(143,196,232,0.12))' }}>
            <Icon name="book-open" size={36} className="text-capta-soft/40" />
          </div>
        )}

        {/* Estado badge */}
        <div className="absolute top-3 left-3">
          {isCompleted && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-bold text-white">
              <Icon name="check" size={9} /> Completado
            </span>
          )}
          {isInProgress && (
            <span className="flex items-center gap-1 rounded-full bg-capta-deep px-2.5 py-0.5 text-[10px] font-bold text-white">
              <Icon name="play" size={9} /> En progreso
            </span>
          )}
          {isNotStarted && (
            <span className="flex items-center gap-1 rounded-full border border-white/30 bg-black/40 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
              Inscrito
            </span>
          )}
        </div>

        {/* Lección count */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 backdrop-blur-sm">
          <Icon name="file" size={9} className="text-white/70" />
          <span className="text-[10px] font-medium text-white">
            {course.totalLessons} {course.totalLessons === 1 ? 'lección' : 'lecciones'}
          </span>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex flex-1 flex-col p-4 gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-sm text-foreground leading-snug line-clamp-2 mb-1.5">
            {course.title}
          </h3>
          {course.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {course.description}
            </p>
          )}
        </div>

        {/* Barra de progreso (inscritos) */}
        {course.isEnrolled && course.myProgress !== undefined && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Tu progreso</span>
              <span className="text-[10px] font-bold" style={{ color: isCompleted ? '#16a34a' : '#7FD1AE' }}>
                {course.myProgress}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width:      `${course.myProgress}%`,
                  background: isCompleted
                    ? 'linear-gradient(90deg, #16a34a, #4ade80)'
                    : 'linear-gradient(90deg, #1F5C4D, #7FD1AE)',
                }}
              />
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="pt-1">
          {course.isEnrolled ? (
            <Link
              href={`/dashboard/courses/${course.id}/learn`}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold text-white transition-all hover:scale-[1.02] hover:shadow-md active:scale-[0.97]"
              style={{
                background: isCompleted
                  ? 'linear-gradient(135deg, #16a34a, #22c55e)'
                  : 'linear-gradient(135deg, #1E4F7A, #2D6FA0)',
                boxShadow: '0 2px 8px rgba(30,79,122,0.22)',
              }}
            >
              <Icon name="play" size={12} />
              {isCompleted ? 'Ver de nuevo' : isInProgress ? 'Continuar' : 'Iniciar curso'}
            </Link>
          ) : (
            <button
              onClick={handleEnroll}
              disabled={enrolling}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-capta-deep/30 bg-capta-tint/30 py-2.5 text-xs font-bold text-capta-deep transition-all hover:border-capta-deep/60 hover:bg-capta-tint/60 active:scale-[0.97] disabled:opacity-60 dark:border-capta-soft/30 dark:bg-capta-soft/5 dark:text-capta-soft dark:hover:border-capta-soft/60 dark:hover:bg-capta-soft/10"
            >
              {enrolling ? (
                <><Icon name="refresh" size={12} className="animate-spin" /> Inscribiendo…</>
              ) : (
                <><Icon name="plus" size={12} /> Inscribirme</>
              )}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CourseCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden animate-pulse">
      <div className="h-40 bg-muted" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-3 bg-muted rounded w-2/3" />
        <div className="h-8 bg-muted rounded-xl mt-2" />
      </div>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

type EmployeeFilter = 'ALL' | 'ENROLLED' | 'AVAILABLE' | 'COMPLETED';

export default function CoursesPage() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [search, setSearch]   = useState('');
  const [role, setRole]       = useState('EMPLOYEE');

  // filtros diferenciados por rol
  const [adminFilter,    setAdminFilter]    = useState<string>('ALL');
  const [employeeFilter, setEmployeeFilter] = useState<EmployeeFilter>('ALL');

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (raw) {
      try { setRole((JSON.parse(raw) as { role: string }).role); } catch {}
    }

    api.get<Course[]>('/courses')
      .then(res => setCourses(res.data))
      .catch(() => setError('No se pudieron cargar los cursos.'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeleteCourse = async (id: string) => {
    try {
      await api.delete(`/courses/${id}`);
      setCourses(prev => prev.filter(c => c.id !== id));
      toastSuccess('Curso eliminado');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toastError(Array.isArray(msg) ? msg[0] : (msg ?? 'No se pudo eliminar el curso'));
    }
  };

  const handleEnroll = useCallback(async (courseId: string) => {
    try {
      await api.post('/enrollments', { courseId });
      // Actualizar estado local: isEnrolled=true, myProgress=0
      setCourses(prev => prev.map(c =>
        c.id === courseId ? { ...c, isEnrolled: true, myProgress: 0 } : c
      ));
      toastSuccess('¡Te inscribiste correctamente! Ya puedes comenzar el curso.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toastError(Array.isArray(msg) ? msg[0] : (msg ?? 'No se pudo completar la inscripción'));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAdmin   = ['OWNER', 'ADMIN', 'MANAGER'].includes(role);
  const canCreate = ['OWNER', 'ADMIN'].includes(role);

  // ── Filtrado para Admin ────────────────────────────────────────────────────
  const adminFiltered = courses.filter(c => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter = adminFilter === 'ALL' || c.status === adminFilter;
    return matchSearch && matchFilter;
  });

  // ── Filtrado para Employee ─────────────────────────────────────────────────
  const employeeFiltered = courses.filter(c => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      employeeFilter === 'ALL'       ? true :
      employeeFilter === 'ENROLLED'  ? (c.isEnrolled && (c.myProgress ?? 0) < 100) :
      employeeFilter === 'AVAILABLE' ? !c.isEnrolled :
      employeeFilter === 'COMPLETED' ? (c.isEnrolled && c.myProgress === 100) :
      true;
    return matchSearch && matchFilter;
  });

  const adminStats = useMemo(() => ({
    total:     courses.length,
    published: courses.filter(c => c.status === 'PUBLISHED').length,
    draft:     courses.filter(c => c.status === 'DRAFT').length,
    lessons:   courses.reduce((acc, c) => acc + c.totalLessons, 0),
  }), [courses]);

  const employeeStats = useMemo(() => ({
    available:  courses.filter(c => !c.isEnrolled).length,
    enrolled:   courses.filter(c => c.isEnrolled && (c.myProgress ?? 0) < 100).length,
    completed:  courses.filter(c => c.isEnrolled && c.myProgress === 100).length,
    inProgress: courses.filter(c => c.isEnrolled && (c.myProgress ?? 0) > 0 && c.myProgress !== 100).length,
  }), [courses]);

  // ── Render Admin ───────────────────────────────────────────────────────────
  if (isAdmin) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Cursos</h1>
            <p className="mt-1 text-sm text-muted-foreground">Gestiona el contenido de capacitación de tu empresa.</p>
          </div>
          {canCreate && (
            <Link
              href="/dashboard/courses/new"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-md"
              style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)', boxShadow: '0 2px 10px rgba(30,79,122,0.25)' }}
            >
              <Icon name="plus" size={15} /> Nuevo curso
            </Link>
          )}
        </div>

        {!loading && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Total de cursos', value: adminStats.total,     iconName: 'book-open'    as const, accent: '#1E4F7A' },
              { label: 'Publicados',      value: adminStats.published, iconName: 'check-circle' as const, accent: '#7FD1AE' },
              { label: 'En borrador',     value: adminStats.draft,     iconName: 'file'          as const, accent: '#F59E0B' },
              { label: 'Total lecciones', value: adminStats.lessons,   iconName: 'video'         as const, accent: '#8FC4E8' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border border-border bg-card p-4"
                style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
                  <Icon name={s.iconName} size={16} style={{ color: s.accent }} />
                </div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
              </div>
            ))}
          </motion.div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Buscar cursos..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full rounded-xl border border-border bg-background pl-9 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-capta-soft/40 transition-all" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['ALL', 'PUBLISHED', 'DRAFT', 'ARCHIVED'] as const).map(s => (
              <button key={s} onClick={() => setAdminFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${adminFilter === s
                  ? 'text-white'
                  : 'border border-border bg-background text-muted-foreground hover:text-foreground hover:border-capta-deep/30'}`}
                style={adminFilter === s ? { background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' } : {}}>
                {s === 'ALL' ? 'Todos' : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label ?? s}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(6)].map((_, i) => <CourseCardSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Icon name="book-open" size={40} className="text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : adminFiltered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Icon name="book-open" size={40} className="text-muted-foreground/30 mb-4" />
            <p className="font-medium text-foreground mb-1">{search ? 'Sin resultados' : 'Aún no hay cursos'}</p>
            <p className="text-sm text-muted-foreground mb-5">
              {search ? `No se encontraron cursos con "${search}"` : 'Crea tu primer curso de capacitación.'}
            </p>
            {canCreate && !search && (
              <Link href="/dashboard/courses/new"
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)', boxShadow: '0 2px 10px rgba(30,79,122,0.25)' }}>
                <Icon name="plus" size={15} /> Crear primer curso
              </Link>
            )}
          </div>
        ) : (
          <motion.div variants={listContainer} initial="initial" animate="animate"
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {adminFiltered.map(course => (
              <AdminCourseCard key={course.id} course={course} onDelete={handleDeleteCourse} />
            ))}
          </motion.div>
        )}
      </div>
    );
  }

  // ── Render Employee ────────────────────────────────────────────────────────
  const EMPLOYEE_TABS: { key: EmployeeFilter; label: string; count: number }[] = [
    { key: 'ALL',       label: 'Todos',         count: courses.length },
    { key: 'AVAILABLE', label: 'Disponibles',   count: employeeStats.available },
    { key: 'ENROLLED',  label: 'Inscritos',     count: employeeStats.enrolled },
    { key: 'COMPLETED', label: 'Completados',   count: employeeStats.completed },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Catálogo de cursos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Explora los cursos disponibles e inscríbete para comenzar a aprender.
        </p>
      </motion.div>

      {/* ── Stats de empleado ── */}
      {!loading && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.05 }}
          className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Disponibles',  value: employeeStats.available,  accent: '#1E4F7A', iconName: 'book-open'    as const },
            { label: 'En progreso',  value: employeeStats.inProgress, accent: '#8FC4E8', iconName: 'play'          as const },
            { label: 'Inscritos',    value: employeeStats.enrolled,   accent: '#7FD1AE', iconName: 'check-circle'  as const },
            { label: 'Completados',  value: employeeStats.completed,  accent: '#F59E0B', iconName: 'certificate'   as const },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-4"
              style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.04)' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <Icon name={s.iconName} size={15} style={{ color: s.accent }} />
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* ── Buscador + tabs ── */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Buscar cursos..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-background pl-9 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-capta-soft/40 transition-all" />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {EMPLOYEE_TABS.map(tab => (
            <button key={tab.key} onClick={() => setEmployeeFilter(tab.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                employeeFilter === tab.key
                  ? 'text-white shadow-sm'
                  : 'border border-border bg-background text-muted-foreground hover:text-foreground hover:border-capta-deep/30'
              }`}
              style={employeeFilter === tab.key ? { background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' } : {}}>
              {tab.label}
              {tab.count > 0 && (
                <span className={`rounded-full px-1.5 py-0 text-[10px] font-bold ${
                  employeeFilter === tab.key ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid ── */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => <CourseCardSkeleton key={i} />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Icon name="book-open" size={40} className="text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      ) : employeeFiltered.length === 0 ? (
        <AnimatePresence mode="wait">
          <motion.div key={employeeFilter}
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Icon name="book-open" size={24} className="text-muted-foreground/30" />
            </div>
            <p className="font-medium text-foreground">
              {search
                ? `Sin resultados para "${search}"`
                : employeeFilter === 'ENROLLED'  ? 'No tienes cursos en progreso'
                : employeeFilter === 'AVAILABLE' ? 'Ya estás inscrito en todos los cursos'
                : employeeFilter === 'COMPLETED' ? 'Aún no has completado ningún curso'
                : 'No hay cursos disponibles'}
            </p>
            <p className="max-w-[260px] text-sm text-muted-foreground/70">
              {employeeFilter === 'AVAILABLE'
                ? 'Explora los cursos inscritos para continuar aprendiendo.'
                : employeeFilter === 'COMPLETED'
                ? 'Completa un curso para obtener tu certificado.'
                : 'Tu administrador publicará nuevos cursos pronto.'}
            </p>
            {employeeFilter !== 'ALL' && (
              <button onClick={() => setEmployeeFilter('ALL')}
                className="mt-1 text-xs font-semibold text-capta-deep dark:text-capta-soft hover:underline transition-colors">
                Ver todos los cursos →
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      ) : (
        <motion.div variants={listContainer} initial="initial" animate="animate"
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {employeeFiltered.map(course => (
            <EmployeeCourseCard key={course.id} course={course} onEnroll={handleEnroll} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
