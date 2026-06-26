'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/capta-icon';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';
import { getSocket } from '@/lib/socket';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuizOption   { id: string; text: string; order: number }
interface QuizQuestion { id: string; text: string; explanation: string | null; order: number; options: QuizOption[] }

interface Assignment {
  id:      string;
  status:  'PENDING' | 'IN_PROGRESS';
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

interface StartResponse {
  assignment: Assignment & { quiz: Assignment['quiz'] & { questions: QuizQuestion[] } };
  attempt: { id: string; startedAt: string } | null;
}

interface AttemptResult {
  score:       number;
  passed:      boolean;
  minScore:    number;
  certificate: { id: string; publicUuid: string; verifyUrl: string } | null;
  answers:     {
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

export function QuizLockdown() {
  const { error: toastError } = useToast();

  const [phase,      setPhase]      = useState<Phase>('loading');
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [questions,  setQuestions]  = useState<QuizQuestion[]>([]);
  const [answers,    setAnswers]    = useState<Record<string, string>>({});
  const [result,     setResult]     = useState<AttemptResult | null>(null);
  const [timeLeft,   setTimeLeft]   = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const submitRef        = useRef<((auto?: boolean) => Promise<void>) | null>(null);
  const startQuizFlowRef = useRef<((a: Assignment) => Promise<void>) | null>(null);

  // ── Timer ──────────────────────────────────────────────────────────────────

  const startTimer = useCallback((totalSecs: number, elapsed = 0) => {
    const remaining = Math.max(totalSecs - elapsed, 0);
    setTimeLeft(remaining);
    if (remaining <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  useEffect(() => {
    if (timeLeft === 0 && phase === 'active') void submitRef.current?.(true);
  }, [timeLeft, phase]);

  // ── Start / Resume quiz flow ───────────────────────────────────────────────

  const startQuizFlow = useCallback(async (a: Assignment) => {
    setPhase('loading');
    try {
      // C-1 fix: questions come back in the startAttempt response — no second admin call needed
      const res = await api.post<StartResponse>(`/quizzes/assignments/${a.id}/start`);
      setQuestions(res.data.assignment.quiz.questions ?? []);

      if (a.quiz.timeLimit) {
        const elapsed = res.data.attempt?.startedAt
          ? Math.floor((Date.now() - new Date(res.data.attempt.startedAt).getTime()) / 1000)
          : 0;
        startTimer(a.quiz.timeLimit, elapsed);
      }
      setPhase('active');
    } catch {
      toastError('Error al iniciar el quiz', 'Por favor recarga la página');
      setPhase('briefing');
    }
  }, [startTimer, toastError]);

  // Mantener la ref actualizada cada render para que checkAssignments siempre
  // llame la versión más reciente sin capturarla como dep (rompe el ciclo).
  startQuizFlowRef.current = startQuizFlow;

  // ── Check assignments ──────────────────────────────────────────────────────

  const checkAssignments = useCallback(async () => {
    try {
      const res = await api.get<Assignment[]>('/quizzes/my-assignments');
      const active = res.data[0] ?? null;
      setAssignment(active);
      if (active?.status === 'IN_PROGRESS') {
        void startQuizFlowRef.current?.(active);
      } else {
        setPhase(active ? 'briefing' : 'idle');
      }
    } catch {
      setPhase('idle');
    }
  }, []); // deps vacíos — función estable, no recrea en cada render

  useEffect(() => { void checkAssignments(); }, [checkAssignments]);

  // ── beforeunload ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'active') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '¿Seguro que quieres salir? Tu quiz quedará en progreso y no podrás recuperar el tiempo.';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase]);

  // ── WebSocket ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const sock = getSocket();
    const handle = () => { if (phase === 'idle') void checkAssignments(); };
    sock.on('quiz.assigned', handle);
    return () => { sock.off('quiz.assigned', handle); };
  }, [phase, checkAssignments]);

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (auto = false) => {
    if (!assignment || submitting) return;
    if (!auto) {
      const unanswered = questions.filter(q => !answers[q.id]);
      if (unanswered.length > 0) {
        toastError(
          `${unanswered.length} pregunta${unanswered.length > 1 ? 's' : ''} sin responder`,
          'Responde todas las preguntas antes de enviar',
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

  // Keep ref in sync so the timer effect always calls the latest version
  submitRef.current = handleSubmit;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (phase === 'loading' || phase === 'idle') return null;

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
          className="flex-shrink-0 border-b border-border px-6 py-3.5 flex items-center justify-between gap-4"
          style={{ background: 'color-mix(in srgb, var(--tenant-primary) 5%, hsl(var(--card)))' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
              style={{ background: 'linear-gradient(135deg, var(--tenant-primary), color-mix(in srgb, var(--tenant-primary) 72%, #000))' }}
            >
              <Icon name="clipboard" size={16} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground leading-none mb-0.5">Quiz en curso</p>
              <h2 className="text-sm font-semibold text-foreground font-display truncate max-w-[260px] sm:max-w-none">
                {assignment?.quiz.title}
              </h2>
            </div>
          </div>

          {phase === 'active' && timeLeft !== null && (
            <motion.div
              animate={timeLeft > 0 && timeLeft < 60 ? { scale: [1, 1.06, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1 }}
              className={`flex flex-shrink-0 items-center gap-2 rounded-xl border px-4 py-2 tabular-nums ${
                timeLeft < 60
                  ? 'border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400'
                  : 'border-border bg-muted/50 text-foreground'
              }`}
            >
              <Icon name="clock" size={13} />
              <span className="text-sm font-mono font-bold">{formatTime(timeLeft)}</span>
            </motion.div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          <AnimatePresence mode="wait">
            {phase === 'briefing' && assignment && (
              <BriefingScreen
                key="briefing"
                assignment={assignment}
                onStart={() => startQuizFlow(assignment)}
              />
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
    try { await onStart(); } finally { setStarting(false); }
  };

  const rules = [
    { icon: 'shield', text: 'Solo tienes una oportunidad para completar este quiz.' },
    { icon: 'close',  text: 'No puedes pausar ni salir una vez iniciado.' },
    ...(assignment.quiz.timeLimit
      ? [{ icon: 'clock', text: `Tienes ${Math.floor(assignment.quiz.timeLimit / 60)} minutos para completarlo.` }]
      : []),
    { icon: 'check',  text: `Necesitas ${assignment.quiz.minScore}% o más para aprobar.` },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="flex min-h-full flex-1 items-center justify-center p-6"
    >
      <div className="w-full max-w-lg space-y-6">

        {/* Icon */}
        <div className="flex justify-center">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.08 }}
            className="relative flex h-20 w-20 items-center justify-center rounded-3xl"
            style={{ background: 'linear-gradient(135deg, var(--tenant-primary), color-mix(in srgb, var(--tenant-primary) 72%, #000))' }}
          >
            <Icon name="clipboard" size={40} className="text-white" />
            <div className="absolute inset-0 rounded-3xl"
              style={{ boxShadow: '0 12px 36px color-mix(in srgb, var(--tenant-primary) 40%, transparent)' }} />
          </motion.div>
        </div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="text-center space-y-2"
        >
          <h1 className="text-2xl font-bold text-foreground font-display" style={{ textWrap: 'balance' } as React.CSSProperties}>
            {assignment.quiz.title}
          </h1>
          {assignment.quiz.description && (
            <p className="text-muted-foreground text-sm leading-relaxed">{assignment.quiz.description}</p>
          )}
        </motion.div>

        {/* Rules */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="rounded-2xl border border-border bg-muted/20 p-5 space-y-3"
        >
          <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Antes de comenzar
          </h3>
          <ul className="space-y-2.5">
            {rules.map((item, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.22 + i * 0.06 }}
                className="flex items-start gap-3 text-sm"
              >
                <span
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg mt-0.5"
                  style={{
                    background: 'color-mix(in srgb, var(--tenant-primary) 12%, transparent)',
                    color: 'var(--tenant-primary)',
                  }}
                >
                  <Icon name={item.icon as never} size={13} />
                </span>
                <span className="leading-relaxed text-muted-foreground">{item.text}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        {/* Instructions */}
        {assignment.quiz.instructions && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.36 }}
            className="rounded-2xl border border-border bg-card p-5"
          >
            <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-2.5">
              Instrucciones
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {assignment.quiz.instructions}
            </p>
          </motion.div>
        )}

        {assignment.dueDate && (
          <p className="text-center text-xs text-muted-foreground">
            Fecha límite:{' '}
            <span className="font-semibold text-foreground">
              {new Date(assignment.dueDate).toLocaleDateString('es', { dateStyle: 'long' })}
            </span>
          </p>
        )}

        <motion.button
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42 }}
          onClick={handleStart}
          disabled={starting}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 text-base font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, var(--tenant-primary), color-mix(in srgb, var(--tenant-primary) 72%, #000))' }}
        >
          {starting
            ? <><Icon name="refresh" size={18} className="animate-spin" /> Iniciando…</>
            : <><Icon name="play" size={18} /> Comenzar Quiz</>
          }
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── ActiveScreen — one question at a time ────────────────────────────────────

function ActiveScreen({
  questions, answers, onAnswer, onSubmit, submitting,
}: {
  questions:  QuizQuestion[];
  answers:    Record<string, string>;
  onAnswer:   (qid: string, oid: string) => void;
  onSubmit:   () => void;
  submitting: boolean;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [direction,  setDirection]  = useState(1);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total       = questions.length;
  const answered    = Object.keys(answers).length;
  const question    = questions[currentIdx];
  const isLast      = currentIdx === total - 1;
  const allAnswered = answered === total;

  useEffect(() => () => { if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current); }, []);

  const goTo = (idx: number) => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    setDirection(idx > currentIdx ? 1 : -1);
    setCurrentIdx(idx);
  };

  const handleSelectOption = (qid: string, oid: string) => {
    onAnswer(qid, oid);
    if (!isLast) {
      autoAdvanceRef.current = setTimeout(() => {
        setDirection(1);
        setCurrentIdx(i => i + 1);
      }, 480);
    }
  };

  if (!question) return null;

  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  return (
    <div className="flex flex-1 flex-col min-h-full">

      {/* ── Progress bar ── */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-border/40">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-sm font-semibold text-foreground">
              Pregunta{' '}
              <span style={{ color: 'var(--tenant-primary)' }}>{currentIdx + 1}</span>
              <span className="font-normal text-muted-foreground"> de {total}</span>
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">{answered}/{total} respondidas</span>
          </div>
          <div className="flex gap-1">
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => goTo(i)}
                title={`Pregunta ${i + 1}${answers[q.id] ? ' · respondida' : ''}`}
                className="h-1.5 flex-1 rounded-full transition-all duration-300"
                style={{
                  background: i === currentIdx
                    ? 'var(--tenant-primary)'
                    : answers[q.id]
                    ? 'color-mix(in srgb, var(--tenant-primary) 45%, transparent)'
                    : 'hsl(var(--muted))',
                  transform: i === currentIdx ? 'scaleY(1.5)' : 'scaleY(1)',
                  transformOrigin: 'center',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Question ── */}
      <div className="flex flex-1 items-center overflow-hidden py-2">
        <div className="w-full max-w-2xl mx-auto px-6 py-6">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={question.id}
              custom={direction}
              variants={{
                enter:  (d: number) => ({ x: d * 56, opacity: 0, scale: 0.97 }),
                center: { x: 0, opacity: 1, scale: 1 },
                exit:   (d: number) => ({ x: d * -56, opacity: 0, scale: 0.97 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            >
              <p
                className="text-[11px] font-bold uppercase tracking-[0.14em] mb-3"
                style={{ color: 'var(--tenant-primary)' }}
              >
                Pregunta {currentIdx + 1}
              </p>

              <h2 className="text-xl font-semibold text-foreground leading-snug mb-7"
                style={{ textWrap: 'balance' } as React.CSSProperties}
              >
                {question.text}
              </h2>

              <div className="space-y-3">
                {question.options.map((opt, i) => {
                  const selected = answers[question.id] === opt.id;
                  return (
                    <motion.button
                      key={opt.id}
                      onClick={() => handleSelectOption(question.id, opt.id)}
                      whileHover={{ scale: 1.005 }}
                      whileTap={{ scale: 0.996 }}
                      className="group w-full flex items-center gap-4 rounded-2xl border p-4 text-left transition-all"
                      style={{
                        borderColor: selected ? 'var(--tenant-primary)' : 'hsl(var(--border))',
                        background:  selected
                          ? 'color-mix(in srgb, var(--tenant-primary) 7%, hsl(var(--card)))'
                          : 'hsl(var(--card))',
                        boxShadow: selected
                          ? '0 0 0 1px var(--tenant-primary)'
                          : '0 1px 0 rgba(255,255,255,0.6) inset, 0 4px 12px rgba(0,0,0,0.04)',
                      }}
                    >
                      <motion.span
                        animate={{
                          background: selected ? 'var(--tenant-primary)' : 'hsl(var(--muted))',
                          color:      selected ? '#ffffff' : 'hsl(var(--muted-foreground))',
                        }}
                        transition={{ duration: 0.15 }}
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold"
                      >
                        {letters[i] ?? String(i + 1)}
                      </motion.span>
                      <span className={`flex-1 text-sm font-medium leading-snug transition-colors ${
                        selected
                          ? 'text-foreground'
                          : 'text-muted-foreground group-hover:text-foreground'
                      }`}>
                        {opt.text}
                      </span>
                      <AnimatePresence>
                        {selected && (
                          <motion.span
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                            className="flex-shrink-0"
                            style={{ color: 'var(--tenant-primary)' }}
                          >
                            <Icon name="check" size={16} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Navigation ── */}
      <div className="flex-shrink-0 border-t border-border px-6 py-4"
        style={{ background: 'color-mix(in srgb, hsl(var(--card)) 80%, transparent)' }}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={() => goTo(currentIdx - 1)}
            disabled={currentIdx === 0}
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/60 disabled:opacity-0 disabled:pointer-events-none transition-all"
          >
            <Icon name="arrow-left" size={14} /> Anterior
          </button>

          <div className="flex-1 text-center">
            {isLast && !allAnswered && (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs"
              >
                <span className="font-semibold" style={{ color: '#f59e0b' }}>{total - answered}</span>
                <span className="text-muted-foreground"> sin responder</span>
              </motion.p>
            )}
          </div>

          {isLast ? (
            <button
              onClick={onSubmit}
              disabled={submitting || !allAnswered}
              className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-all hover:brightness-110 active:scale-[0.97]"
              style={{ background: 'linear-gradient(135deg, var(--tenant-primary), color-mix(in srgb, var(--tenant-primary) 72%, #000))' }}
            >
              {submitting
                ? <><Icon name="refresh" size={14} className="animate-spin" /> Enviando…</>
                : <><Icon name="check" size={14} /> Enviar Quiz</>
              }
            </button>
          ) : (
            <button
              onClick={() => goTo(currentIdx + 1)}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.97]"
              style={{
                background: answers[question.id]
                  ? 'linear-gradient(135deg, var(--tenant-primary), color-mix(in srgb, var(--tenant-primary) 72%, #000))'
                  : 'hsl(var(--muted))',
                color: answers[question.id] ? '#ffffff' : 'hsl(var(--muted-foreground))',
              }}
            >
              {answers[question.id] ? 'Siguiente' : 'Omitir'}
              <Icon name="arrow-right" size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ResultScreen ─────────────────────────────────────────────────────────────

const QUIZ_API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

function ResultScreen({ result, questions, onClose }: {
  result:    AttemptResult;
  questions: QuizQuestion[];
  onClose:   () => void;
}) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const target   = result.score;
    const duration = 1100;
    const start    = Date.now();
    const raf = requestAnimationFrame(function tick() {
      const elapsed  = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease     = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplayScore(Math.round(ease * target));
      if (progress < 1) requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [result.score]);

  const correctCount = result.answers.filter(a => a.isCorrect).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 min-h-full p-6"
    >
      <div className="max-w-lg mx-auto py-8 space-y-6">

        {/* Score hero */}
        <div className="text-center space-y-4">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 180, damping: 14, delay: 0.08 }}
            className="relative inline-flex h-24 w-24 items-center justify-center rounded-3xl"
            style={{
              background: result.passed
                ? 'linear-gradient(135deg, #10b981, #059669)'
                : 'linear-gradient(135deg, #ef4444, #dc2626)',
            }}
          >
            <Icon name={result.passed ? 'check' : 'close'} size={44} className="text-white" />
            <div className="absolute inset-0 rounded-3xl"
              style={{ boxShadow: result.passed
                ? '0 12px 40px rgba(16,185,129,0.4)'
                : '0 12px 40px rgba(239,68,68,0.4)' }}
            />
          </motion.div>

          <div>
            <motion.p
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.18 }}
              className={`text-5xl font-bold font-display tabular-nums ${
                result.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
              }`}
            >
              {displayScore}%
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.28 }}
              className="text-lg font-semibold text-foreground mt-1"
            >
              {result.passed ? '¡Aprobado!' : 'No aprobado'}
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.34 }}
              className="text-sm text-muted-foreground mt-1"
            >
              {correctCount} de {questions.length} correctas · mínimo {result.minScore}%
            </motion.p>
          </div>
        </div>

        {/* Score bar with threshold marker */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38 }}
          className="space-y-1.5"
        >
          <div className="relative h-2.5 rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${result.score}%` }}
              transition={{ duration: 1.1, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.18 }}
              className="absolute h-full rounded-full"
              style={{ background: result.passed ? '#10b981' : '#ef4444' }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>0%</span>
            <span className="font-medium">mín. {result.minScore}%</span>
            <span>100%</span>
          </div>
        </motion.div>

        {/* Review */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.44 }}
          className="space-y-3"
        >
          <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Revisión de respuestas
          </h3>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
            {questions.map((q, idx) => {
              const answer    = result.answers.find(a => a.questionId === q.id);
              const isCorrect = answer?.isCorrect ?? false;
              const selected  = q.options.find(o => o.id === answer?.optionId);

              return (
                <div
                  key={q.id}
                  className={`rounded-xl border p-3.5 ${
                    isCorrect
                      ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20'
                      : 'border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full mt-0.5 ${
                      isCorrect ? 'bg-emerald-500' : 'bg-red-400'
                    }`}>
                      <Icon name={isCorrect ? 'check' : 'close'} size={11} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground leading-snug">
                        {idx + 1}. {q.text}
                      </p>
                      {selected && (
                        <p className={`text-[11px] mt-0.5 ${
                          isCorrect
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          Tu respuesta: {selected.text}
                        </p>
                      )}
                      {!isCorrect && answer?.correctOptionText && (
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5 font-semibold">
                          Correcto: {answer.correctOptionText}
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
        </motion.div>

        {/* Certificado de aprobación */}
        {result.passed && result.certificate && (
          <motion.a
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.47 }}
            href={`${QUIZ_API_BASE}/certificates/verify/${result.certificate.publicUuid}/download`}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 py-3.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400 transition-all hover:bg-emerald-100 dark:hover:bg-emerald-950/50 active:scale-[0.98]"
          >
            <Icon name="award" size={17} />
            Descargar certificado
          </motion.a>
        )}

        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={onClose}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, var(--tenant-primary), color-mix(in srgb, var(--tenant-primary) 72%, #000))' }}
        >
          Volver al dashboard
        </motion.button>
      </div>
    </motion.div>
  );
}
