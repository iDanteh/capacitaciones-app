'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, type IconName } from '@/components/capta-icon';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';

// ─── Types ────────────────────────────────────────────────────────────────────

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

type ViewMode       = 'grid' | 'list';
type AdminFilter    = 'ALL' | 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';
type EmployeeFilter = 'ALL' | 'ENROLLED' | 'AVAILABLE' | 'COMPLETED';
type SortBy         = 'newest' | 'oldest' | 'az' | 'za' | 'popular';

const SORT_OPTIONS: { key: SortBy; label: string }[] = [
  { key: 'newest',  label: 'Más recientes' },
  { key: 'oldest',  label: 'Más antiguos'  },
  { key: 'az',      label: 'A → Z'          },
  { key: 'za',      label: 'Z → A'          },
  { key: 'popular', label: 'Más inscritos'  },
];

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Animations ───────────────────────────────────────────────────────────────

const listContainer = { animate: { transition: { staggerChildren: 0.04 } } };
const listItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 28 } },
};

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  DRAFT:     { label: 'Borrador',  className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  PUBLISHED: { label: 'Publicado', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' },
  ARCHIVED:  { label: 'Archivado', className: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' },
};

// ─── ProgressRing ─────────────────────────────────────────────────────────────

function ProgressRing({ progress, size = 44, isComplete = false }: {
  progress: number;
  size?: number;
  isComplete?: boolean;
}) {
  const sw = 3;
  const r  = (size - sw * 2) / 2;
  const c  = 2 * Math.PI * r;
  const offset = c - (Math.min(progress, 100) / 100) * c;
  const color  = isComplete ? '#16a34a' : progress > 0 ? '#7FD1AE' : '#cbd5e1';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0 text-foreground">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="hsl(var(--border))" strokeWidth={sw} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1)' }}
      />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em"
        fontSize={size * 0.21} fontWeight="700"
        fill={isComplete ? '#16a34a' : 'currentColor'}>
        {progress}%
      </text>
    </svg>
  );
}

// ─── ShimmerOverlay ───────────────────────────────────────────────────────────

function ShimmerOverlay() {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none -skew-x-12"
      style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.07) 50%, transparent 100%)' }}
      animate={{ x: ['-120%', '220%'] }}
      transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.6 }}
    />
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function CourseCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="relative h-44 bg-muted overflow-hidden"><ShimmerOverlay /></div>
      <div className="p-5 space-y-3">
        <div className="relative h-4 bg-muted rounded w-3/4 overflow-hidden"><ShimmerOverlay /></div>
        <div className="relative h-3 bg-muted/60 rounded w-full overflow-hidden"><ShimmerOverlay /></div>
        <div className="relative h-3 bg-muted/60 rounded w-2/3 overflow-hidden"><ShimmerOverlay /></div>
        <div className="pt-2 border-t border-border">
          <div className="relative h-9 bg-muted rounded-xl overflow-hidden"><ShimmerOverlay /></div>
        </div>
      </div>
    </div>
  );
}

function CourseListSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3">
      <div className="relative h-12 w-[72px] flex-shrink-0 rounded-lg bg-muted overflow-hidden"><ShimmerOverlay /></div>
      <div className="flex-1 space-y-2">
        <div className="relative h-4 bg-muted rounded w-1/2 overflow-hidden"><ShimmerOverlay /></div>
        <div className="relative h-3 bg-muted/60 rounded w-2/3 overflow-hidden"><ShimmerOverlay /></div>
      </div>
      <div className="relative hidden sm:block h-5 w-20 bg-muted rounded-full overflow-hidden"><ShimmerOverlay /></div>
      <div className="relative h-7 w-24 bg-muted rounded-lg overflow-hidden"><ShimmerOverlay /></div>
    </div>
  );
}

// ─── AdminCourseCard (grid) ───────────────────────────────────────────────────

