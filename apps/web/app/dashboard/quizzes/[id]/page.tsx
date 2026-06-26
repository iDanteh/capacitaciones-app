'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/capta-icon';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuizOption   { id: string; text: string; isCorrect: boolean; order: number }
interface QuizQuestion { id: string; text: string; explanation: string | null; order: number; options: QuizOption[] }

interface Quiz {
  id:           string;
  title:        string;
  description:  string | null;
  instructions: string | null;
  timeLimit:    number | null;
  minScore:     number;
  isActive:     boolean;
  questions:    QuizQuestion[];
  _count:       { assignments: number };
}

interface UserItem { id: string; firstName: string; lastName: string; email: string; avatarUrl: string | null }

interface Assignment {
  id:         string;
  userId:     string;
  status:     'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  dueDate:    string | null;
  assignedAt: string;
  user:       { id: string; firstName: string; lastName: string; email: string };
  attempt:    { score: number | null; passed: boolean | null; submittedAt: string | null } | null;
}

// ─── Shared ───────────────────────────────────────────────────────────────────

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

const inputCls =
  'w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground ' +
  'placeholder:text-muted-foreground/40 outline-none transition-all ' +
  'hover:border-capta-deep/30 dark:hover:border-capta-soft/30 ' +
  'focus:border-capta-soft focus:ring-2 focus:ring-capta-soft/20 focus:ring-offset-1';

