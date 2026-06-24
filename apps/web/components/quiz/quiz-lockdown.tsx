'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/capta-icon';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';
import { getSocket } from '@/lib/socket';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Assignment {
  id:     string;
  status: 'PENDING' | 'IN_PROGRESS';
  dueDate: string | null;
  quiz: {
    id:           string;
    title:        string;
    description:  string | null;
    instructions: string | null;
    timeLimit:    number | null;
    minScore:     number;
  };
  attempt: { startedAt: string } | null;
}

interface QuizOption   { id: string; text: string; order: number }
interface QuizQuestion { id: string; text: string; explanation: string | null; order: number; options: QuizOption[] }

interface AttemptResult {
  score:    number;
  passed:   boolean;
  minScore: number;
  answers:  {
    questionId:        string;
    optionId:          string | null;
    isCorrect:         boolean;
    correctOptionId:   string | null;
    correctOptionText: string | null;
    explanation:       string | null;
  }[];
}

type Phase = 'loading' | 'idle' | 'briefing' | 'active' | 'result';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── QuizLockdown ─────────────────────────────────────────────────────────────

/**
 * QuizLockdown — overlay de pantalla completa que se activa cuando el usuario
 * tiene un quiz PENDING o IN_PROGRESS asignado.
 *
 * Comportamiento:
 *  - Se monta silenciosamente en el layout del dashboard.
 *  - Consulta GET /quizzes/my-assignments en cada carga de ruta.
 *  - Cuando hay asignación activa: bloquea toda interacción con el dashboard.
 *  - Solo tiene UNA oportunidad — una vez iniciado no se puede detener.
 *  - beforeunload muestra alerta si intenta cerrar el tab durante el quiz.
 */
