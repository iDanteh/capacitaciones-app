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

  if (loading) return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="space-y-2">
        <div className="relative h-3 w-20 rounded-full bg-muted overflow-hidden"><ShimmerOverlay /></div>
        <div className="relative h-6 w-64 rounded-xl bg-muted overflow-hidden"><ShimmerOverlay /></div>
        <div className="relative h-3 w-32 rounded-full bg-muted/60 overflow-hidden"><ShimmerOverlay /></div>
      </div>
      <div className="relative h-10 rounded-xl bg-muted overflow-hidden"><ShimmerOverlay /></div>
      <div className="relative h-64 rounded-2xl bg-muted overflow-hidden"><ShimmerOverlay /></div>
    </div>
  );

  if (!quiz) return null;

  return (
    <div className="p-6 lg:p-8 space-y-6">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="flex items-start justify-between gap-4"
      >
        <div className="flex-1 min-w-0">
          <button
            onClick={() => router.back()}
            className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="arrow-left" size={13} /> Quizzes
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold tracking-tight text-foreground truncate">{quiz.title}</h1>
            <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold flex-shrink-0 ${
              quiz.isActive
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                : 'bg-muted text-muted-foreground border border-border'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${quiz.isActive ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
              {quiz.isActive ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {quiz.questions.length} pregunta{quiz.questions.length !== 1 ? 's' : ''} · {quiz._count.assignments} asignación{quiz._count.assignments !== 1 ? 'es' : ''}
          </p>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.05 }}
        className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1"
      >
        {([
          { key: 'questions', label: 'Preguntas',    icon: 'clipboard'  },
          { key: 'assign',    label: 'Asignar',      icon: 'user-plus'  },
          { key: 'results',   label: 'Resultados',   icon: 'chart-bar'  },
          { key: 'settings',  label: 'Configuración', icon: 'gear'      },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name={tab.icon} size={13} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </motion.div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === 'questions' && <QuestionsTab quiz={quiz} onUpdate={setQuiz} />}
          {activeTab === 'assign'    && <AssignTab quizId={id} assignments={assignments} onUpdate={setAssignments} />}
          {activeTab === 'results'   && <ResultsTab assignments={assignments} minScore={quiz.minScore} />}
          {activeTab === 'settings'  && <SettingsTab quiz={quiz} onUpdate={setQuiz} />}
        </motion.div>
      </AnimatePresence>

    </div>
  );
}

// ─── QuestionsTab ─────────────────────────────────────────────────────────────

function QuestionsTab({ quiz, onUpdate }: { quiz: Quiz; onUpdate: (q: Quiz) => void }) {
  const { success, error: toastError } = useToast();
  const [adding, setAdding] = useState(false);

  const [qText,   setQText]   = useState('');
  const [qExpl,   setQExpl]   = useState('');
  const [options, setOptions] = useState([
    { text: '', isCorrect: true  },
    { text: '', isCorrect: false },
  ]);
  const [saving, setSaving] = useState(false);

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
    try {
      await api.delete(`/quizzes/${quiz.id}/questions/${qid}`);
      onUpdate({ ...quiz, questions: quiz.questions.filter(q => q.id !== qid) });
      success('Pregunta eliminada');
    } catch {
      toastError('Error al eliminar');
    }
  };

  return (
    <div className="space-y-4">
      {/* Empty state */}
      {quiz.questions.length === 0 && !adding && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-14 text-center"
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <Icon name="clipboard" size={22} className="text-muted-foreground/30" />
          </div>
          <p className="text-sm font-medium text-foreground">Sin preguntas todavía</p>
          <p className="mt-1 text-xs text-muted-foreground">Agrega la primera pregunta para empezar</p>
        </motion.div>
      )}

      {/* Question list */}
      {quiz.questions.map((q, idx) => (
        <div
          key={q.id}
          className="rounded-2xl border border-border bg-card p-5 space-y-3"
          style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 4px 12px rgba(11,31,42,0.04)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3 flex-1 min-w-0">
              <span
                className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, #000) 100%)' }}
              >
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-snug">{q.text}</p>
                {q.explanation && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Icon name="info" size={11} className="mt-0.5 flex-shrink-0" />
                    <span className="italic">{q.explanation}</span>
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => void handleRemoveQuestion(q.id)}
              className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-500 transition-colors"
            >
              <Icon name="trash" size={13} />
            </button>
          </div>

          <div className="space-y-1.5 pl-9">
            {q.options.map(opt => (
              <div
                key={opt.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                  opt.isCorrect
                    ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400'
                    : 'border-border bg-muted/30 text-muted-foreground'
                }`}
              >
                <div className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full ${
                  opt.isCorrect ? 'bg-emerald-500/20' : ''
                }`}>
                  <Icon name={opt.isCorrect ? 'check' : 'minus'} size={10} />
                </div>
                {opt.text}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Add question form */}
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="rounded-2xl border border-border bg-card p-5 space-y-4"
            style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.06)' }}
          >
            <h3 className="text-sm font-semibold text-foreground">Nueva pregunta</h3>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-[0.1em]">Pregunta</label>
              <textarea
                value={qText}
                onChange={e => setQText(e.target.value)}
                rows={2}
                placeholder="¿Cuál es el procedimiento correcto para...?"
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-[var(--tenant-primary)] focus:ring-2 focus:ring-[var(--tenant-primary)]/20 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-[0.1em]">Explicación <span className="normal-case text-muted-foreground/60">(opcional)</span></label>
              <input
                value={qExpl}
                onChange={e => setQExpl(e.target.value)}
                placeholder="Se muestra al revisar resultados si el empleado falla..."
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-[var(--tenant-primary)] focus:ring-2 focus:ring-[var(--tenant-primary)]/20 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-[0.1em]">
                  Opciones <span className="normal-case text-muted-foreground/60">(marca la correcta)</span>
                </label>
                <button
                  onClick={addOption}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Icon name="plus" size={11} /> Agregar opción
                </button>
              </div>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button
                    onClick={() => setCorrect(i)}
                    className={`flex-shrink-0 h-5 w-5 rounded-full border-2 transition-all ${
                      opt.isCorrect
                        ? 'border-emerald-500 bg-emerald-500 shadow-sm'
                        : 'border-border hover:border-emerald-400'
                    }`}
                  />
                  <input
                    value={opt.text}
                    onChange={e => setOptions(o => o.map((x, idx) => idx === i ? { ...x, text: e.target.value } : x))}
                    placeholder={`Opción ${i + 1}`}
                    className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[var(--tenant-primary)] focus:ring-2 focus:ring-[var(--tenant-primary)]/20 transition-colors"
                  />
                  {options.length > 2 && (
                    <button
                      onClick={() => removeOption(i)}
                      className="text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setAdding(false)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddQuestion}
                disabled={saving || !qText.trim() || options.some(o => !o.text.trim())}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 transition-all hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)' }}
              >
                {saving && <Icon name="refresh" size={12} className="animate-spin" />}
                Guardar pregunta
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3 text-sm text-muted-foreground hover:bg-muted/30 hover:border-[var(--tenant-primary)]/40 transition-colors"
        >
          <Icon name="plus" size={15} />
          Agregar pregunta
        </button>
      )}
    </div>
  );
}

// ─── AssignTab ────────────────────────────────────────────────────────────────

function AssignTab({ quizId, assignments, onUpdate }: {
  quizId:    string;
  assignments: Assignment[];
  onUpdate:  (a: Assignment[]) => void;
}) {
  const { success, error: toastError } = useToast();
  const [users,        setUsers]        = useState<UserItem[]>([]);
  const [selected,     setSelected]     = useState<string[]>([]);
  const [dueDate,      setDueDate]      = useState('');
  const [assigning,    setAssigning]    = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    api.get<{ users: UserItem[] }>('/users?role=EMPLOYEE&limit=200')
      .then(r => setUsers(r.data.users ?? []))
      .catch(() => undefined)
      .finally(() => setLoadingUsers(false));
  }, []);

  const assignedIds = new Set(assignments.map(a => a.userId));
  const available   = users.filter(u => !assignedIds.has(u.id));

  const toggle = (uid: string) =>
    setSelected(s => s.includes(uid) ? s.filter(x => x !== uid) : [...s, uid]);

  const handleAssign = async () => {
    if (!selected.length) return;
    setAssigning(true);
    try {
      await api.post(`/quizzes/${quizId}/assign`, { userIds: selected, dueDate: dueDate || undefined });
      const aRes = await api.get<Assignment[]>(`/quizzes/${quizId}/assignments`);
      onUpdate(aRes.data);
      setSelected([]);
      success(`Quiz asignado a ${selected.length} empleado${selected.length > 1 ? 's' : ''}`);
    } catch {
      toastError('Error al asignar el quiz');
    } finally { setAssigning(false); }
  };

  const handleRemove = async (aid: string) => {
    try {
      await api.delete(`/quizzes/${quizId}/assignments/${aid}`);
      onUpdate(assignments.filter(a => a.id !== aid));
      success('Asignación eliminada');
    } catch {
      toastError('No se puede eliminar — el quiz ya fue completado');
    }
  };

  const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
    PENDING:     { label: 'Pendiente',   cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' },
    IN_PROGRESS: { label: 'En progreso', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400' },
    COMPLETED:   { label: 'Completado',  cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' },
  };

  return (
    <div className="space-y-6">
      {/* Current assignments */}
      {assignments.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Asignaciones activas
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
              {assignments.length}
            </span>
          </h3>
          <div className="space-y-2">
            {assignments.map(a => {
              const s = STATUS_LABEL[a.status];
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
                  style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
                      {a.user.firstName.charAt(0)}{a.user.lastName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{a.user.firstName} {a.user.lastName}</p>
                      <p className="text-xs text-muted-foreground">{a.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.attempt?.score != null && (
                      <span className={`text-xs font-bold tabular-nums ${a.attempt.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        {a.attempt.score}%
                      </span>
                    )}
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${s.cls}`}>
                      {s.label}
                    </span>
                    {a.status !== 'COMPLETED' && (
                      <button
                        onClick={() => void handleRemove(a.id)}
                        className="text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <Icon name="close" size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Assign new */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Asignar a empleados</h3>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[var(--tenant-primary)] focus:ring-2 focus:ring-[var(--tenant-primary)]/20 transition-colors"
          />
          <span className="text-xs text-muted-foreground">Fecha límite (opcional)</span>
        </div>

        {loadingUsers ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="relative h-14 rounded-xl bg-muted/50 overflow-hidden">
                <ShimmerOverlay />
              </div>
            ))}
          </div>
        ) : available.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Todos los empleados ya tienen este quiz asignado.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {selected.length > 0
                  ? `${selected.length} seleccionado${selected.length > 1 ? 's' : ''}`
                  : `${available.length} disponible${available.length > 1 ? 's' : ''}`}
              </span>
              <button
                onClick={() => setSelected(selected.length === available.length ? [] : available.map(u => u.id))}
                className="text-xs font-medium transition-colors"
                style={{ color: 'var(--tenant-primary)' }}
              >
                {selected.length === available.length ? 'Quitar selección' : 'Seleccionar todos'}
              </button>
            </div>

            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {available.map(u => (
                <button
                  key={u.id}
                  onClick={() => toggle(u.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-all ${
                    selected.includes(u.id)
                      ? 'border-[var(--tenant-primary)] bg-[var(--tenant-primary)]/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className={`h-4 w-4 flex-shrink-0 rounded border-2 transition-colors ${
                    selected.includes(u.id)
                      ? 'border-[var(--tenant-primary)] bg-[var(--tenant-primary)]'
                      : 'border-border'
                  }`} />
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                    {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{u.firstName} {u.lastName}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {selected.length > 0 && (
          <button
            onClick={handleAssign}
            disabled={assigning}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)' }}
          >
            {assigning && <Icon name="refresh" size={14} className="animate-spin" />}
            Asignar a {selected.length} empleado{selected.length > 1 ? 's' : ''}
          </button>
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

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Aprobados',  value: passed.length,                  icon: 'check-circle' as const, bg: '#16a34a18', bd: '#16a34a30', ic: '#16a34a' },
          { label: 'Reprobados', value: failed.length,                  icon: 'close'        as const, bg: '#ef444418', bd: '#ef444430', ic: '#ef4444' },
          { label: 'Pendientes', value: pending.length + inProg.length, icon: 'clock'        as const, bg: '#f59e0b18', bd: '#f59e0b30', ic: '#f59e0b' },
          { label: 'Promedio',   value: avg != null ? `${avg}%` : '—',  icon: 'chart-bar'    as const, bg: 'color-mix(in srgb, var(--tenant-primary) 12%, transparent)', bd: 'color-mix(in srgb, var(--tenant-primary) 22%, transparent)', ic: 'var(--tenant-primary)' },
        ].map(s => (
          <div
            key={s.label}
            className="rounded-2xl border border-border bg-card p-4"
            style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{s.label}</p>
              <div
                className="flex h-6 w-6 items-center justify-center rounded-lg"
                style={{ background: s.bg, border: `1px solid ${s.bd}` }}
              >
                <Icon name={s.icon} size={11} style={{ color: s.ic }} />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {completed.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border py-14 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <Icon name="chart-bar" size={22} className="text-muted-foreground/30" />
          </div>
          <p className="text-sm font-medium text-foreground">Sin resultados todavía</p>
          <p className="mt-1 text-xs text-muted-foreground">Ningún empleado ha completado el quiz.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Empleado</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Calificación</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Resultado</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Enviado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {completed.map(a => (
                <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                        {a.user.firstName.charAt(0)}{a.user.lastName.charAt(0)}
                      </div>
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
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground tabular-nums">
                    {a.attempt?.submittedAt
                      ? new Date(a.attempt.submittedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'}
                  </td>
                </tr>
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

  const inputCls = 'w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--tenant-primary)] focus:ring-2 focus:ring-[var(--tenant-primary)]/20';

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
    <div className="max-w-lg">
      <div
        className="rounded-2xl border border-border bg-card p-6 space-y-5"
        style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
      >
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Título</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Descripción</label>
          <textarea
            value={description} onChange={e => setDescription(e.target.value)}
            rows={2} className={`${inputCls} resize-none`}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Instrucciones</label>
          <textarea
            value={instructions} onChange={e => setInstructions(e.target.value)}
            rows={2} className={`${inputCls} resize-none`}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Calificación mínima (%)</label>
            <input type="number" min={0} max={100} value={minScore} onChange={e => setMinScore(Number(e.target.value))} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Tiempo límite (min)</label>
            <input type="number" min={1} value={timeLimitMin} onChange={e => setTimeLimitMin(e.target.value)} placeholder="Sin límite" className={inputCls} />
          </div>
        </div>

        {/* Toggle */}
        <label className="flex cursor-pointer items-center gap-3">
          <div
            onClick={() => setIsActive(v => !v)}
            className={`relative h-5 w-9 rounded-full transition-colors ${isActive ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
          >
            <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <div>
            <span className="text-sm font-medium text-foreground">Quiz activo</span>
            <p className="text-xs text-muted-foreground">Los empleados asignados podrán ver y completar este quiz.</p>
          </div>
        </label>

        <div className="border-t border-border pt-4">
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-all hover:scale-[1.02] hover:brightness-110 active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)', boxShadow: '0 2px 10px color-mix(in srgb, var(--tenant-primary) 20%, transparent)' }}
          >
            {saving && <Icon name="refresh" size={14} className="animate-spin" />}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}
