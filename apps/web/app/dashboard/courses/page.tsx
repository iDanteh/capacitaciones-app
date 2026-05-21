'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Icon } from '@/components/capta-icon';
import { api } from '@/lib/api';

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

// ─── Helpers de diseño ────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  DRAFT:     { label: 'Borrador',  className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  PUBLISHED: { label: 'Publicado', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' },
  ARCHIVED:  { label: 'Archivado', className: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' },
};

const listContainer = { animate: { transition: { staggerChildren: 0.05 } } };
const listItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

// ─── Componente CourseCard ────────────────────────────────────────────────────

function CourseCard({ course, role }: { course: Course; role: string }) {
  const status = STATUS_CONFIG[course.status];
  const canEdit = ['OWNER', 'ADMIN'].includes(role);

  return (
    <motion.div
      variants={listItem}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="group relative flex flex-col rounded-2xl border border-border bg-card hover:border-capta-soft/30 transition-all duration-200 overflow-hidden"
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
    >
      {/* Thumbnail */}
      <div className="relative h-40 flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, rgba(30,79,122,0.05), rgba(143,196,232,0.10))' }}>
        {course.thumbnailUrl ? (
          <img
            src={course.thumbnailUrl}
            alt={course.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon name="book-open" size={36} className="text-capta-soft/40" />
          </div>
        )}

        {/* Status badge */}
        <span className={`absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-xs font-semibold ${status.className}`}>
          {status.label}
        </span>

        {/* Acciones rápidas (hover) */}
        {canEdit && (
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <Link
              href={`/dashboard/courses/${course.id}`}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 dark:bg-gray-900/90 shadow-sm text-gray-600 dark:text-gray-400 hover:text-capta-deep dark:hover:text-capta-soft transition-colors"
            >
              <Icon name="more-vertical" size={14} />
            </Link>
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="flex flex-1 flex-col p-5 gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-foreground leading-snug line-clamp-2 mb-1">
            {course.title}
          </h3>
          {course.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {course.description}
            </p>
          )}
        </div>

        {/* Barra de progreso (solo cuando el usuario está inscrito) */}
        {course.isEnrolled && course.myProgress !== undefined && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Tu progreso</span>
              <span className="font-semibold" style={{ color: '#7FD1AE' }}>{course.myProgress}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${course.myProgress}%`, background: 'linear-gradient(90deg, #1F5C4D, #7FD1AE)' }}
              />
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Icon name="file" size={12} />
            {course.totalLessons} {course.totalLessons === 1 ? 'lección' : 'lecciones'}
          </span>
          {canEdit && course.enrollmentCount !== undefined && (
            <span className="flex items-center gap-1">
              <Icon name="users" size={12} />
              {course.enrollmentCount} {course.enrollmentCount === 1 ? 'inscrito' : 'inscritos'}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          {course.authorName && (
            <span className="text-xs text-muted-foreground truncate max-w-[60%]">
              {course.authorName}
            </span>
          )}
          <div className="flex items-center gap-2 ml-auto">
            {canEdit && (
              <Link
                href={`/dashboard/courses/${course.id}`}
                className="flex items-center gap-1 text-xs font-medium text-capta-deep dark:text-capta-soft hover:underline"
              >
                Editar <Icon name="arrow-right" size={12} />
              </Link>
            )}
            {course.status === 'PUBLISHED' && (
              <Link
                href={`/dashboard/courses/${course.id}/learn`}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all hover:scale-[1.03]"
                style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)', boxShadow: '0 2px 8px rgba(30,79,122,0.25)' }}
              >
                {course.isEnrolled ? (
                  <><Icon name="play" size={11} /> {course.myProgress === 100 ? 'Ver de nuevo' : course.myProgress && course.myProgress > 0 ? 'Continuar' : 'Iniciar'}</>
                ) : (
                  <><Icon name="play" size={11} /> Ver curso</>
                )}
              </Link>
            )}
          </div>
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
      <div className="p-5 space-y-3">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-3 bg-muted rounded w-2/3" />
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<string>('ALL');
  const [role, setRole]       = useState('EMPLOYEE');

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (raw) {
      try { setRole((JSON.parse(raw) as { role: string }).role); } catch {}
    }

    api.get<Course[]>('/courses')
      .then(res => setCourses(res.data))
      .catch(() => setError('No se pudieron cargar los cursos.'))
      .finally(() => setLoading(false));
  }, []);

  const canCreate = ['OWNER', 'ADMIN'].includes(role);

  const filtered = courses.filter(c => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'ALL' || c.status === filter;
    return matchSearch && matchFilter;
  });

  const stats = {
    total:     courses.length,
    published: courses.filter(c => c.status === 'PUBLISHED').length,
    draft:     courses.filter(c => c.status === 'DRAFT').length,
    lessons:   courses.reduce((acc, c) => acc + c.totalLessons, 0),
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Cursos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestiona el contenido de capacitación de tu empresa.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/dashboard/courses/new"
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.03] active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)', boxShadow: '0 2px 10px rgba(30,79,122,0.25)' }}
          >
            <Icon name="plus" size={16} /> Nuevo curso
          </Link>
        )}
      </div>

      {/* ── Stats Bento ── */}
      {!loading && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          {[
            { label: 'Total de cursos', value: stats.total,     iconName: 'book-open'   as const, accent: '#1E4F7A' },
            { label: 'Publicados',      value: stats.published, iconName: 'check-circle' as const, accent: '#7FD1AE' },
            { label: 'En borrador',     value: stats.draft,     iconName: 'file'         as const, accent: '#F59E0B' },
            { label: 'Total lecciones', value: stats.lessons,   iconName: 'video'        as const, accent: '#8FC4E8' },
          ].map(s => (
            <div key={s.label}
              className="rounded-2xl border border-border bg-card p-4"
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

      {/* ── Filtros ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar cursos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-background pl-9 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-capta-soft/40 focus:border-capta-soft transition-all"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['ALL', 'PUBLISHED', 'DRAFT', 'ARCHIVED'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === s
                  ? 'text-white'
                  : 'border border-border bg-background text-muted-foreground hover:text-foreground hover:border-capta-deep/30'
              }`}
              style={filter === s ? { background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' } : {}}
            >
              {s === 'ALL' ? 'Todos' : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid de cursos ── */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(6)].map((_, i) => <CourseCardSkeleton key={i} />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Icon name="book-open" size={40} className="text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Icon name="book-open" size={40} className="text-muted-foreground/30 mb-4" />
          <p className="font-medium text-foreground mb-1">
            {search ? 'Sin resultados' : 'Aún no hay cursos'}
          </p>
          <p className="text-sm text-muted-foreground mb-5">
            {search
              ? `No se encontraron cursos con "${search}"`
              : 'Crea tu primer curso de capacitación.'}
          </p>
          {canCreate && !search && (
            <Link
              href="/dashboard/courses/new"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)', boxShadow: '0 2px 10px rgba(30,79,122,0.25)' }}
            >
              <Icon name="plus" size={15} /> Crear primer curso
            </Link>
          )}
        </div>
      ) : (
        <motion.div
          variants={listContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {filtered.map(course => (
            <CourseCard key={course.id} course={course} role={role} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