export function QuizLockdown() {
  const { error: toastError } = useToast();

  const [phase,       setPhase]       = useState<Phase>('loading');
  const [assignment,  setAssignment]  = useState<Assignment | null>(null);
  const [questions,   setQuestions]   = useState<QuizQuestion[]>([]);
  const [answers,     setAnswers]     = useState<Record<string, string>>({}); // questionId → optionId
  const [result,      setResult]      = useState<AttemptResult | null>(null);
  const [timeLeft,    setTimeLeft]    = useState<number | null>(null);
  const [submitting,  setSubmitting]  = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Carga de asignaciones pendientes ────────────────────────────────────────

  const checkAssignments = useCallback(async () => {
    try {
      const res = await api.get<Assignment[]>('/quizzes/my-assignments');
      const active = res.data[0] ?? null; // toma la primera asignación activa
      setAssignment(active);
      setPhase(active ? 'briefing' : 'idle');
    } catch {
      setPhase('idle');
    }
  }, []);

  useEffect(() => {
    void checkAssignments();
  }, [checkAssignments]);

  // ── beforeunload durante el quiz ─────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'active') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '¿Seguro que quieres salir? Tu quiz quedará en progreso y no podrás recuperar el tiempo.';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase]);

  // ── WebSocket: activar overlay cuando el servidor asigna un nuevo quiz ────────

  useEffect(() => {
    const sock = getSocket();
    const handleAssigned = () => {
      // Solo interrumpir si el usuario está libre — nunca cortar un quiz en curso
      if (phase === 'idle') void checkAssignments();
    };
    sock.on('quiz.assigned', handleAssigned);
    return () => { sock.off('quiz.assigned', handleAssigned); };
  }, [phase, checkAssignments]);

  // ── Timer ──────────────────────────────────────────────────────────────────

  const startTimer = useCallback((totalSecs: number, elapsed = 0) => {
    const remaining = Math.max(totalSecs - elapsed, 0);
    setTimeLeft(remaining);
    if (remaining <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    if (timeLeft === 0 && phase === 'active') {
      // Tiempo agotado — enviar automáticamente con las respuestas actuales
      void handleSubmit(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // ── Iniciar quiz ──────────────────────────────────────────────────────────

  const handleStart = async () => {
    if (!assignment) return;
    setPhase('loading');
    try {
      const res = await api.post<{ assignment: Assignment; attempt: { startedAt: string } | null }>(
        `/quizzes/assignments/${assignment.id}/start`,
      );
      // Cargar preguntas del quiz
      const qRes = await api.get<{ questions: QuizQuestion[] }>(`/quizzes/${assignment.quiz.id}`);
      setQuestions(qRes.data.questions ?? []);

      // Configurar timer si aplica
      if (assignment.quiz.timeLimit) {
        const elapsed = res.data.attempt?.startedAt
          ? Math.floor((Date.now() - new Date(res.data.attempt.startedAt).getTime()) / 1000)
          : 0;
        startTimer(assignment.quiz.timeLimit, elapsed);
      }
      setPhase('active');
    } catch {
      toastError('Error al iniciar el quiz', 'Por favor recarga la página');
      setPhase('briefing');
    }
  };

  // ── Enviar respuestas ─────────────────────────────────────────────────────

  const handleSubmit = async (auto = false) => {
    if (!assignment || submitting) return;
    if (!auto) {
      const unanswered = questions.filter(q => !answers[q.id]);
      if (unanswered.length > 0) {
        toastError(
          `${unanswered.length} pregunta${unanswered.length > 1 ? 's' : ''} sin responder`,
          'Debes responder todas las preguntas antes de enviar',
        );
        return;
      }
    }
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      const res = await api.post<AttemptResult>(
        `/quizzes/assignments/${assignment.id}/submit`,
        { answers: Object.entries(answers).map(([questionId, optionId]) => ({ questionId, optionId })) },
      );
      setResult(res.data);
      setPhase('result');
    } catch {
      toastError('Error al enviar', 'Por favor intenta de nuevo');
    } finally { setSubmitting(false); }
  };

  // ── No renderizar si no hay quiz pendiente ────────────────────────────────

  if (phase === 'loading' || phase === 'idle') return null;

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[9999] flex flex-col overflow-hidden"
        style={{ background: 'hsl(var(--background))' }}
      >
        {/* Header */}
        <div
          className="flex-shrink-0 border-b border-border px-6 py-4 flex items-center justify-between"
          style={{ background: 'color-mix(in srgb, var(--tenant-primary) 6%, hsl(var(--card)))' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, #000) 100%)' }}
            >
              <Icon name="clipboard" size={18} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Quiz asignado</p>
              <h2 className="text-sm font-semibold text-foreground font-display">{assignment?.quiz.title}</h2>
            </div>
          </div>

          {phase === 'active' && timeLeft !== null && (
            <div className={`flex items-center gap-2 rounded-xl border px-4 py-2 ${
              timeLeft < 60
                ? 'border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400'
                : 'border-border bg-muted/50 text-foreground'
            }`}>
              <Icon name="clock" size={14} />
              <span className="text-sm font-mono font-bold">{formatTime(timeLeft)}</span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {phase === 'briefing' && assignment && (
              <BriefingScreen key="briefing" assignment={assignment} onStart={handleStart} />
            )}
            {phase === 'active' && (
              <ActiveScreen
                key="active"
                questions={questions}
                answers={answers}
                onAnswer={(qid, oid) => setAnswers(a => ({ ...a, [qid]: oid }))}
                onSubmit={() => void handleSubmit(false)}
                submitting={submitting}
              />
            )}
            {phase === 'result' && result && assignment && (
              <ResultScreen
                key="result"
                result={result}
                questions={questions}
                onClose={() => {
                  setAssignment(null);
                  setResult(null);
                  setAnswers({});
                  setQuestions([]);
                  // Re-verificar por si hay otro quiz asignado pendiente
                  void checkAssignments();
                }}
              />
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── BriefingScreen ───────────────────────────────────────────────────────────

function BriefingScreen({ assignment, onStart }: { assignment: Assignment; onStart: () => Promise<void> }) {
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    try {
      await onStart();
    } finally {
      setStarting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="flex min-h-full items-center justify-center p-6"
    >
      <div className="w-full max-w-lg space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-3xl"
            style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, #000) 100%)' }}
          >
            <Icon name="clipboard" size={40} className="text-white" />
          </div>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground font-display">{assignment.quiz.title}</h1>
          {assignment.quiz.description && (
            <p className="text-muted-foreground">{assignment.quiz.description}</p>
          )}
        </div>

        {/* Reglas */}
        <div className="rounded-2xl border border-border bg-muted/30 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Antes de comenzar</h3>
          <ul className="space-y-2.5">
            {[
              { icon: 'shield',    text: 'Solo tienes UNA oportunidad para completar este quiz.' },
              { icon: 'close',     text: 'No puedes pausar ni salir una vez iniciado.' },
              ...(assignment.quiz.timeLimit
                ? [{ icon: 'clock', text: `Tienes ${Math.floor(assignment.quiz.timeLimit / 60)} minutos para completarlo.` }]
                : []
              ),
              { icon: 'check',     text: `Necesitas ${assignment.quiz.minScore}% o más para aprobar.` },
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                <Icon name={item.icon as never} size={15} className="flex-shrink-0 mt-0.5" />
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Instrucciones personalizadas */}
        {assignment.quiz.instructions && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-2">Instrucciones</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{assignment.quiz.instructions}</p>
          </div>
        )}

        {assignment.dueDate && (
          <p className="text-center text-xs text-muted-foreground">
            Fecha límite: {new Date(assignment.dueDate).toLocaleDateString('es', { dateStyle: 'long' })}
          </p>
        )}

        <button
          onClick={handleStart}
          disabled={starting}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, #000) 100%)' }}
        >
          {starting
            ? <><Icon name="refresh" size={18} className="animate-spin" /> Iniciando…</>
            : <><Icon name="play" size={18} /> Comenzar Quiz</>
          }
        </button>
      </div>
    </motion.div>
  );
}

// ─── ActiveScreen ─────────────────────────────────────────────────────────────

function ActiveScreen({
  questions, answers, onAnswer, onSubmit, submitting,
}: {
  questions:  QuizQuestion[];
  answers:    Record<string, string>;
  onAnswer:   (qid: string, oid: string) => void;
  onSubmit:   () => void;
  submitting: boolean;
}) {
  const answered  = Object.keys(answers).length;
  const total     = questions.length;
  const progress  = total > 0 ? Math.round((answered / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="mx-auto max-w-2xl px-4 py-8 space-y-6"
    >
      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{answered} de {total} respondidas</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'var(--tenant-primary)' }}
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          />
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {questions.map((q, idx) => (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04 }}
            className={`rounded-2xl border p-5 space-y-4 transition-colors ${
              answers[q.id] ? 'border-[var(--tenant-primary)]/40 bg-[var(--tenant-primary)]/3' : 'border-border bg-card'
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-xl text-xs font-bold text-white"
                style={{ background: answers[q.id] ? 'var(--tenant-primary)' : 'hsl(var(--muted-foreground))' }}
              >
                {idx + 1}
              </span>
              <p className="text-sm font-medium text-foreground leading-relaxed">{q.text}</p>
            </div>

            <div className="pl-10 space-y-2">
              {q.options.map(opt => {
                const selected = answers[q.id] === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => onAnswer(q.id, opt.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                      selected
                        ? 'border-[var(--tenant-primary)] bg-[var(--tenant-primary)]/8 font-medium text-foreground'
                        : 'border-border hover:border-[var(--tenant-primary)]/40 hover:bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <div className={`flex-shrink-0 h-4 w-4 rounded-full border-2 transition-colors ${
                      selected ? 'border-[var(--tenant-primary)] bg-[var(--tenant-primary)]' : 'border-border'
                    }`} />
                    {opt.text}
                  </button>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Submit */}
      <div className="sticky bottom-6 pt-4">
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, #000) 100%)' }}
        >
          {submitting
            ? <><Icon name="refresh" size={18} className="animate-spin" /> Enviando…</>
            : <><Icon name="check" size={18} /> Enviar Quiz ({answered}/{total})</>
          }
        </button>
      </div>
    </motion.div>
  );
}

// ─── ResultScreen ─────────────────────────────────────────────────────────────

function ResultScreen({
  result, questions, onClose,
}: {
  result:    AttemptResult;
  questions: QuizQuestion[];
  onClose:   () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex min-h-full items-center justify-center p-6"
    >
      <div className="w-full max-w-lg space-y-6">
        {/* Score */}
        <div className="text-center space-y-4">
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 }}
            className="inline-flex h-24 w-24 items-center justify-center rounded-3xl"
            style={{
              background: result.passed
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            }}
          >
            <Icon name={result.passed ? 'check' : 'close'} size={44} className="text-white" />
          </motion.div>

          <div>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`text-4xl font-bold font-display ${result.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}
            >
              {result.score}%
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-lg font-semibold text-foreground mt-1"
            >
              {result.passed ? '¡Aprobado!' : 'No aprobado'}
            </motion.p>
            <p className="text-sm text-muted-foreground mt-1">
              Calificación mínima requerida: {result.minScore}%
            </p>
          </div>
        </div>

        {/* Review */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Revisión</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {questions.map((q, idx) => {
              const answer      = result.answers.find(a => a.questionId === q.id);
              const isCorrect   = answer?.isCorrect ?? false;
              const selectedOpt = q.options.find(o => o.id === answer?.optionId);

              return (
                <div key={q.id} className={`rounded-xl border p-3 ${
                  isCorrect
                    ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20'
                    : 'border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20'
                }`}>
                  <div className="flex items-start gap-2">
                    <Icon
                      name={isCorrect ? 'check' : 'close'}
                      size={14}
                      className={`flex-shrink-0 mt-0.5 ${isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{idx + 1}. {q.text}</p>

                      {selectedOpt && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Tu respuesta:{' '}
                          <span className={isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>
                            {selectedOpt.text}
                          </span>
                        </p>
                      )}

                      {/* Mostrar respuesta correcta solo cuando el empleado falló */}
                      {!isCorrect && answer?.correctOptionText && (
                        <p className="text-[11px] mt-0.5">
                          <span className="text-muted-foreground">Respuesta correcta: </span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {answer.correctOptionText}
                          </span>
                        </p>
                      )}

                      {!isCorrect && answer?.explanation && (
                        <p className="text-[11px] text-muted-foreground mt-1 italic">{answer.explanation}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={onClose}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, #000) 100%)' }}
        >
          Volver al dashboard
        </button>
      </div>
    </motion.div>
  );
}