// Avatar inicial con color determinista
function Avatar({ name, size = 8 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const colors   = [
    ['#dbeafe', '#1d4ed8'], ['#dcfce7', '#15803d'], ['#fef9c3', '#a16207'],
    ['#fce7f3', '#be185d'], ['#ede9fe', '#7c3aed'], ['#e0f2fe', '#0369a1'],
  ];
  const [bg, fg] = colors[initials.charCodeAt(0) % colors.length];
  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold`}
      style={{ width: `${size * 4}px`, height: `${size * 4}px`, background: bg, color: fg }}
    >
      {initials}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QuizEditPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const { success, error: toastError } = useToast();

  const [quiz,        setQuiz]        = useState<Quiz | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState<'questions' | 'assign' | 'results' | 'settings'>('questions');

  const load = useCallback(async () => {
    try {
      const [qRes, aRes] = await Promise.all([
        api.get<Quiz>(`/quizzes/${id}`),
        api.get<Assignment[]>(`/quizzes/${id}/assignments`),
      ]);
      setQuiz(qRes.data);
      setAssignments(aRes.data);
    } catch { router.replace('/dashboard/quizzes'); }
    finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { void load(); }, [load]);

  const handlePublish = async () => {
    try {
      await api.patch(`/quizzes/${id}`, { isActive: true });
      const res = await api.get<Quiz>(`/quizzes/${id}`);
      setQuiz(res.data);
      success('Quiz publicado', 'Ahora puedes asignarlo a empleados');
    } catch {
      toastError('Error al publicar el quiz');
    }
  };

  const TABS = [
    { key: 'questions' as const, label: 'Preguntas',     icon: 'clipboard'   },
    { key: 'assign'    as const, label: 'Asignar',       icon: 'user-plus'   },
    { key: 'results'   as const, label: 'Resultados',    icon: 'chart-bar'   },
    { key: 'settings'  as const, label: 'Configuración', icon: 'gear'        },
  ] as const;

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-background">
      {/* Sticky bar skeleton */}
      <div className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl">
        <div className="relative h-4 w-16 rounded-full bg-muted overflow-hidden"><ShimmerOverlay /></div>
        <span className="text-border/60">›</span>
        <div className="relative h-4 w-40 rounded-full bg-muted overflow-hidden"><ShimmerOverlay /></div>
      </div>
      <div className="mx-auto max-w-4xl px-4 py-8 lg:px-6 space-y-6">
        <div className="relative h-10 rounded-xl bg-muted overflow-hidden"><ShimmerOverlay /></div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="relative h-24 rounded-2xl bg-muted overflow-hidden"><ShimmerOverlay /></div>
          ))}
        </div>
      </div>
    </div>
  );

  if (!quiz) return null;

  return (
    <div className="min-h-screen bg-background">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-4 lg:px-6">
          <div className="flex h-14 items-center gap-3">
            {/* Breadcrumb */}
            <button
              onClick={() => router.back()}
              className="group flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            >
              <Icon name="arrow-left" size={14} className="transition-transform group-hover:-translate-x-0.5" />
              Quizzes
            </button>
            <span className="text-border/60">›</span>
            <span className="max-w-[200px] truncate text-sm font-medium text-foreground/80">{quiz.title}</span>

            {/* Badge */}
            <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold flex-shrink-0 ${
              quiz.isActive
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${quiz.isActive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {quiz.isActive ? 'Publicado' : 'Borrador'}
            </span>

            {/* Publicar CTA */}
            <AnimatePresence>
              {!quiz.isActive && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => void handlePublish()}
                  className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all hover:scale-[1.02] hover:brightness-110 active:scale-[0.97]"
                  style={{ background: 'var(--tenant-primary)' }}
                >
                  <Icon name="check-circle" size={12} />
                  Publicar quiz
                </motion.button>
              )}
            </AnimatePresence>

            {/* Meta */}
            <p className={`text-xs text-muted-foreground ${!quiz.isActive ? '' : 'ml-auto'}`}>
              {quiz.questions.length} pregunta{quiz.questions.length !== 1 ? 's' : ''} · {quiz._count.assignments} asignación{quiz._count.assignments !== 1 ? 'es' : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 lg:px-6">

        {/* ── Tabs ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          className="relative mb-6 flex rounded-xl border border-border bg-muted/20 p-1"
        >
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors duration-200"
              style={{
                color: activeTab === tab.key ? 'var(--foreground)' : 'var(--muted-foreground)',
              }}
            >
              {activeTab === tab.key && (
                <motion.div
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-lg bg-card"
                  style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.6) inset' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
              )}
              <Icon name={tab.icon as never} size={13} className="relative" />
              <span className="relative hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </motion.div>

        {/* ── Tab content ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
          >
            {activeTab === 'questions' && <QuestionsTab quiz={quiz} onUpdate={setQuiz} />}
            {activeTab === 'assign'    && <AssignTab quiz={quiz} assignments={assignments} onUpdate={setAssignments} onQuizUpdate={setQuiz} />}
            {activeTab === 'results'   && <ResultsTab assignments={assignments} minScore={quiz.minScore} />}
            {activeTab === 'settings'  && <SettingsTab quiz={quiz} onUpdate={setQuiz} />}
          </motion.div>
        </AnimatePresence>

      </div>
    </div>
  );
}

// ─── QuestionsTab ─────────────────────────────────────────────────────────────

function QuestionsTab({ quiz, onUpdate }: { quiz: Quiz; onUpdate: (q: Quiz) => void }) {
  const { success, error: toastError } = useToast();
  const [adding,          setAdding]          = useState(false);
  const [qText,           setQText]           = useState('');
  const [qExpl,           setQExpl]           = useState('');
  const [options,         setOptions]         = useState([{ text: '', isCorrect: true }, { text: '', isCorrect: false }]);
  const [saving,          setSaving]          = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting,        setDeleting]        = useState(false);
  const [expandedId,      setExpandedId]      = useState<string | null>(null);

  const addOption    = () => setOptions(o => [...o, { text: '', isCorrect: false }]);
  const removeOption = (i: number) => setOptions(o => o.filter((_, idx) => idx !== i));
  const setCorrect   = (i: number) => setOptions(o => o.map((opt, idx) => ({ ...opt, isCorrect: idx === i })));

  const handleAddQuestion = async () => {
    if (!qText.trim() || options.some(o => !o.text.trim()) || !options.some(o => o.isCorrect)) return;
    setSaving(true);
    try {
      await api.post(`/quizzes/${quiz.id}/questions`, {
        text: qText.trim(), explanation: qExpl.trim() || undefined, options,
      });
      const qRes = await api.get<Quiz>(`/quizzes/${quiz.id}`);
      onUpdate(qRes.data);
      setQText(''); setQExpl('');
      setOptions([{ text: '', isCorrect: true }, { text: '', isCorrect: false }]);
      setAdding(false);
      success('Pregunta agregada');
    } catch {
      toastError('Error al guardar la pregunta');
    } finally { setSaving(false); }
  };

  const handleRemoveQuestion = async (qid: string) => {
    setDeleting(true);
    try {
      await api.delete(`/quizzes/${quiz.id}/questions/${qid}`);
      onUpdate({ ...quiz, questions: quiz.questions.filter(q => q.id !== qid) });
      setConfirmDeleteId(null);
      if (expandedId === qid) setExpandedId(null);
      success('Pregunta eliminada');
    } catch {
      toastError('Error al eliminar');
      setConfirmDeleteId(null);
    } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-4">

      {/* ── Empty state ── */}
      {quiz.questions.length === 0 && !adding && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border py-20 text-center"
        >
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: 'color-mix(in srgb, var(--tenant-primary) 8%, var(--muted))' }}
          >
            <Icon name="clipboard" size={24} className="text-muted-foreground/40" />
          </div>
          <p className="text-sm font-semibold text-foreground">Sin preguntas todavía</p>
          <p className="mt-1 text-xs text-muted-foreground">Agrega la primera pregunta para comenzar</p>
          <button
            onClick={() => setAdding(true)}
            className="mt-5 flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)' }}
          >
            <Icon name="plus" size={14} />
            Agregar primera pregunta
          </button>
        </motion.div>
      )}

      {/* ── Grid 2 columnas ── */}
      {quiz.questions.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {quiz.questions.map((q, idx) => {
            const correctOpt  = q.options.find(o => o.isCorrect);
            const isExpanded  = expandedId === q.id;
            const isConfirming = confirmDeleteId === q.id;

            return (
              <motion.div
                key={q.id}
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.04, layout: { type: 'spring', stiffness: 300, damping: 30 } }}
                className={`flex flex-col rounded-2xl border bg-card transition-all ${
                  isExpanded ? 'border-capta-soft/40 shadow-md' : 'border-border'
                }`}
                style={{ boxShadow: isExpanded
                  ? '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.08)'
                  : '0 1px 0 rgba(255,255,255,0.6) inset, 0 2px 8px rgba(11,31,42,0.04)'
                }}
              >
                {/* Cabecera de la tarjeta — siempre visible */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : q.id)}
                  className="flex items-start gap-3 p-4 text-left"
                >
                  {/* Número */}
                  <span
                    className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 60%, #000) 100%)' }}
                  >
                    {idx + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    {/* Texto de la pregunta */}
                    <p className="text-sm font-semibold leading-snug text-foreground line-clamp-2">
                      {q.text}
                    </p>
                    {/* Respuesta correcta siempre visible como chip */}
                    {correctOpt && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500">
                          <Icon name="check" size={8} className="text-white" />
                        </div>
                        <p className="truncate text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                          {correctOpt.text}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Indicadores compactos */}
                  <div className="flex flex-shrink-0 flex-col items-end gap-2">
                    <span className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {q.options.length} opc.
                    </span>
                    <Icon
                      name="chevron-down"
                      size={13}
                      className={`text-muted-foreground/50 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>

                {/* Detalle expandible */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border/60 px-4 pb-4 pt-3 space-y-3">

                        {/* Todas las opciones */}
                        <div className="space-y-1.5">
                          {q.options.map(opt => (
                            <div
                              key={opt.id}
                              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-xs ${
                                opt.isCorrect
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400'
                                  : 'border-border bg-muted/20 text-muted-foreground'
                              }`}
                            >
                              <div className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${
                                opt.isCorrect
                                  ? 'border-emerald-500 bg-emerald-500'
                                  : 'border-border bg-background'
                              }`}>
                                {opt.isCorrect && <Icon name="check" size={8} className="text-white" />}
                              </div>
                              <span className={opt.isCorrect ? 'font-medium' : ''}>{opt.text}</span>
                            </div>
                          ))}
                        </div>

                        {/* Explicación */}
                        {q.explanation && (
                          <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
                            <Icon name="info" size={11} className="mt-0.5 flex-shrink-0 text-muted-foreground/60" />
                            <p className="text-xs italic text-muted-foreground">{q.explanation}</p>
                          </div>
                        )}

                        {/* Acción eliminar */}
                        <div className="flex justify-end pt-1">
                          <AnimatePresence mode="wait" initial={false}>
                            {isConfirming ? (
                              <motion.div
                                key="confirm"
                                initial={{ opacity: 0, scale: 0.92 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.92 }}
                                className="flex items-center gap-1.5 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-1.5"
                              >
                                <p className="text-xs font-semibold text-destructive">¿Eliminar?</p>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  No
                                </button>
                                <button
                                  onClick={() => void handleRemoveQuestion(q.id)}
                                  disabled={deleting}
                                  className="flex items-center gap-1 rounded-lg bg-destructive px-2.5 py-1 text-xs font-semibold text-white hover:bg-destructive/90 disabled:opacity-60 transition-all"
                                >
                                  {deleting && <Icon name="refresh" size={10} className="animate-spin" />}
                                  Sí, eliminar
                                </button>
                              </motion.div>
                            ) : (
                              <motion.button
                                key="trash"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setConfirmDeleteId(q.id)}
                                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20"
                              >
                                <Icon name="trash" size={12} />
                                Eliminar pregunta
                              </motion.button>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Panel nueva pregunta (full-width, debajo del grid) ── */}
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="rounded-2xl border border-border bg-card p-5 space-y-4"
            style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.06)' }}
          >
            {/* Header del panel */}
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)' }}
                >
                  {quiz.questions.length + 1}
                </div>
                <h3 className="text-sm font-semibold text-foreground">Nueva pregunta</h3>
              </div>
              <button
                onClick={() => setAdding(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Icon name="close" size={14} />
              </button>
            </div>

            {/* Campos en grid 2 col */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

              {/* Col izq: pregunta + explicación */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                    Pregunta
                  </label>
                  <textarea
                    value={qText}
                    onChange={e => setQText(e.target.value)}
                    rows={3}
                    placeholder="¿Cuál es el procedimiento correcto para…?"
                    className={`${inputCls} resize-none`}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                      Explicación
                    </label>
                    <span className="text-xs text-muted-foreground/50">Opcional</span>
                  </div>
                  <input
                    value={qExpl}
                    onChange={e => setQExpl(e.target.value)}
                    placeholder="Se muestra si el empleado falla esta pregunta…"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Col der: opciones */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                    Opciones · <span className="font-normal normal-case">marca la correcta</span>
                  </label>
                  <button
                    onClick={addOption}
                    className="flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-75"
                    style={{ color: 'var(--tenant-primary)' }}
                  >
                    <Icon name="plus" size={11} /> Agregar
                  </button>
                </div>

                <div className="space-y-2">
                  {options.map((opt, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-2"
                    >
                      <button
                        onClick={() => setCorrect(i)}
                        className={`flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all ${
                          opt.isCorrect
                            ? 'border-emerald-500 bg-emerald-500 shadow-sm shadow-emerald-200 dark:shadow-emerald-900/30'
                            : 'border-border bg-background hover:border-emerald-400'
                        }`}
                      >
                        {opt.isCorrect && <Icon name="check" size={9} className="text-white" />}
                      </button>
                      <input
                        value={opt.text}
                        onChange={e => setOptions(o => o.map((x, idx) => idx === i ? { ...x, text: e.target.value } : x))}
                        placeholder={`Opción ${i + 1}`}
                        className={inputCls}
                      />
                      {options.length > 2 && (
                        <button
                          onClick={() => removeOption(i)}
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20"
                        >
                          <Icon name="close" size={13} />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer del panel */}
            <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-4">
              <button
                onClick={handleAddQuestion}
                disabled={saving || !qText.trim() || options.some(o => !o.text.trim())}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.97]"
                style={{
                  background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)',
                  boxShadow:  '0 2px 10px color-mix(in srgb, var(--tenant-primary) 25%, transparent)',
                }}
              >
                {saving && <Icon name="refresh" size={14} className="animate-spin" />}
                Guardar pregunta
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Botón agregar ── */}
      {!adding && quiz.questions.length > 0 && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-3.5 text-sm font-medium text-muted-foreground transition-all hover:border-capta-soft/50 hover:bg-muted/20 hover:text-foreground"
        >
          <Icon name="plus" size={15} />
          Agregar pregunta
        </motion.button>
      )}

    </div>
  );
}

// ─── AssignTab ────────────────────────────────────────────────────────────────

function AssignTab({ quiz, assignments, onUpdate, onQuizUpdate }: {
  quiz:         Quiz;
  assignments:  Assignment[];
  onUpdate:     (a: Assignment[]) => void;
  onQuizUpdate: (q: Quiz) => void;
}) {
  const { success, error: toastError } = useToast();
  const [users,        setUsers]        = useState<UserItem[]>([]);
  const [mode,         setMode]         = useState<'all' | 'specific'>('all');
  const [selected,     setSelected]     = useState<string[]>([]);
  const [search,       setSearch]       = useState('');
  const [dueDate,      setDueDate]      = useState('');
  const [assigning,    setAssigning]    = useState(false);
  const [publishing,   setPublishing]   = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    if (!quiz.isActive) { setLoadingUsers(false); return; }
    api.get<{ employees: UserItem[] }>(`/quizzes/${quiz.id}/employees`)
      .then(r => setUsers(r.data.employees ?? []))
      .catch(() => undefined)
      .finally(() => setLoadingUsers(false));
  }, [quiz.id, quiz.isActive]);

  const assignedIds = new Set(assignments.map(a => a.userId));
  const available   = users.filter(u => !assignedIds.has(u.id));
  const filtered    = search.trim()
    ? available.filter(u =>
        `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase())
      )
    : available;

  const toAssign = mode === 'all' ? available.map(u => u.id) : selected;
  const toggle   = (uid: string) => setSelected(s => s.includes(uid) ? s.filter(x => x !== uid) : [...s, uid]);

  const handleAssign = async () => {
    if (!toAssign.length) return;
    setAssigning(true);
    try {
      await api.post(`/quizzes/${quiz.id}/assign`, { userIds: toAssign, dueDate: dueDate || undefined });
      const aRes = await api.get<Assignment[]>(`/quizzes/${quiz.id}/assignments`);
      onUpdate(aRes.data);
      setSelected([]); setSearch('');
      success(`Quiz asignado a ${toAssign.length} empleado${toAssign.length !== 1 ? 's' : ''}`);
    } catch {
      toastError('Error al asignar el quiz');
    } finally { setAssigning(false); }
  };

  const handleRemove = async (aid: string) => {
    try {
      await api.delete(`/quizzes/${quiz.id}/assignments/${aid}`);
      onUpdate(assignments.filter(a => a.id !== aid));
      success('Asignación eliminada');
    } catch {
      toastError('No se puede eliminar — el quiz ya fue completado');
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await api.patch(`/quizzes/${quiz.id}`, { isActive: true });
      const res = await api.get<Quiz>(`/quizzes/${quiz.id}`);
      onQuizUpdate(res.data);
      success('Quiz publicado', 'Ahora puedes asignarlo a empleados');
    } catch {
      toastError('Error al publicar el quiz');
    } finally { setPublishing(false); }
  };

  const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
    PENDING:     { label: 'Pendiente',   cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'     },
    IN_PROGRESS: { label: 'En progreso', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'         },
    COMPLETED:   { label: 'Completado',  cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' },
  };

  // Draft gate
  if (!quiz.isActive) {
    return (
      <div className="flex flex-col items-center gap-5 rounded-2xl border-2 border-dashed border-border px-6 py-16 text-center">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: 'color-mix(in srgb, var(--tenant-primary) 8%, var(--muted))' }}
        >
          <Icon name="lock" size={22} className="text-muted-foreground/40" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Quiz en borrador</p>
          <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-muted-foreground">
            Publica el quiz para habilitar las asignaciones. Podrás seguir editando las preguntas después de publicar.
          </p>
        </div>
        <button
          onClick={() => void handlePublish()}
          disabled={publishing}
          className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:brightness-110 disabled:opacity-50 active:scale-[0.97]"
          style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)', boxShadow: '0 2px 12px color-mix(in srgb, var(--tenant-primary) 30%, transparent)' }}
        >
          {publishing && <Icon name="refresh" size={14} className="animate-spin" />}
          Publicar quiz
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Asignaciones activas ── */}
      {assignments.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Asignaciones activas</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {assignments.length}
            </span>
          </div>

          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card"
            style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset' }}
          >
            {assignments.map((a, i) => {
              const s = STATUS_LABEL[a.status];
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/25 [box-shadow:inset_3px_0_0_transparent] hover:[box-shadow:inset_3px_0_0_var(--tenant-primary)]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={`${a.user.firstName} ${a.user.lastName}`} size={8} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {a.user.firstName} {a.user.lastName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{a.user.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {a.attempt?.score != null && (
                      <span className={`text-sm font-bold tabular-nums ${a.attempt.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        {a.attempt.score}%
                      </span>
                    )}
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${s.cls}`}>
                      {s.label}
                    </span>
                    {a.status !== 'COMPLETED' && (
                      <button
                        onClick={() => void handleRemove(a.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20"
                      >
                        <Icon name="close" size={12} />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Asignar quiz ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Asignar quiz</h3>
          {!loadingUsers && available.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {available.length} empleado{available.length !== 1 ? 's' : ''} disponible{available.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Loading skeleton */}
        {loadingUsers && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="relative h-16 rounded-xl bg-muted/50 overflow-hidden">
                <ShimmerOverlay />
              </div>
            ))}
          </div>
        )}

        {/* All assigned */}
        {!loadingUsers && available.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-10 text-center rounded-2xl border-2 border-dashed border-border">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl"
              style={{ background: 'color-mix(in srgb, #16a34a 10%, var(--muted))' }}
            >
              <Icon name="check-circle" size={18} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Todos asignados</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Todos los empleados ya tienen este quiz.</p>
            </div>
          </div>
        )}

        {/* Mode selector */}
        {!loadingUsers && available.length > 0 && (
          <>
            {/* Toggle modo */}
            <div className="relative flex rounded-xl border border-border bg-muted/20 p-1">
              {([
                { key: 'all'      as const, icon: 'users',    label: `Todos (${available.length})` },
                { key: 'specific' as const, icon: 'user-plus', label: 'Selección manual' },
              ] as const).map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setMode(opt.key)}
                  className="relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors duration-200"
                  style={{ color: mode === opt.key ? 'var(--foreground)' : 'var(--muted-foreground)' }}
                >
                  {mode === opt.key && (
                    <motion.div
                      layoutId="assign-mode-pill"
                      className="absolute inset-0 rounded-lg bg-card"
                      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.6) inset' }}
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    />
                  )}
                  <Icon name={opt.icon as never} size={13} className="relative" />
                  <span className="relative">{opt.label}</span>
                </button>
              ))}
            </div>

            {/* Lista empleados (modo specific) */}
            <AnimatePresence initial={false}>
              {mode === 'specific' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2.5 pt-1">
                    {/* Search */}
                    <div className="relative">
                      <Icon name="search" size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Buscar por nombre o correo…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className={`${inputCls} pl-9`}
                      />
                    </div>

                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-xs text-muted-foreground">
                        {selected.length > 0
                          ? `${selected.length} seleccionado${selected.length !== 1 ? 's' : ''}`
                          : `${filtered.length} empleado${filtered.length !== 1 ? 's' : ''}`}
                      </span>
                      <button
                        onClick={() => setSelected(
                          selected.length === filtered.length && filtered.length > 0
                            ? []
                            : filtered.map(u => u.id)
                        )}
                        className="text-xs font-semibold transition-colors hover:opacity-80"
                        style={{ color: 'var(--tenant-primary)' }}
                      >
                        {selected.length === filtered.length && filtered.length > 0
                          ? 'Quitar selección'
                          : 'Seleccionar todos'}
                      </button>
                    </div>

                    {filtered.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        Sin resultados para &ldquo;{search}&rdquo;
                      </p>
                    ) : (
                      <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border bg-card p-1"
                        style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset' }}
                      >
                        {filtered.map(u => {
                          const isSelected = selected.includes(u.id);
                          return (
                            <button
                              key={u.id}
                              onClick={() => toggle(u.id)}
                              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
                                isSelected ? 'bg-muted/50' : 'hover:bg-muted/30'
                              }`}
                            >
                              <div
                                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 transition-all ${
                                  isSelected
                                    ? 'border-transparent'
                                    : 'border-border bg-background'
                                }`}
                                style={isSelected ? { background: 'var(--tenant-primary)' } : {}}
                              >
                                {isSelected && <Icon name="check" size={9} className="text-white" />}
                              </div>
                              <Avatar name={`${u.firstName} ${u.lastName}`} size={7} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-foreground">{u.firstName} {u.lastName}</p>
                                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Fecha + submit */}
            <div className="space-y-3 border-t border-border/60 pt-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Icon name="clock" size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className={`${inputCls} w-auto pl-9`}
                  />
                </div>
                <span className="text-xs text-muted-foreground">Fecha límite (opcional)</span>
              </div>

              <button
                onClick={() => void handleAssign()}
                disabled={assigning || toAssign.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all hover:scale-[1.01] hover:brightness-110 disabled:opacity-50 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, var(--tenant-primary), color-mix(in srgb, var(--tenant-primary) 72%, white))', boxShadow: '0 2px 12px color-mix(in srgb, var(--tenant-primary) 25%, transparent)' }}
              >
                {assigning && <Icon name="refresh" size={14} className="animate-spin" />}
                {assigning
                  ? 'Asignando…'
                  : mode === 'all'
                  ? `Asignar a todos los empleados (${available.length})`
                  : toAssign.length === 0
                  ? 'Selecciona empleados'
                  : `Asignar a ${toAssign.length} empleado${toAssign.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── ResultsTab ───────────────────────────────────────────────────────────────

function ResultsTab({ assignments, minScore }: { assignments: Assignment[]; minScore: number }) {
  const completed = assignments.filter(a => a.status === 'COMPLETED' && a.attempt?.score != null);
  const pending   = assignments.filter(a => a.status === 'PENDING');
  const inProg    = assignments.filter(a => a.status === 'IN_PROGRESS');
  const passed    = completed.filter(a => a.attempt?.passed);
  const failed    = completed.filter(a => !a.attempt?.passed);
  const avg       = completed.length
    ? Math.round(completed.reduce((s, a) => s + (a.attempt?.score ?? 0), 0) / completed.length)
    : null;

  const passRate = completed.length > 0 ? Math.round((passed.length / completed.length) * 100) : null;

  const stats = [
    { label: 'Aprobados',   value: passed.length,                  sub: passRate != null ? `${passRate}% de completados` : '',  color: '#16a34a' },
    { label: 'Reprobados',  value: failed.length,                  sub: '',                                                      color: '#ef4444' },
    { label: 'Pendientes',  value: pending.length + inProg.length, sub: inProg.length > 0 ? `${inProg.length} en progreso` : '', color: '#f59e0b' },
    { label: 'Promedio',    value: avg != null ? `${avg}%` : '—',  sub: `Mínimo ${minScore}%`,                                  color: 'var(--tenant-primary)' },
  ];

  return (
    <div className="space-y-5">

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-2xl border border-border bg-card p-4"
            style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 4px 12px rgba(11,31,42,0.04)' }}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">{s.label}</p>
              <div
                className="h-2 w-2 rounded-full"
                style={{ background: s.color, boxShadow: `0 0 6px ${s.color}60` }}
              />
            </div>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            {s.sub && <p className="mt-1 text-[11px] text-muted-foreground">{s.sub}</p>}
          </motion.div>
        ))}
      </div>

      {/* Barra progreso global */}
      {completed.length > 0 && (
        <div className="rounded-2xl border border-border bg-card px-5 py-4"
          style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset' }}
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Tasa de aprobación</p>
            <p className="text-xs font-bold tabular-nums" style={{ color: '#16a34a' }}>
              {passRate ?? 0}%
            </p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${passRate ?? 0}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.3 }}
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #16a34a, #4ade80)' }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground/50">
            <span>{passed.length} aprobados</span>
            <span>{completed.length} completados</span>
          </div>
        </div>
      )}

      {/* Tabla resultados */}
      {completed.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border py-16 text-center">
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: 'color-mix(in srgb, var(--tenant-primary) 8%, var(--muted))' }}
          >
            <Icon name="chart-bar" size={24} className="text-muted-foreground/40" />
          </div>
          <p className="text-sm font-semibold text-foreground">Sin resultados todavía</p>
          <p className="mt-1 text-xs text-muted-foreground">Ningún empleado ha completado el quiz.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card"
          style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Empleado</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Calificación</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Resultado</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {completed.map((a, i) => (
                <motion.tr
                  key={a.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="group transition-colors hover:bg-muted/25"
                >
                  <td className="px-4 py-3 transition-shadow duration-150 group-hover:[box-shadow:inset_3px_0_0_var(--tenant-primary)]">
                    <div className="flex items-center gap-3">
                      <Avatar name={`${a.user.firstName} ${a.user.lastName}`} size={7} />
                      <div>
                        <p className="font-medium text-foreground">{a.user.firstName} {a.user.lastName}</p>
                        <p className="text-xs text-muted-foreground">{a.user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-base font-bold tabular-nums ${
                      (a.attempt?.score ?? 0) >= minScore
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-500'
                    }`}>
                      {a.attempt?.score ?? 0}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                      a.attempt?.passed
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                    }`}>
                      {a.attempt?.passed ? 'Aprobado' : 'Reprobado'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs tabular-nums text-muted-foreground">
                    {a.attempt?.submittedAt
                      ? new Date(a.attempt.submittedAt).toLocaleDateString('es-MX', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })
                      : '—'}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── SettingsTab ──────────────────────────────────────────────────────────────

function SettingsTab({ quiz, onUpdate }: { quiz: Quiz; onUpdate: (q: Quiz) => void }) {
  const { success, error: toastError } = useToast();
  const [title,        setTitle]        = useState(quiz.title);
  const [description,  setDescription]  = useState(quiz.description ?? '');
  const [instructions, setInstructions] = useState(quiz.instructions ?? '');
  const [minScore,     setMinScore]     = useState(quiz.minScore);
  const [timeLimitMin, setTimeLimitMin] = useState(quiz.timeLimit ? String(Math.floor(quiz.timeLimit / 60)) : '');
  const [isActive,     setIsActive]     = useState(quiz.isActive);
  const [saving,       setSaving]       = useState(false);

  const scoreColor =
    minScore >= 90 ? '#ef4444' :
    minScore >= 70 ? 'var(--tenant-primary)' :
    '#22c55e';

  const scoreLabel =
    minScore >= 90 ? 'Muy exigente' :
    minScore >= 70 ? 'Estándar' :
    'Flexible';

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/quizzes/${quiz.id}`, {
        title:        title.trim(),
        description:  description.trim()  || null,
        instructions: instructions.trim() || null,
        minScore,
        isActive,
        timeLimit: timeLimitMin ? parseInt(timeLimitMin) * 60 : null,
      });
      const res = await api.get<Quiz>(`/quizzes/${quiz.id}`);
      onUpdate(res.data);
      success('Cambios guardados');
    } catch {
      toastError('Error al guardar');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">

      {/* ── Bento grid ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">

        {/* ── Celda A: General (columna izquierda, ocupa toda la altura) ── */}
        <div
          className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6"
          style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 4px 16px rgba(11,31,42,0.05)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-lg"
              style={{ background: 'color-mix(in srgb, var(--tenant-primary) 12%, transparent)' }}
            >
              <Icon name="clipboard" size={13} style={{ color: 'var(--tenant-primary)' } as React.CSSProperties} />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">General</p>
          </div>

          {/* Título */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-foreground">
              Título <span className="text-destructive">*</span>
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className={inputCls}
              placeholder="Título del quiz"
            />
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label className="block text-sm font-semibold text-foreground">Descripción</label>
              <span className="text-xs text-muted-foreground/50">Opcional</span>
            </div>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Breve descripción del objetivo del quiz…"
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Instrucciones */}
          <div className="flex-1 space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label className="block text-sm font-semibold text-foreground">Instrucciones para el empleado</label>
              <span className="text-xs text-muted-foreground/50">Opcional</span>
            </div>
            <textarea
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              rows={4}
              placeholder="Instrucciones que verá el empleado antes de comenzar…"
              className={`${inputCls} h-full min-h-[96px] resize-none`}
            />
          </div>
        </div>

        {/* ── Columna derecha: 2 celdas apiladas ── */}
        <div className="flex flex-col gap-4">

          {/* ── Celda B: Score (celda grande con preview animado) ── */}
          <div
            className="relative overflow-hidden rounded-2xl border border-border bg-card p-6"
            style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 4px 16px rgba(11,31,42,0.05)' }}
          >
            {/* Acento superior con color dinámico */}
            <motion.div
              animate={{ background: `linear-gradient(90deg, ${scoreColor}, color-mix(in srgb, ${scoreColor} 40%, transparent))` }}
              transition={{ duration: 0.4 }}
              className="absolute inset-x-0 top-0 h-0.5"
            />

            <div className="mb-5 flex items-center gap-2">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-lg transition-colors duration-300"
                style={{ background: `color-mix(in srgb, ${scoreColor} 12%, transparent)` }}
              >
                <Icon name="chart-bar" size={13} style={{ color: scoreColor } as React.CSSProperties} />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Calificación mínima</p>
            </div>

            {/* Display grande animado */}
            <div className="mb-5 flex items-end justify-between">
              <div>
                <motion.p
                  key={minScore}
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                  className="text-5xl font-bold tabular-nums leading-none"
                  style={{ color: scoreColor }}
                >
                  {minScore}
                </motion.p>
                <p className="mt-1 text-lg font-light text-muted-foreground">%</p>
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={scoreLabel}
                  initial={{ opacity: 0, y: 6, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.9 }}
                  transition={{ duration: 0.18 }}
                  className="rounded-xl px-3 py-1.5 text-xs font-bold"
                  style={{
                    background: `color-mix(in srgb, ${scoreColor} 12%, transparent)`,
                    color: scoreColor,
                  }}
                >
                  {scoreLabel}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Slider */}
            <input
              type="range"
              min={0} max={100} step={5}
              value={minScore}
              onChange={e => setMinScore(Number(e.target.value))}
              className="w-full cursor-pointer"
              style={{ accentColor: scoreColor }}
            />

            {/* Barra visual */}
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
              <motion.div
                animate={{ width: `${minScore}%`, background: scoreColor }}
                transition={{ type: 'spring', stiffness: 180, damping: 22 }}
                className="h-full rounded-full"
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/40">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>

          {/* ── Celda C: Tiempo + Visibilidad (celda inferior) ── */}
          <div
            className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6"
            style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 4px 16px rgba(11,31,42,0.05)' }}
          >
            {/* Tiempo límite */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-lg"
                  style={{ background: 'color-mix(in srgb, var(--tenant-primary) 12%, transparent)' }}
                >
                  <Icon name="clock" size={13} style={{ color: 'var(--tenant-primary)' } as React.CSSProperties} />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Tiempo límite</p>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  value={timeLimitMin}
                  onChange={e => setTimeLimitMin(e.target.value)}
                  placeholder="Sin límite"
                  className={`${inputCls} ${timeLimitMin ? 'pr-12' : ''}`}
                />
                {timeLimitMin && (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60">
                    min
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground/50">Déjalo vacío para sin límite de tiempo</p>
            </div>

            {/* Divisor */}
            <div className="h-px bg-border/60" />

            {/* Toggle visibilidad */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-lg transition-colors duration-200"
                    style={{
                      background: isActive
                        ? 'color-mix(in srgb, #16a34a 12%, transparent)'
                        : 'color-mix(in srgb, var(--muted-foreground) 12%, transparent)',
                    }}
                  >
                    <Icon
                      name={isActive ? 'globe' : 'lock'}
                      size={13}
                      style={{ color: isActive ? '#16a34a' : 'var(--muted-foreground)' } as React.CSSProperties}
                    />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Visibilidad</p>
                </div>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={String(isActive)}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -3 }}
                    transition={{ duration: 0.15 }}
                    className="mt-1.5 text-xs leading-relaxed text-muted-foreground"
                  >
                    {isActive
                      ? 'Activo · Los empleados pueden completarlo'
                      : 'Borrador · Solo visible para administradores'}
                  </motion.p>
                </AnimatePresence>
              </div>

              {/* Toggle pill animado */}
              <button
                onClick={() => setIsActive(v => !v)}
                className={`relative flex-shrink-0 h-7 w-13 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  isActive ? 'focus:ring-emerald-500/40' : 'focus:ring-muted-foreground/20'
                }`}
                style={{
                  width: '52px',
                  background: isActive ? '#16a34a' : 'var(--muted-foreground)',
                  opacity: isActive ? 1 : 0.35,
                }}
              >
                <motion.div
                  animate={{ x: isActive ? 26 : 2 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  className="absolute top-1.5 h-4 w-4 rounded-full bg-white shadow-sm"
                />
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ── Acción guardar ── */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-3"
        style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset' }}
      >
        <p className="text-xs text-muted-foreground">
          Los cambios se aplican de inmediato para nuevas asignaciones
        </p>
        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 transition-all hover:scale-[1.02] hover:brightness-110 active:scale-[0.97]"
          style={{
            background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)',
            boxShadow:  '0 2px 12px color-mix(in srgb, var(--tenant-primary) 30%, transparent)',
          }}
        >
          {saving
            ? <><Icon name="refresh" size={14} className="animate-spin" /> Guardando…</>
            : <><Icon name="check" size={14} /> Guardar cambios</>
          }
        </button>
      </div>

    </div>
  );
}