'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/capta-icon';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuizOption   { id: string; text: string; isCorrect: boolean }
interface QuizQuestion {
  id: string; text: string; explanation: string | null; order: number;
  options: QuizOption[];
}

interface AnswerRecord {
  isCorrect: boolean;
  question:  QuizQuestion;
  option:    { id: string; text: string } | null;
}

interface Attempt {
  id:          string;
  score:       number;
  passed:      boolean;
  startedAt:   string;
  submittedAt: string;
  answers:     AnswerRecord[];
}

interface QuizResult {
  id:         string;
  assignedAt: string;
  dueDate:    string | null;
  quiz: {
    id:          string;
    title:       string;
    description: string | null;
    minScore:    number;
    timeLimit:   number | null;
  };
  attempt:     Attempt | null;
  certificate: { id: string; publicUuid: string } | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2 flex-1">
          <div className="h-4 w-2/3 rounded bg-muted" />
          <div className="h-3 w-1/3 rounded bg-muted" />
        </div>
        <div className="h-6 w-14 rounded-full bg-muted" />
      </div>
    </div>
  );
}

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score, passed }: { score: number; passed: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tabular-nums ${
        passed
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
          : 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400'
      }`}
    >
      <Icon name={passed ? 'check' : 'close'} size={11} />
      {score}%
    </span>
  );
}

// ─── Answer review row ────────────────────────────────────────────────────────

function AnswerRow({ answer, idx }: { answer: AnswerRecord; idx: number }) {
  const correctOpt = answer.question.options.find(o => o.isCorrect);

  return (
    <div
      className={`rounded-xl border p-3.5 ${
        answer.isCorrect
          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20'
          : 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
            answer.isCorrect ? 'bg-emerald-500' : 'bg-red-400'
          }`}
        >
          <Icon name={answer.isCorrect ? 'check' : 'close'} size={10} className="text-white" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-xs font-semibold text-foreground leading-snug">
            {idx + 1}. {answer.question.text}
          </p>
          {answer.option && (
            <p className={`text-[11px] ${answer.isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              Tu respuesta: {answer.option.text}
            </p>
          )}
          {!answer.isCorrect && correctOpt && (
            <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              Correcto: {correctOpt.text}
            </p>
          )}
          {!answer.isCorrect && answer.question.explanation && (
            <p className="text-[11px] italic text-muted-foreground">{answer.question.explanation}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Quiz result row ──────────────────────────────────────────────────────────

function QuizResultRow({ result, index }: { result: QuizResult; index: number }) {
  const [open, setOpen] = useState(false);
  const attempt = result.attempt;

  if (!attempt) return null;

  const correctCount = attempt.answers.filter(a => a.isCorrect).length;
  const totalCount   = attempt.answers.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="overflow-hidden rounded-2xl border border-border bg-card"
    >
      {/* Header row — always visible */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-muted/40"
      >
        {/* Result indicator */}
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
            attempt.passed
              ? 'bg-emerald-100 dark:bg-emerald-950/40'
              : 'bg-red-100 dark:bg-red-950/40'
          }`}
        >
          <Icon
            name={attempt.passed ? 'check' : 'close'}
            size={18}
            className={attempt.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}
          />
        </div>

        {/* Title + date */}
        <div className="flex-1 min-w-0">
          <p className="truncate font-medium text-sm text-foreground">{result.quiz.title}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Completado el {formatDate(attempt.submittedAt)} · {correctCount}/{totalCount} correctas
          </p>
        </div>

        {/* Score badge + chevron */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <ScoreBadge score={attempt.score} passed={attempt.passed} />
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <Icon name="chevron-down" size={16} className="text-muted-foreground" />
          </motion.div>
        </div>
      </button>

      {/* Expandable detail */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-5 pb-5 pt-4 space-y-4">

              {/* Score bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Calificación</span>
                  <span>mínimo {result.quiz.minScore}%</span>
                </div>
                <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${attempt.score}%` }}
                    transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.1 }}
                    className="absolute h-full rounded-full"
                    style={{ background: attempt.passed ? '#10b981' : '#ef4444' }}
                  />
                  {/* Min-score marker */}
                  <div
                    className="absolute top-0 h-full w-px bg-foreground/30"
                    style={{ left: `${result.quiz.minScore}%` }}
                  />
                </div>
              </div>

              {/* Per-question review */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Revisión de respuestas
                </p>
                <div className="space-y-2">
                  {attempt.answers.map((a, i) => (
                    <AnswerRow key={a.question.id} answer={a} idx={i} />
                  ))}
                </div>
              </div>

              {/* Certificate download */}
              {result.certificate && (
                <a
                  href={`${API_BASE}/certificates/verify/${result.certificate.publicUuid}/download`}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 transition-all hover:bg-emerald-100 dark:hover:bg-emerald-950/50"
                >
                  <Icon name="award" size={14} />
                  Descargar certificado
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl"
        style={{ background: 'color-mix(in srgb, var(--tenant-primary) 10%, transparent)' }}
      >
        <Icon name="clipboard" size={36} style={{ color: 'var(--tenant-primary)' }} />
      </div>
      <h3 className="font-display text-xl font-normal text-foreground">Sin evaluaciones completadas</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Cuando completes una evaluación asignada, podrás revisar aquí tus resultados y respuestas.
      </p>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyQuizzesPage() {
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<QuizResult[]>('/quizzes/my-results')
      .then(r => setResults(r.data))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-full p-6 md:p-8">
      <div className="mx-auto max-w-3xl space-y-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-1"
        >
          <h1 className="font-display text-3xl font-normal text-foreground">Mis Evaluaciones</h1>
          <p className="text-sm text-muted-foreground">
            Historial de quizzes completados con revisión detallada de respuestas
          </p>
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {[...Array(3)].map((_, i) => <RowSkeleton key={i} />)}
            </motion.div>
          ) : results.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="space-y-3"
            >
              {results.map((r, i) => (
                <QuizResultRow key={r.id} result={r} index={i} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
