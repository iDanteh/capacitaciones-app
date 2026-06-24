'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/capta-icon';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuizSummary {
  id:          string;
  title:       string;
  description: string | null;
  timeLimit:   number | null;
  minScore:    number;
  isActive:    boolean;
  createdAt:   string;
  createdBy:   { firstName: string; lastName: string };
  _count:      { questions: number; assignments: number };
}

type QuizFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

// ─── Animations ───────────────────────────────────────────────────────────────

const listContainer = { animate: { transition: { staggerChildren: 0.04 } } };
const listItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 28 } },
};

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

// ─── QuizCardSkeleton ─────────────────────────────────────────────────────────

function QuizCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="relative h-16 bg-muted overflow-hidden"><ShimmerOverlay /></div>
      <div className="p-5 space-y-3">
        <div className="relative h-4 bg-muted rounded w-3/4 overflow-hidden"><ShimmerOverlay /></div>
        <div className="relative h-3 bg-muted/60 rounded w-full overflow-hidden"><ShimmerOverlay /></div>
        <div className="relative h-3 bg-muted/60 rounded w-2/3 overflow-hidden"><ShimmerOverlay /></div>
        <div className="flex gap-2 pt-1">
          <div className="relative h-5 bg-muted/60 rounded-lg w-24 overflow-hidden"><ShimmerOverlay /></div>
          <div className="relative h-5 bg-muted/60 rounded-lg w-20 overflow-hidden"><ShimmerOverlay /></div>
        </div>
        <div className="pt-2 border-t border-border">
          <div className="relative h-8 bg-muted rounded-xl overflow-hidden"><ShimmerOverlay /></div>
        </div>
      </div>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ title, body, action }: {
  title:  string;
  body:   string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center gap-3"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <Icon name="clipboard" size={24} className="text-muted-foreground/30" />
      </div>
      <div>
        <p className="font-medium text-foreground mb-1">{title}</p>
        <p className="text-sm text-muted-foreground max-w-[260px] mx-auto">{body}</p>
      </div>
      {action}
    </motion.div>
  );
}

// ─── QuizCard ─────────────────────────────────────────────────────────────────