function AdminCourseCard({ course, onDelete }: {
  course: Course;
  onDelete: (id: string) => Promise<void>;
}) {
  const status = STATUS_CONFIG[course.status];
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting]           = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try { await onDelete(course.id); }
    finally { setDeleting(false); setDeleteConfirm(false); }
  };

  return (
    <motion.div
      variants={listItem}
      className="group relative flex flex-col rounded-2xl border border-border bg-card overflow-hidden transition-all duration-200 hover:-translate-y-1"
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
      whileHover={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 16px 40px rgba(11,31,42,0.12)' }}
    >
      {/* Thumbnail */}
      <div className="relative h-44 flex-shrink-0 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(30,79,122,0.05), rgba(143,196,232,0.10))' }}>
        {course.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.thumbnailUrl} alt={course.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon name="book-open" size={36} className="text-capta-soft/30" />
          </div>
        )}
        {/* Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        {/* Status badge */}
        <span className={`absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${status.className}`}>
          {status.label}
        </span>
        {/* Lesson chip */}
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 backdrop-blur-sm">
          <Icon name="file" size={9} className="text-white/70" />
          <span className="text-[10px] font-medium text-white">
            {course.totalLessons} {course.totalLessons === 1 ? 'lección' : 'lecciones'}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5 gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-sm text-foreground leading-snug line-clamp-2 mb-1">{course.title}</h3>
          {course.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{course.description}</p>
          )}
        </div>

        {course.enrollmentCount !== undefined && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Icon name="users" size={11} />
            <span>{course.enrollmentCount} {course.enrollmentCount === 1 ? 'inscrito' : 'inscritos'}</span>
          </div>
        )}

        {/* Actions */}
        <div className="pt-2 border-t border-border">
          <AnimatePresence mode="wait" initial={false}>
            {!deleteConfirm ? (
              <motion.div key="actions"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center justify-between gap-2">
                <button onClick={() => setDeleteConfirm(true)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Eliminar curso">
                  <Icon name="trash" size={13} />
                </button>
                <div className="flex items-center gap-2">
                  {course.status === 'PUBLISHED' && (
                    <Link href={`/dashboard/courses/${course.id}/learn`}
                      className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-capta-deep/30 transition-colors">
                      <Icon name="play" size={10} /> Vista previa
                    </Link>
                  )}
                  <Link href={`/dashboard/courses/${course.id}`}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all hover:scale-[1.02]"
                    style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' }}>
                    <Icon name="edit" size={11} /> Editar
                  </Link>
                </div>
              </motion.div>
            ) : (
              <motion.div key="confirm"
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="flex items-center justify-between gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2">
                <p className="text-xs text-destructive font-medium">¿Eliminar?</p>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setDeleteConfirm(false)}
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors">No</button>
                  <button onClick={handleDelete} disabled={deleting}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-white bg-destructive hover:bg-destructive/90 disabled:opacity-60 transition-all">
                    {deleting && <Icon name="refresh" size={10} className="animate-spin" />}
                    Eliminar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ─── AdminCourseListRow ───────────────────────────────────────────────────────

function AdminCourseListRow({ course, onDelete }: {
  course: Course;
  onDelete: (id: string) => Promise<void>;
}) {
  const status = STATUS_CONFIG[course.status];
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting]           = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try { await onDelete(course.id); }
    finally { setDeleting(false); setDeleteConfirm(false); }
  };

  return (
    <motion.div
      variants={listItem}
      className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 transition-all duration-150 hover:border-capta-soft/30 hover:bg-muted/30"
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset' }}
    >
      {/* Mini thumbnail */}
      <div className="h-12 w-[72px] flex-shrink-0 rounded-lg overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(30,79,122,0.06), rgba(143,196,232,0.12))' }}>
        {course.thumbnailUrl
          ? <img src={course.thumbnailUrl} alt="" className="h-full w-full object-cover" />  // eslint-disable-line @next/next/no-img-element
          : <div className="h-full w-full flex items-center justify-center">
              <Icon name="book-open" size={16} className="text-capta-soft/40" />
            </div>
        }
      </div>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground line-clamp-1">{course.title}</p>
        {course.description && (
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{course.description}</p>
        )}
      </div>

      {/* Status */}
      <span className={`hidden sm:inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold flex-shrink-0 ${status.className}`}>
        {status.label}
      </span>

      {/* Lessons */}
      <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0 w-[68px]">
        <Icon name="file" size={11} />
        <span>{course.totalLessons} lec.</span>
      </div>

      {/* Enrolled */}
      {course.enrollmentCount !== undefined && (
        <div className="hidden lg:flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0 w-[68px]">
          <Icon name="users" size={11} />
          <span>{course.enrollmentCount}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <AnimatePresence mode="wait" initial={false}>
          {!deleteConfirm ? (
            <motion.div key="row-actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2">
              <button onClick={() => setDeleteConfirm(true)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <Icon name="trash" size={12} />
              </button>
              <Link href={`/dashboard/courses/${course.id}`}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:border-capta-deep/30 hover:bg-muted transition-colors">
                <Icon name="edit" size={11} /> Editar
              </Link>
            </motion.div>
          ) : (
            <motion.div key="row-confirm" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-1.5">
              <button onClick={() => setDeleteConfirm(false)}
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors">
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white bg-destructive hover:bg-destructive/90 disabled:opacity-60 transition-all">
                {deleting && <Icon name="refresh" size={10} className="animate-spin" />}
                Eliminar
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── EmployeeCourseCard ───────────────────────────────────────────────────────

function EmployeeCourseCard({ course, onEnroll }: {
  course: Course;
  onEnroll: (courseId: string) => Promise<void>;
}) {
  const [enrolling, setEnrolling] = useState(false);

  const progress     = course.myProgress ?? 0;
  const isCompleted  = course.isEnrolled && progress === 100;
  const isInProgress = course.isEnrolled && progress > 0 && !isCompleted;
  const isNotStarted = course.isEnrolled && progress === 0;

  const handleEnroll = async () => {
    setEnrolling(true);
    try { await onEnroll(course.id); }
    finally { setEnrolling(false); }
  };

  return (
    <motion.div
      variants={listItem}
      className="group relative flex flex-col rounded-2xl border border-border bg-card overflow-hidden transition-all duration-200 hover:-translate-y-1"
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.04)' }}
      whileHover={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 16px 40px rgba(11,31,42,0.12)' }}
    >
      {/* Thumbnail */}
      <div className="relative h-44 flex-shrink-0 overflow-hidden bg-muted">
        {course.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.thumbnailUrl} alt={course.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(30,79,122,0.06), rgba(143,196,232,0.12))' }}>
            <Icon name="book-open" size={36} className="text-capta-soft/40" />
          </div>
        )}
        {/* Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {/* Estado badge */}
        <div className="absolute top-3 left-3">
          {isCompleted && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
              <Icon name="check" size={9} /> Completado
            </span>
          )}
          {isInProgress && (
            <span className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm"
              style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' }}>
              <Icon name="play" size={9} /> En progreso
            </span>
          )}
          {isNotStarted && (
            <span className="flex items-center gap-1 rounded-full border border-white/30 bg-black/40 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
              Inscrito
            </span>
          )}
        </div>

        {/* Lesson chip */}
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 backdrop-blur-sm">
          <Icon name="file" size={9} className="text-white/70" />
          <span className="text-[10px] font-medium text-white">
            {course.totalLessons} {course.totalLessons === 1 ? 'lección' : 'lecciones'}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4 gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-sm text-foreground leading-snug line-clamp-2 mb-1.5">{course.title}</h3>
          {course.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{course.description}</p>
          )}
        </div>

        {/* Progress ring row */}
        {course.isEnrolled && (
          <div className="flex items-center gap-3 pt-2 border-t border-border">
            <ProgressRing progress={progress} size={44} isComplete={isCompleted} />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">
                {isCompleted ? '¡Completado!' : `${progress}% avanzado`}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isCompleted ? 'Puedes verlo de nuevo' : isInProgress ? 'Sigue avanzando' : 'Sin iniciar'}
              </p>
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
              {enrolling
                ? <><Icon name="refresh" size={12} className="animate-spin" /> Inscribiendo…</>
                : <><Icon name="plus" size={12} /> Inscribirme</>
              }
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ icon, title, body, action }: {
  icon: IconName;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center gap-3"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <Icon name={icon} size={24} className="text-muted-foreground/30" />
      </div>
      <div>
        <p className="font-medium text-foreground mb-1">{title}</p>
        <p className="text-sm text-muted-foreground max-w-[260px] mx-auto">{body}</p>
      </div>
      {action}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CoursesPage() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [courses, setCourses]   = useState<Course[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [role, setRole]         = useState('EMPLOYEE');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);

  const [adminFilter,    setAdminFilter]    = useState<AdminFilter>('ALL');
  const [employeeFilter, setEmployeeFilter] = useState<EmployeeFilter>('ALL');
  const [sortBy,         setSortBy]         = useState<SortBy>('newest');

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
      setCourses(prev => prev.map(c =>
        c.id === courseId ? { ...c, isEnrolled: true, myProgress: 0 } : c
      ));
      toastSuccess('¡Inscripción exitosa! Ya puedes comenzar el curso.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toastError(Array.isArray(msg) ? msg[0] : (msg ?? 'No se pudo completar la inscripción'));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAdmin   = ['OWNER', 'ADMIN', 'MANAGER'].includes(role);
  const canCreate = ['OWNER', 'ADMIN'].includes(role);

  const adminStats = useMemo(() => ({
    total:     courses.length,
    published: courses.filter(c => c.status === 'PUBLISHED').length,
    draft:     courses.filter(c => c.status === 'DRAFT').length,
    archived:  courses.filter(c => c.status === 'ARCHIVED').length,
    lessons:   courses.reduce((acc, c) => acc + c.totalLessons, 0),
  }), [courses]);

  const employeeStats = useMemo(() => ({
    available:  courses.filter(c => !c.isEnrolled).length,
    inProgress: courses.filter(c => c.isEnrolled && (c.myProgress ?? 0) > 0 && c.myProgress !== 100).length,
    enrolled:   courses.filter(c => c.isEnrolled && (c.myProgress ?? 0) < 100).length,
    completed:  courses.filter(c => c.isEnrolled && c.myProgress === 100).length,
  }), [courses]);

  const adminFiltered = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = courses.filter(c => {
      const matchSearch =
        c.title.toLowerCase().includes(q) ||
        (c.description ?? '').toLowerCase().includes(q);
      const matchFilter = adminFilter === 'ALL' || c.status === adminFilter;
      return matchSearch && matchFilter;
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'oldest':  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'az':      return a.title.localeCompare(b.title, 'es');
        case 'za':      return b.title.localeCompare(a.title, 'es');
        case 'popular': return (b.enrollmentCount ?? 0) - (a.enrollmentCount ?? 0);
        default:        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // newest
      }
    });
  }, [courses, search, adminFilter, sortBy]);

  const employeeFiltered = useMemo(() => {
    const q = search.toLowerCase();
    return courses.filter(c => {
      const matchSearch =
        c.title.toLowerCase().includes(q) ||
        (c.description ?? '').toLowerCase().includes(q);
      const matchFilter =
        employeeFilter === 'ENROLLED'  ? (c.isEnrolled && (c.myProgress ?? 0) < 100) :
        employeeFilter === 'AVAILABLE' ? !c.isEnrolled :
        employeeFilter === 'COMPLETED' ? (c.isEnrolled && c.myProgress === 100) :
        true;
      return matchSearch && matchFilter;
    });
  }, [courses, search, employeeFilter]);

  // ── Search clear button ────────────────────────────────────────────────────
  const SearchInput = (
    <div className="relative flex-1">
      <Icon name="search" size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        placeholder="Buscar cursos..."
        value={searchInput}
        onChange={e => setSearchInput(e.target.value)}
        className="w-full rounded-xl border border-border bg-background pl-9 pr-9 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-capta-soft/40 focus:border-capta-soft/60 transition-all"
      />
      <AnimatePresence>
        {searchInput && (
          <motion.button
            initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
            onClick={() => setSearchInput('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="close" size={14} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );

  // ── Admin ──────────────────────────────────────────────────────────────────
  if (isAdmin) {
    const ADMIN_TABS: { key: AdminFilter; label: string; count: number }[] = [
      { key: 'ALL',       label: 'Todos',      count: adminStats.total },
      { key: 'PUBLISHED', label: 'Publicados',  count: adminStats.published },
      { key: 'DRAFT',     label: 'Borradores',  count: adminStats.draft },
      { key: 'ARCHIVED',  label: 'Archivados',  count: adminStats.archived },
    ];

    return (
      <div className="p-6 lg:p-8 space-y-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Cursos</h1>
            <p className="mt-1 text-sm text-muted-foreground">Gestiona el contenido de capacitación de tu empresa.</p>
          </div>
          {canCreate && (
            <Link
              href="/dashboard/courses/new"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-md active:scale-[0.97] flex-shrink-0 self-start"
              style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)', boxShadow: '0 2px 10px rgba(30,79,122,0.25)' }}
            >
              <Icon name="plus" size={15} /> Nuevo curso
            </Link>
          )}
        </motion.div>

        {/* Stats */}
        {!loading && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.05 }}
            className="grid grid-cols-2 gap-3 lg:grid-cols-4"
          >
            {[
              { label: 'Total cursos',    value: adminStats.total,     icon: 'book-open'    as const, accent: 'var(--tenant-primary)' },
              { label: 'Publicados',      value: adminStats.published, icon: 'check-circle' as const, accent: '#7FD1AE' },
              { label: 'En borrador',     value: adminStats.draft,     icon: 'file'         as const, accent: '#F59E0B' },
              { label: 'Total lecciones', value: adminStats.lessons,   icon: 'video'        as const, accent: '#8FC4E8' },
            ].map(s => (
              <div key={s.label}
                className="rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5"
                style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{s.label}</p>
                  <div className="h-7 w-7 flex items-center justify-center rounded-lg"
                    style={{ background: `${s.accent}15`, border: `1px solid ${s.accent}22` }}>
                    <Icon name={s.icon} size={13} style={{ color: s.accent }} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col gap-3">
          {/* Row 1: search + sort + view toggle */}
          <div className="flex items-center gap-3">
            {SearchInput}

            {/* Sort dropdown */}
            <div className="relative flex-shrink-0">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortBy)}
                className="appearance-none h-10 rounded-xl border border-border bg-background pl-3 pr-8 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-capta-soft/40 focus:border-capta-soft/60 transition-all cursor-pointer"
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
              <Icon name="chevron-down" size={12}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>

            {/* View toggle */}
            <div className="flex rounded-xl border border-border p-0.5 gap-0.5 bg-background flex-shrink-0">
              {([
                { mode: 'grid' as ViewMode, icon: 'grip-vertical' as const, label: 'Cuadrícula' },
                { mode: 'list' as ViewMode, icon: 'menu'          as const, label: 'Lista' },
              ]).map(({ mode, icon, label }) => (
                <button key={mode} onClick={() => setViewMode(mode)} title={label}
                  className={`flex h-8 items-center gap-1.5 px-2.5 rounded-[10px] text-xs font-medium transition-all duration-150 ${
                    viewMode === mode
                      ? 'bg-foreground text-background shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon name={icon} size={13} />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: tabs with counters */}
          <div className="flex gap-2 flex-wrap">
            {ADMIN_TABS.map(tab => (
              <button key={tab.key} onClick={() => setAdminFilter(tab.key)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  adminFilter === tab.key
                    ? 'text-white shadow-sm'
                    : 'border border-border bg-background text-muted-foreground hover:text-foreground hover:border-capta-deep/30'
                }`}
                style={adminFilter === tab.key ? { background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' } : {}}
              >
                {tab.label}
                <span className={`rounded-full px-1.5 text-[10px] font-bold min-w-[18px] text-center leading-[18px] ${
                  adminFilter === tab.key ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className={viewMode === 'grid'
                ? 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'space-y-2'
              }>
              {[...Array(6)].map((_, i) =>
                viewMode === 'grid' ? <CourseCardSkeleton key={i} /> : <CourseListSkeleton key={i} />
              )}
            </motion.div>

          ) : error ? (
            <EmptyState key="error" icon="alert-circle" title="Error al cargar" body={error} />

          ) : adminFiltered.length === 0 ? (
            <EmptyState
              key={`empty-${adminFilter}-${search}`}
              icon="book-open"
              title={search ? 'Sin resultados' : 'Aún no hay cursos'}
              body={
                search
                  ? `No se encontraron cursos para "${search}"`
                  : adminFilter !== 'ALL'
                  ? 'No hay cursos en esta categoría.'
                  : 'Crea tu primer curso de capacitación para comenzar.'
              }
              action={
                canCreate && !search && adminFilter === 'ALL' ? (
                  <Link href="/dashboard/courses/new"
                    className="mt-1 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02]"
                    style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)', boxShadow: '0 2px 10px rgba(30,79,122,0.25)' }}>
                    <Icon name="plus" size={15} /> Crear primer curso
                  </Link>
                ) : (search || adminFilter !== 'ALL' || sortBy !== 'newest') ? (
                  <button onClick={() => { setSearchInput(''); setAdminFilter('ALL'); setSortBy('newest'); }}
                    className="text-xs font-semibold text-capta-deep dark:text-capta-soft hover:underline transition-colors">
                    Limpiar filtros →
                  </button>
                ) : undefined
              }
            />

          ) : viewMode === 'grid' ? (
            <motion.div key={`grid-${adminFilter}`}
              variants={listContainer} initial="initial" animate="animate"
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {adminFiltered.map(course => (
                <AdminCourseCard key={course.id} course={course} onDelete={handleDeleteCourse} />
              ))}
            </motion.div>

          ) : (
            <motion.div key={`list-${adminFilter}`}
              variants={listContainer} initial="initial" animate="animate"
              className="space-y-2">
              {adminFiltered.map(course => (
                <AdminCourseListRow key={course.id} course={course} onDelete={handleDeleteCourse} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    );
  }

  // ── Employee ───────────────────────────────────────────────────────────────
  const EMPLOYEE_TABS: { key: EmployeeFilter; label: string; count: number }[] = [
    { key: 'ALL',       label: 'Todos',        count: courses.length },
    { key: 'AVAILABLE', label: 'Disponibles',  count: employeeStats.available },
    { key: 'ENROLLED',  label: 'En progreso',  count: employeeStats.inProgress },
    { key: 'COMPLETED', label: 'Completados',  count: employeeStats.completed },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Mi aprendizaje</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Explora los cursos disponibles e inscríbete para comenzar a aprender.
        </p>
      </motion.div>

      {/* Stats */}
      {!loading && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.05 }}
          className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Disponibles', value: employeeStats.available,  accent: 'var(--tenant-primary)', icon: 'book-open'    as const },
            { label: 'En progreso', value: employeeStats.inProgress, accent: '#8FC4E8', icon: 'play'         as const },
            { label: 'Inscritos',   value: employeeStats.enrolled,   accent: '#7FD1AE', icon: 'check-circle' as const },
            { label: 'Completados', value: employeeStats.completed,  accent: '#F59E0B', icon: 'certificate'  as const },
          ].map(s => (
            <div key={s.label}
              className="rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5"
              style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.04)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{s.label}</p>
                <div className="h-7 w-7 flex items-center justify-center rounded-lg"
                  style={{ background: `${s.accent}15`, border: `1px solid ${s.accent}22` }}>
                  <Icon name={s.icon} size={13} style={{ color: s.accent }} />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* Search + tabs */}
      <div className="flex flex-col gap-3">
        {SearchInput}
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
              <span className={`rounded-full px-1.5 text-[10px] font-bold min-w-[18px] text-center leading-[18px] ${
                employeeFilter === tab.key ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => <CourseCardSkeleton key={i} />)}
          </motion.div>

        ) : error ? (
          <EmptyState key="error" icon="alert-circle" title="Error al cargar" body={error} />

        ) : employeeFiltered.length === 0 ? (
          <EmptyState
            key={`empty-${employeeFilter}-${search}`}
            icon="book-open"
            title={
              search ? `Sin resultados para "${search}"` :
              employeeFilter === 'ENROLLED'  ? 'No tienes cursos en progreso' :
              employeeFilter === 'AVAILABLE' ? 'Ya estás inscrito en todos los cursos' :
              employeeFilter === 'COMPLETED' ? 'Aún no has completado ningún curso' :
              'No hay cursos disponibles'
            }
            body={
              employeeFilter === 'AVAILABLE' ? 'Explora los cursos inscritos para continuar aprendiendo.' :
              employeeFilter === 'COMPLETED'  ? 'Completa un curso para obtener tu certificado.' :
              'Tu administrador publicará nuevos cursos pronto.'
            }
            action={
              employeeFilter !== 'ALL' ? (
                <button onClick={() => setEmployeeFilter('ALL')}
                  className="text-xs font-semibold text-capta-deep dark:text-capta-soft hover:underline transition-colors">
                  Ver todos los cursos →
                </button>
              ) : undefined
            }
          />

        ) : (
          <motion.div key={`grid-${employeeFilter}`}
            variants={listContainer} initial="initial" animate="animate"
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {employeeFiltered.map(course => (
              <EmployeeCourseCard key={course.id} course={course} onEnroll={handleEnroll} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