function QuizCard({ quiz, onDelete }: { quiz: QuizSummary; onDelete: (id: string) => void }) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const { success, error: toastError }    = useToast();

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/quizzes/${quiz.id}`);
      onDelete(quiz.id);
      success('Quiz eliminado');
    } catch {
      toastError('Error al eliminar el quiz');
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  return (
    <motion.div
      variants={listItem}
      className="group flex flex-col rounded-2xl border border-border bg-card overflow-hidden transition-all duration-200 hover:-translate-y-1"
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
      whileHover={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 16px 40px rgba(11,31,42,0.12)' }}
    >
      {/* Header zone */}
      <div
        className="relative flex h-16 flex-shrink-0 items-center justify-between px-5"
        style={{
          background: quiz.isActive
            ? 'linear-gradient(135deg, color-mix(in srgb, var(--tenant-primary) 12%, transparent), color-mix(in srgb, var(--tenant-primary) 5%, transparent))'
            : 'hsl(var(--muted) / 0.5)',
        }}
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{
            background: quiz.isActive
              ? 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, #000) 100%)'
              : 'hsl(var(--muted-foreground) / 0.12)',
          }}
        >
          <Icon
            name="clipboard"
            size={18}
            className={quiz.isActive ? 'text-white' : 'text-muted-foreground/40'}
          />
        </div>

        <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
          quiz.isActive
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
            : 'bg-background/60 text-muted-foreground border border-border/60'
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
            quiz.isActive ? 'bg-emerald-500' : 'bg-muted-foreground/40'
          }`} />
          {quiz.isActive ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5 gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-sm text-foreground leading-snug line-clamp-2 mb-1.5">
            {quiz.title}
          </h3>
          {quiz.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {quiz.description}
            </p>
          )}
        </div>

        {/* Metadata chips */}
        <div className="flex flex-wrap gap-1.5">
          <span className="flex items-center gap-1 rounded-lg bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
            <Icon name="clipboard" size={10} />
            {quiz._count.questions} {quiz._count.questions === 1 ? 'pregunta' : 'preguntas'}
          </span>
          <span className="flex items-center gap-1 rounded-lg bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
            <Icon name="users" size={10} />
            {quiz._count.assignments} {quiz._count.assignments === 1 ? 'asignado' : 'asignados'}
          </span>
          {quiz.timeLimit && (
            <span className="flex items-center gap-1 rounded-lg bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
              <Icon name="clock" size={10} />
              {Math.floor(quiz.timeLimit / 60)} min
            </span>
          )}
          <span className="flex items-center gap-1 rounded-lg bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
            <Icon name="check" size={10} />
            mín. {quiz.minScore}%
          </span>
        </div>

        {/* Actions */}
        <div className="pt-2 border-t border-border">
          <AnimatePresence mode="wait" initial={false}>
            {!deleteConfirm ? (
              <motion.div key="actions"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center justify-between gap-2">
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Eliminar quiz"
                >
                  <Icon name="trash" size={13} />
                </button>
                <Link
                  href={`/dashboard/quizzes/${quiz.id}`}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all hover:scale-[1.02]"
                  style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)' }}
                >
                  <Icon name="edit" size={11} /> Editar
                </Link>
              </motion.div>
            ) : (
              <motion.div key="confirm"
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="flex items-center justify-between gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2">
                <p className="text-xs text-destructive font-medium">¿Eliminar?</p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors"
                  >
                    No
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-white bg-destructive hover:bg-destructive/90 disabled:opacity-60 transition-all"
                  >
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QuizzesPage() {
  const [quizzes,     setQuizzes]     = useState<QuizSummary[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [filter,      setFilter]      = useState<QuizFilter>('ALL');

  const load = useCallback(async () => {
    try {
      const res = await api.get<QuizSummary[]>('/quizzes');
      setQuizzes(res.data);
    } catch { /* empty state */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = useCallback((id: string) => {
    setQuizzes(prev => prev.filter(q => q.id !== id));
  }, []);

  const stats = useMemo(() => ({
    total:       quizzes.length,
    active:      quizzes.filter(q => q.isActive).length,
    inactive:    quizzes.filter(q => !q.isActive).length,
    assignments: quizzes.reduce((acc, q) => acc + q._count.assignments, 0),
    questions:   quizzes.reduce((acc, q) => acc + q._count.questions, 0),
  }), [quizzes]);

  const filtered = useMemo(() => {
    const q = searchInput.toLowerCase();
    return quizzes.filter(quiz => {
      const matchSearch =
        quiz.title.toLowerCase().includes(q) ||
        (quiz.description ?? '').toLowerCase().includes(q);
      const matchFilter =
        filter === 'ACTIVE'   ? quiz.isActive  :
        filter === 'INACTIVE' ? !quiz.isActive :
        true;
      return matchSearch && matchFilter;
    });
  }, [quizzes, searchInput, filter]);

  const TABS: { key: QuizFilter; label: string; count: number }[] = [
    { key: 'ALL',      label: 'Todos',     count: stats.total    },
    { key: 'ACTIVE',   label: 'Activos',   count: stats.active   },
    { key: 'INACTIVE', label: 'Inactivos', count: stats.inactive },
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
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Quizzes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea evaluaciones y asígnalas directamente a tu equipo.
          </p>
        </div>
        <Link
          href="/dashboard/quizzes/new"
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-md active:scale-[0.97] flex-shrink-0 self-start"
          style={{
            background:  'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)',
            boxShadow:   '0 2px 10px color-mix(in srgb, var(--tenant-primary) 25%, transparent)',
          }}
        >
          <Icon name="plus" size={15} /> Nuevo quiz
        </Link>
      </motion.div>

      {/* Stats — always rendered; shimmer while loading to prevent layout jump */}
      <motion.div
        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.05 }}
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="relative h-[84px] rounded-2xl border border-border bg-card overflow-hidden">
              <ShimmerOverlay />
            </div>
          ))
        ) : (
          [
            { label: 'Total quizzes', value: stats.total,       icon: 'clipboard'    as const, bg: 'color-mix(in srgb, var(--tenant-primary) 12%, transparent)', bd: 'color-mix(in srgb, var(--tenant-primary) 22%, transparent)', ic: 'var(--tenant-primary)' },
            { label: 'Activos',       value: stats.active,      icon: 'check-circle' as const, bg: '#7FD1AE18', bd: '#7FD1AE30', ic: '#7FD1AE' },
            { label: 'Asignaciones',  value: stats.assignments, icon: 'users'        as const, bg: '#8FC4E818', bd: '#8FC4E830', ic: '#8FC4E8' },
            { label: 'Preguntas',     value: stats.questions,   icon: 'file'         as const, bg: '#F59E0B18', bd: '#F59E0B30', ic: '#F59E0B' },
          ].map(s => (
            <div
              key={s.label}
              className="rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5"
              style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {s.label}
                </p>
                <div
                  className="h-7 w-7 flex items-center justify-center rounded-lg"
                  style={{ background: s.bg, border: `1px solid ${s.bd}` }}
                >
                  <Icon name={s.icon} size={13} style={{ color: s.ic }} />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </div>
          ))
        )}
      </motion.div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        {/* Search */}
        <div className="relative">
          <Icon name="search" size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar quizzes..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full rounded-xl border border-border bg-background pl-9 pr-9 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-capta-soft/60 transition-all"
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

        {/* Filter tabs */}
        <div className="flex gap-2">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                filter === tab.key
                  ? 'text-white shadow-sm'
                  : 'border border-border bg-background text-muted-foreground hover:text-foreground hover:border-capta-deep/30'
              }`}
              style={filter === tab.key
                ? { background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)' }
                : {}}
            >
              {tab.label}
              <span className={`rounded-full px-1.5 text-[10px] font-bold min-w-[18px] text-center leading-[18px] ${
                filter === tab.key ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
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
          <motion.div
            key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {[...Array(6)].map((_, i) => <QuizCardSkeleton key={i} />)}
          </motion.div>

        ) : filtered.length === 0 ? (
          <EmptyState
            key={`empty-${filter}-${searchInput}`}
            title={
              searchInput     ? 'Sin resultados'  :
              filter === 'ACTIVE'   ? 'Sin quizzes activos'   :
              filter === 'INACTIVE' ? 'Sin quizzes inactivos' :
              'Sin quizzes todavía'
            }
            body={
              searchInput
                ? `No se encontraron quizzes para "${searchInput}"`
                : filter !== 'ALL'
                ? 'Ajusta el filtro para ver otros quizzes.'
                : 'Crea tu primer quiz para evaluar el conocimiento de tu equipo.'
            }
            action={
              !searchInput && filter === 'ALL' ? (
                <Link
                  href="/dashboard/quizzes/new"
                  className="mt-1 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02]"
                  style={{
                    background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)',
                    boxShadow:  '0 2px 10px color-mix(in srgb, var(--tenant-primary) 25%, transparent)',
                  }}
                >
                  <Icon name="plus" size={15} /> Crear quiz
                </Link>
              ) : (searchInput || filter !== 'ALL') ? (
                <button
                  onClick={() => { setSearchInput(''); setFilter('ALL'); }}
                  className="text-xs font-semibold text-capta-deep dark:text-capta-soft hover:underline transition-colors"
                >
                  Limpiar filtros →
                </button>
              ) : undefined
            }
          />

        ) : (
          <motion.div
            key={`grid-${filter}`}
            variants={listContainer} initial="initial" animate="animate"
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {filtered.map(quiz => (
              <QuizCard key={quiz.id} quiz={quiz} onDelete={handleDelete} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
