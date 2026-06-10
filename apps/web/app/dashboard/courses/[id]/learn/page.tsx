'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/capta-icon';
import { api } from '@/lib/api';
import { MarkdownRenderer } from '@/components/markdown/markdown-renderer';
import MuxPlayer from '@mux/mux-player-react';

// Icon aliases
const ArrowLeft    = (p: { size?: number; className?: string }) => <Icon name="arrow-left"    size={p.size} className={p.className} />;
const BookOpen     = (p: { size?: number; className?: string }) => <Icon name="book-open"     size={p.size} className={p.className} />;
const CheckCircle2 = (p: { size?: number; className?: string }) => <Icon name="check-circle" size={p.size} className={p.className} />;
const ChevronDown  = (p: { size?: number; className?: string }) => <Icon name="chevron-down"  size={p.size} className={p.className} />;
const ChevronRight = (p: { size?: number; className?: string }) => <Icon name="chevron-right" size={p.size} className={p.className} />;
const Video        = (p: { size?: number; className?: string }) => <Icon name="video"         size={p.size} className={p.className} />;
const FileText     = (p: { size?: number; className?: string }) => <Icon name="file"          size={p.size} className={p.className} />;
const File         = (p: { size?: number; className?: string }) => <Icon name="file"          size={p.size} className={p.className} />;
const Download     = (p: { size?: number; className?: string }) => <Icon name="download"      size={p.size} className={p.className} />;
const Loader2      = (p: { size?: number; className?: string }) => <Icon name="refresh"       size={p.size} className={p.className} />;
const Menu         = (p: { size?: number; className?: string }) => <Icon name="menu"          size={p.size} className={p.className} />;
const X            = (p: { size?: number; className?: string }) => <Icon name="close"         size={p.size} className={p.className} />;
const Award        = (p: { size?: number; className?: string }) => <Icon name="award"         size={p.size} className={p.className} />;
const Zap          = (p: { size?: number; className?: string }) => <Icon name="zap"           size={p.size} className={p.className} />;
const AlertCircle  = (p: { size?: number; className?: string }) => <Icon name="alert-circle"  size={p.size} className={p.className} />;
const Shield       = (p: { size?: number; className?: string }) => <Icon name="shield"        size={p.size} className={p.className} />;
const Certificate  = (p: { size?: number; className?: string }) => <Icon name="certificate"   size={p.size} className={p.className} />;

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface LessonProgressItem {
  lessonId: string;
  completedAt?: string | null;
  watchedSeconds?: number | null;
}

interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  type: 'VIDEO' | 'TEXT' | 'FILE';
  order: number;
  isPreview: boolean;
  duration?: number;
  content?: string;
  muxPlaybackId?: string;
  muxStatus?: string;
  fileKey?: string;
  fileName?: string;
  fileSizeBytes?: number;
  fileMimeType?: string;
}

interface Module {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

interface Course {
  id: string;
  title: string;
  description?: string;
  totalLessons: number;
  modules: Module[];
}

interface Enrollment {
  id: string;
  courseId: string;
  progress: number;
  status: string;
  completedAt?: string | null;
  lessonProgress: LessonProgressItem[];
}

// ─── Tipos de evaluación ──────────────────────────────────────────────────────

interface QuizOption {
  id: string;
  text: string;
  order: number;
}

interface QuizQuestion {
  id: string;
  text: string;
  points: number;
  order: number;
  options: QuizOption[];
}

interface EvaluationData {
  id: string;
  title: string;
  instructions: string | null;
  minScore: number;
  maxAttempts: number;
  timeLimit: number | null;
  isRequired: boolean;
  showAnswers: boolean;
  questions: QuizQuestion[];
  attemptsUsed: number;
  bestScore: number | null;
  passed: boolean;
  hasPendingResetRequest: boolean;
}

interface AnswerResult {
  questionId: string;
  questionText: string;
  selectedOptionId: string;
  isCorrect: boolean;
  explanation: string | null;
  correctOptionId: string | null;
}

interface AttemptResult {
  attemptId: string;
  score: number;
  passed: boolean;
  minScore: number;
  completedAt: string;
  answers: AnswerResult[];
  message: string;
  attemptsUsed: number;
  attemptsRemaining: number | null;
}

interface CertificateData {
  id: string;
  publicUuid: string;
  recipientName: string;
  courseTitle: string;
  verifyUrl: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LESSON_ICON = { VIDEO: Video, TEXT: FileText, FILE: File };

function formatDuration(s?: number): string {
  if (!s) return '';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

type FileCategory = 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'office' | 'other';

function getFileCategory(mime?: string): FileCategory {
  if (!mime) return 'other';
  if (mime.startsWith('image/'))       return 'image';
  if (mime === 'application/pdf')      return 'pdf';
  if (mime.startsWith('video/'))       return 'video';
  if (mime.startsWith('audio/'))       return 'audio';
  if (mime.startsWith('text/'))        return 'text';
  if ([
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ].includes(mime)) return 'office';
  return 'other';
}

// ─── Panel de Quiz ────────────────────────────────────────────────────────────

type QuizPhase = 'start' | 'taking' | 'result';

function formatTimer(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function QuizPanel({
  evaluation,
  enrollmentId,
  onAttemptComplete,
}: {
  evaluation: EvaluationData;
  enrollmentId: string;
  onAttemptComplete: (result: AttemptResult) => void;
}) {
  const [evalData,        setEvalData]        = useState(evaluation);
  const [phase,           setPhase]           = useState<QuizPhase>(evaluation.passed ? 'result' : 'start');
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [submitting,      setSubmitting]      = useState(false);
  const [result,          setResult]          = useState<AttemptResult | null>(null);
  const [timeRemaining,   setTimeRemaining]   = useState<number | null>(null);
  const [confirmSubmit,   setConfirmSubmit]   = useState(false);

  // ── Solicitud de nueva oportunidad ──
  const [showResetForm,   setShowResetForm]   = useState(false);
  const [resetMessage,    setResetMessage]    = useState('');
  const [sendingReset,    setSendingReset]    = useState(false);
  const [resetSent,       setResetSent]       = useState(evaluation.hasPendingResetRequest);

  // Reset completo al cambiar de evaluación (nueva lección)
  useEffect(() => {
    setEvalData(evaluation);
    setPhase(evaluation.passed ? 'result' : 'start');
    setSelectedAnswers({});
    setResult(null);
    setTimeRemaining(null);
    setConfirmSubmit(false);
    setShowResetForm(false);
    setResetMessage('');
    setResetSent(evaluation.hasPendingResetRequest);
  }, [evaluation.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown — se activa solo cuando phase==='taking' y hay timeLimit
  useEffect(() => {
    if (phase !== 'taking' || timeRemaining === null) return;
    if (timeRemaining <= 0) {
      // Tiempo agotado: enviamos lo que haya respondido
      void doSubmit();
      return;
    }
    const id = setInterval(() => setTimeRemaining(prev => (prev !== null ? prev - 1 : null)), 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeRemaining]);

  const attemptsRemaining = evalData.maxAttempts === -1
    ? null
    : Math.max(0, evalData.maxAttempts - evalData.attemptsUsed);

  const canAttempt     = !evalData.passed && (attemptsRemaining === null || attemptsRemaining > 0);
  const answeredCount  = Object.keys(selectedAnswers).length;
  const allAnswered    = answeredCount === evalData.questions.length;
  const isTimeWarning  = timeRemaining !== null && timeRemaining <= 60;

  // Lookup de texto de opción desde evalData (disponible tras recibir result)
  const getOptionText = (questionId: string, optionId: string) =>
    evalData.questions.find(q => q.id === questionId)?.options.find(o => o.id === optionId)?.text ?? '';

  const handleStart = () => {
    setSelectedAnswers({});
    setResult(null);
    setConfirmSubmit(false);
    setTimeRemaining(evalData.timeLimit ?? null);
    setPhase('taking');
  };

  const doSubmit = async () => {
    if (submitting) return;
    setConfirmSubmit(false);
    setSubmitting(true);
    setTimeRemaining(null); // detener timer
    try {
      const { data } = await api.post<AttemptResult>(`/evaluations/${evalData.id}/attempt`, {
        enrollmentId,
        answers: Object.entries(selectedAnswers).map(([questionId, optionId]) => ({ questionId, optionId })),
      });
      setResult(data);
      setEvalData(prev => ({
        ...prev,
        attemptsUsed: data.attemptsUsed,
        bestScore:    Math.max(prev.bestScore ?? 0, data.score),
        passed:       prev.passed || data.passed,
      }));
      setPhase('result');
      onAttemptComplete(data);
    } finally { setSubmitting(false); }
  };

  const handleSendResetRequest = async () => {
    setSendingReset(true);
    try {
      await api.post(`/evaluations/${evalData.id}/reset-requests`, {
        message: resetMessage.trim() || undefined,
      });
      setResetSent(true);
      setShowResetForm(false);
      setResetMessage('');
    } catch {
      // La solicitud duplicada (409) o error de servidor — mostramos estado conservador
      setResetSent(true); // asumimos enviada para no confundir al usuario
    } finally { setSendingReset(false); }
  };

  // ─── Fase: Inicio ────────────────────────────────────────────────────────────
  const renderStart = () => (
    <motion.div
      key="start"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="mt-6 rounded-2xl border border-border overflow-hidden"
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 4px 16px rgba(11,31,42,0.05)' }}
    >
      {/* Cabecera */}
      <div className="flex items-start gap-3 px-5 py-4 bg-card border-b border-border">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: '#1E4F7A12', color: '#1E4F7A', border: '1px solid #1E4F7A1A' }}
        >
          <Shield size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{evalData.title}</h3>
            {evalData.isRequired && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide flex-shrink-0"
                style={{ background: '#f59e0b18', color: '#f59e0b' }}>
                Obligatoria
              </span>
            )}
            {evalData.passed && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide flex-shrink-0"
                style={{ background: '#16a34a18', color: '#16a34a' }}>
                Aprobado
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {evalData.questions.length} {evalData.questions.length === 1 ? 'pregunta' : 'preguntas'} ·
            Mínimo {evalData.minScore}%
            {evalData.maxAttempts !== -1 && ` · ${attemptsRemaining} ${attemptsRemaining === 1 ? 'intento restante' : 'intentos restantes'}`}
            {evalData.timeLimit && ` · ${Math.round(evalData.timeLimit / 60)} min`}
          </p>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="px-5 py-4 bg-background space-y-3">
        {evalData.instructions && (
          <p className="text-sm text-muted-foreground leading-relaxed italic border-l-2 border-capta-soft/40 pl-3">
            {evalData.instructions}
          </p>
        )}

        {/* Tiempo límite */}
        {evalData.timeLimit && (
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/30 px-4 py-2.5">
            <Icon name="clock" size={13} className="text-muted-foreground flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              Tendrás <span className="font-semibold text-foreground">{Math.round(evalData.timeLimit / 60)} minutos</span> para completar esta evaluación.
            </p>
          </div>
        )}

        {/* Historial de intentos */}
        {evalData.attemptsUsed > 0 && !evalData.passed && (
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/30 px-4 py-2.5">
            <Icon name="refresh" size={13} className="text-muted-foreground flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              Intento {evalData.attemptsUsed}{evalData.maxAttempts !== -1 ? ` de ${evalData.maxAttempts}` : ''} ·{' '}
              Mejor puntaje: <span className="font-semibold" style={{ color: '#d97706' }}>{evalData.bestScore}%</span>
            </p>
          </div>
        )}

        {/* Sin intentos disponibles — flujo de solicitud */}
        {!canAttempt && !evalData.passed && (
          <div className="space-y-2">
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-900/10 px-4 py-3">
              <AlertCircle size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-foreground">Intentos agotados</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Has usado todos los intentos disponibles ({evalData.maxAttempts}).
                  Puedes solicitar una nueva oportunidad al administrador.
                </p>
              </div>
            </div>

            {resetSent ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-900/10 px-4 py-3">
                <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                  Tu solicitud fue enviada. El administrador la revisará pronto.
                </p>
              </div>
            ) : showResetForm ? (
              <div className="rounded-xl border border-border bg-background p-3 space-y-2">
                <p className="text-xs font-medium text-foreground">
                  Motivo de tu solicitud <span className="text-muted-foreground font-normal">(opcional)</span>
                </p>
                <textarea
                  value={resetMessage}
                  onChange={e => setResetMessage(e.target.value)}
                  rows={2}
                  maxLength={300}
                  placeholder="Ej: Necesito repasar el material antes de intentarlo de nuevo…"
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-capta-soft/40"
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-muted-foreground">{resetMessage.length}/300</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setShowResetForm(false); setResetMessage(''); }}
                      className="text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSendResetRequest}
                      disabled={sendingReset}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' }}
                    >
                      {sendingReset
                        ? <Loader2 size={11} className="animate-spin" />
                        : <Icon name="check" size={11} />}
                      Enviar solicitud
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowResetForm(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Icon name="refresh" size={14} />
                Solicitar nueva oportunidad
              </button>
            )}
          </div>
        )}

        {/* CTA */}
        {canAttempt ? (
          <button
            onClick={handleStart}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)', boxShadow: '0 2px 10px rgba(30,79,122,0.25)' }}
          >
            <Zap size={14} />
            {evalData.attemptsUsed > 0 ? 'Intentar de nuevo' : 'Comenzar evaluación'}
          </button>
        ) : evalData.passed ? (
          <button
            onClick={() => setPhase('result')}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold border border-border bg-background hover:bg-muted transition-colors"
          >
            <Icon name="eye" size={14} />
            Ver mi resultado
          </button>
        ) : null}
      </div>
    </motion.div>
  );

  // ─── Fase: Tomando el quiz ────────────────────────────────────────────────────
  const renderTaking = () => (
    <motion.div
      key="taking"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="mt-6 space-y-4"
    >
      {/* Barra de quiz: título + timer */}
      <div
        className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3"
        style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 2px 8px rgba(11,31,42,0.04)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: '#1E4F7A12', color: '#1E4F7A' }}>
            <Shield size={13} />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">{evalData.title}</p>
            <p className="text-[10px] text-muted-foreground tabular-nums">
              {answeredCount}/{evalData.questions.length} respondidas
            </p>
          </div>
        </div>
        {timeRemaining !== null && (
          <div
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold tabular-nums transition-all"
            style={{
              color:      isTimeWarning ? '#ef4444' : 'hsl(var(--foreground))',
              background: isTimeWarning ? '#ef444412' : 'transparent',
              border:     isTimeWarning ? '1px solid #ef444430' : '1px solid transparent',
            }}
          >
            <Icon name="clock" size={13} />
            {formatTimer(timeRemaining)}
          </div>
        )}
      </div>

      {/* Barra de progreso de respuestas */}
      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${(answeredCount / Math.max(evalData.questions.length, 1)) * 100}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          style={{ background: 'linear-gradient(90deg, #1E4F7A, #8FC4E8)' }}
        />
      </div>

      {/* Preguntas */}
      <div className="space-y-4">
        {evalData.questions.map((question, qi) => (
          <motion.div
            key={question.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: qi * 0.04 }}
            className="rounded-2xl border border-border bg-card overflow-hidden"
            style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 2px 8px rgba(11,31,42,0.03)' }}
          >
            {/* Enunciado */}
            <div className="flex items-start gap-2.5 px-4 py-3 border-b border-border/60">
              <span
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold mt-0.5 transition-colors"
                style={{
                  background: selectedAnswers[question.id] ? '#1E4F7A20' : 'hsl(var(--muted))',
                  color:      selectedAnswers[question.id] ? '#1E4F7A'   : 'hsl(var(--muted-foreground))',
                }}
              >
                {qi + 1}
              </span>
              <p className="text-sm font-medium text-foreground leading-relaxed flex-1">{question.text}</p>
              {question.points > 1 && (
                <span className="text-[10px] font-bold text-muted-foreground/60 flex-shrink-0 mt-0.5 tabular-nums">
                  {question.points}pts
                </span>
              )}
            </div>
            {/* Opciones */}
            <div className="p-3 space-y-2">
              {question.options.map(option => {
                const selected = selectedAnswers[question.id] === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => setSelectedAnswers(prev => ({ ...prev, [question.id]: option.id }))}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm transition-all ${
                      selected
                        ? 'border-capta-soft/60 bg-capta-tint/60 dark:border-capta-soft/40 dark:bg-capta-soft/10'
                        : 'border-border bg-background hover:border-border/80 hover:bg-muted/30'
                    }`}
                  >
                    <div
                      className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all"
                      style={{
                        borderColor: selected ? '#1E4F7A' : undefined,
                        background:  selected ? '#1E4F7A' : 'transparent',
                      }}
                    >
                      {selected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <span className={`flex-1 ${selected ? 'text-capta-deep dark:text-capta-soft font-medium' : 'text-foreground'}`}>
                      {option.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Sección de envío */}
      <div className="space-y-2">
        <AnimatePresence>
          {confirmSubmit && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3"
            >
              <p className="text-sm text-foreground">¿Confirmas que deseas enviar tus respuestas?</p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setConfirmSubmit(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={doSubmit}
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' }}
                >
                  {submitting ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                  Enviar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {answeredCount}/{evalData.questions.length} respondidas
            {!allAnswered && (
              <span className="ml-1 text-amber-600 dark:text-amber-400">· Responde todas para enviar</span>
            )}
          </p>
          <button
            onClick={() => allAnswered && !confirmSubmit && setConfirmSubmit(true)}
            disabled={!allAnswered || submitting || confirmSubmit}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)', boxShadow: '0 2px 10px rgba(30,79,122,0.25)' }}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {submitting ? 'Enviando…' : 'Enviar respuestas'}
          </button>
        </div>
      </div>
    </motion.div>
  );

  // ─── Fase: Resultado ─────────────────────────────────────────────────────────
  const renderResult = () => (
    <motion.div
      key="result"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="mt-6 space-y-4"
    >
      {/* Score card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="rounded-2xl p-6 text-center"
        style={{
          background: (result?.passed ?? evalData.passed)
            ? 'linear-gradient(135deg, #16a34a10, #16a34a04)'
            : 'linear-gradient(135deg, #f59e0b10, #f59e0b04)',
          border: `1px solid ${(result?.passed ?? evalData.passed) ? '#16a34a25' : '#f59e0b25'}`,
        }}
      >
        {result ? (
          <>
            <div className="text-5xl font-bold mb-2 tabular-nums"
              style={{ color: result.passed ? '#16a34a' : '#d97706' }}>
              {result.score}%
            </div>
            <p className="text-sm font-semibold mb-1" style={{ color: result.passed ? '#16a34a' : '#d97706' }}>
              {result.passed ? '¡Aprobado!' : 'No aprobado'}
            </p>
            <p className="text-xs text-muted-foreground">{result.message}</p>
          </>
        ) : (
          /* Vista cuando ya pasó pero no tiene result del intento actual */
          <>
            <CheckCircle2 size={36} className="text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">¡Evaluación aprobada!</p>
            <p className="text-xs text-muted-foreground mt-1">
              Mejor puntaje: <span className="font-semibold">{evalData.bestScore}%</span> · Mínimo: {evalData.minScore}%
            </p>
          </>
        )}
      </motion.div>

      {/* Revisión detallada por pregunta */}
      {result && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Revisión de respuestas
          </h4>
          {result.answers.map((ans, i) => {
            const selectedText = ans.selectedOptionId
              ? getOptionText(ans.questionId, ans.selectedOptionId)
              : null;
            const correctText = ans.correctOptionId ? getOptionText(ans.questionId, ans.correctOptionId) : null;

            return (
              <div
                key={ans.questionId}
                className="rounded-2xl border overflow-hidden"
                style={{
                  borderColor: ans.isCorrect ? '#16a34a25' : '#ef444425',
                  background:  ans.isCorrect ? '#16a34a04' : '#ef444404',
                }}
              >
                {/* Pregunta */}
                <div className="flex items-start gap-2.5 px-4 py-3 border-b"
                  style={{ borderColor: ans.isCorrect ? '#16a34a15' : '#ef444415' }}>
                  <div
                    className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold mt-0.5"
                    style={{
                      background: ans.isCorrect ? '#16a34a18' : '#ef444418',
                      color:      ans.isCorrect ? '#16a34a'   : '#ef4444',
                    }}
                  >
                    {ans.isCorrect ? '✓' : '✗'}
                  </div>
                  <p className="text-sm font-medium text-foreground flex-1 leading-snug">
                    {i + 1}. {ans.questionText}
                  </p>
                </div>
                {/* Detalle de respuestas */}
                <div className="px-4 py-3 space-y-1.5">
                  {selectedText && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60 w-[4.5rem] flex-shrink-0">
                        Tu resp.
                      </span>
                      <span className={`text-xs flex-1 ${
                        ans.isCorrect
                          ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                          : 'text-red-500 dark:text-red-400 line-through'
                      }`}>
                        {selectedText}
                      </span>
                    </div>
                  )}
                  {!ans.isCorrect && correctText && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60 w-[4.5rem] flex-shrink-0">
                        Correcta
                      </span>
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex-1">
                        {correctText}
                      </span>
                    </div>
                  )}
                  {ans.explanation && (
                    <div className="flex items-start gap-2 mt-1.5 pt-2 border-t border-border/40">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60 w-[4.5rem] flex-shrink-0 mt-0.5">
                        Nota
                      </span>
                      <p className="text-xs text-muted-foreground leading-relaxed flex-1">{ans.explanation}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={() => setPhase('start')}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon name="arrow-left" size={12} /> Ver detalles
        </button>
        {result && !result.passed && (result.attemptsRemaining === null || result.attemptsRemaining > 0) && (
          <button
            onClick={() => { setResult(null); setPhase('start'); }}
            className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <Icon name="refresh" size={13} />
            Intentar de nuevo
            {result.attemptsRemaining !== null && (
              <span className="text-muted-foreground font-normal text-xs">
                ({result.attemptsRemaining} {result.attemptsRemaining === 1 ? 'intento' : 'intentos'})
              </span>
            )}
          </button>
        )}
      </div>
    </motion.div>
  );

  return (
    <AnimatePresence mode="wait">
      {phase === 'start'  && renderStart()}
      {phase === 'taking' && renderTaking()}
      {phase === 'result' && renderResult()}
    </AnimatePresence>
  );
}

// ─── Árbol de lecciones ───────────────────────────────────────────────────────

function LessonTree({
  course, enrollment, currentLessonId, onSelectLesson,
}: {
  course: Course;
  enrollment: Enrollment | null;
  currentLessonId: string | null;
  onSelectLesson: (lesson: Lesson) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(course.modules.map(m => [m.id, true])),
  );

  const completedIds = new Set(
    enrollment?.lessonProgress.filter(p => !!p.completedAt).map(p => p.lessonId) ?? [],
  );

  return (
    <div className="space-y-1">
      {course.modules.map(module => (
        <div key={module.id}>
          <button
            onClick={() => setExpanded(prev => ({ ...prev, [module.id]: !prev[module.id] }))}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-muted transition-colors"
          >
            {expanded[module.id]
              ? <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />
              : <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
            }
            <span className="text-xs font-semibold text-foreground truncate">{module.title}</span>
            <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">
              {module.lessons.filter(l => completedIds.has(l.id)).length}/{module.lessons.length}
            </span>
          </button>

          <AnimatePresence>
            {expanded[module.id] && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden ml-4 space-y-0.5 mt-0.5"
              >
                {module.lessons.map(lesson => {
                  const LessonIcon = LESSON_ICON[lesson.type];
                  const completed  = completedIds.has(lesson.id);
                  const active     = lesson.id === currentLessonId;

                  return (
                    <button
                      key={lesson.id}
                      onClick={() => onSelectLesson(lesson)}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all ${
                        active
                          ? 'bg-capta-tint/60 text-capta-deep dark:bg-capta-soft/[0.12] dark:text-capta-soft'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {completed
                        ? <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        : <div className="h-3.5 w-3.5 rounded-full border-2 border-current flex-shrink-0 opacity-30" />
                      }
                      <LessonIcon size={13} className="flex-shrink-0 opacity-70" />
                      <span className="text-xs font-medium truncate flex-1">{lesson.title}</span>
                      {lesson.duration && (
                        <span className="text-[10px] flex-shrink-0 opacity-60">{formatDuration(lesson.duration)}</span>
                      )}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

// ─── Visor de lección ─────────────────────────────────────────────────────────

function LessonViewer({
  lesson, enrollment, userRole, onComplete, nextLesson, onNextLesson, courseId,
}: {
  lesson: Lesson;
  enrollment: Enrollment | null;
  userRole: string;
  onComplete: () => void;
  nextLesson: Lesson | null;
  onNextLesson: (lesson: Lesson) => void;
  courseId: string;
}) {
  const isEmployee = userRole === 'EMPLOYEE';

  const [completing,     setCompleting]     = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [fullLesson,     setFullLesson]     = useState<Lesson | null>(null);
  const [fileSignedUrl,  setFileSignedUrl]  = useState<string | null>(null);
  const [loadingFile,    setLoadingFile]    = useState(false);
  const [textContent,    setTextContent]    = useState<string | null>(null);

  // ── Estado del quiz ──
  const [evaluation,    setEvaluation]   = useState<EvaluationData | null>(null);
  const [loadingEval,   setLoadingEval]  = useState(false);
  const [lastAttempt,   setLastAttempt]  = useState<AttemptResult | null>(null);

  const fileCategory = getFileCategory(lesson.fileMimeType);

  // ── Cargar evaluación al cambiar de lección ──
  useEffect(() => {
    setEvaluation(null);
    setLastAttempt(null);
    setLoadingEval(true);
    api.get<EvaluationData | null>(`/lessons/${lesson.id}/evaluation`)
      .then(res => setEvaluation(res.data))
      .catch(() => setEvaluation(null))
      .finally(() => setLoadingEval(false));
  }, [lesson.id]);

  // ── Obtener URL firmada para archivos FILE ──
  useEffect(() => {
    if (lesson.type !== 'FILE' || !lesson.fileKey) {
      setFileSignedUrl(null);
      return;
    }
    setLoadingFile(true);
    setTextContent(null);
    api.get<{ downloadUrl: string }>(`/storage/presigned-download/${lesson.fileKey}`)
      .then(res => setFileSignedUrl(res.data.downloadUrl))
      .catch(() => setFileSignedUrl(null))
      .finally(() => setLoadingFile(false));
  }, [lesson.id, lesson.fileKey]);

  // ── Cargar texto desde URL firmada ──
  useEffect(() => {
    if (!fileSignedUrl || fileCategory !== 'text') return;
    fetch(fileSignedUrl)
      .then(r => r.text())
      .then(setTextContent)
      .catch(() => setTextContent('No se pudo cargar el contenido del archivo.'));
  }, [fileSignedUrl, fileCategory]);

  // ── Cargar contenido TEXT (desde API) ──
  useEffect(() => {
    if (lesson.type === 'TEXT') {
      setLoadingContent(true);
      api.get<Lesson>(`/courses/${courseId}/modules/${lesson.moduleId}/lessons/${lesson.id}`)
        .then(res => setFullLesson(res.data))
        .catch(() => setFullLesson(lesson))
        .finally(() => setLoadingContent(false));
    } else {
      setFullLesson(lesson);
    }
  }, [lesson, courseId]);

  const isCompleted = enrollment?.lessonProgress.some(
    p => p.lessonId === lesson.id && p.completedAt,
  );

  const handleComplete = async () => {
    if (!enrollment || isCompleted) return;
    setCompleting(true);
    try {
      await api.post(`/enrollments/${enrollment.id}/lessons/${lesson.id}/complete`);
      onComplete();
    } finally { setCompleting(false); }
  };

  // ── Cuando se completa un intento ──
  const handleAttemptComplete = (result: AttemptResult) => {
    setLastAttempt(result);
  };

  // ── Renderizador de archivos FILE ──
  const renderFileContent = () => {
    if (loadingFile) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Cargando contenido…</p>
        </div>
      );
    }

    if (!fileSignedUrl) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <File size={28} className="text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Archivo no disponible.</p>
        </div>
      );
    }

    if (fileCategory === 'image') {
      return (
        <div className="flex flex-col items-center gap-4">
          <img src={fileSignedUrl} alt={lesson.fileName ?? 'Imagen'}
            className="max-w-full rounded-2xl border border-border shadow-sm" draggable={false} />
          {!isEmployee && (
            <a href={fileSignedUrl} download={lesson.fileName}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Download size={14} /> Descargar imagen
            </a>
          )}
        </div>
      );
    }

    if (fileCategory === 'pdf') {
      return (
        <div className="flex flex-col h-full gap-3">
          <iframe src={fileSignedUrl} title={lesson.fileName ?? 'PDF'}
            className="w-full flex-1 rounded-2xl border border-border" style={{ minHeight: '65vh' }} />
          {!isEmployee && (
            <div className="flex justify-end">
              <a href={fileSignedUrl} download={lesson.fileName}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Download size={14} /> Descargar PDF
              </a>
            </div>
          )}
        </div>
      );
    }

    if (fileCategory === 'video') {
      return (
        <div className="rounded-2xl overflow-hidden border border-border bg-black shadow-lg">
          <video src={fileSignedUrl} controls className="w-full max-h-[70vh]"
            controlsList={isEmployee ? 'nodownload' : undefined} />
        </div>
      );
    }

    if (fileCategory === 'audio') {
      return (
        <div className="flex flex-col items-center gap-6 py-12">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl"
            style={{ background: '#1E4F7A12', color: '#1E4F7A', border: '1px solid #1E4F7A1A' }}>
            <Icon name="play" size={32} />
          </div>
          <p className="font-semibold text-foreground">{lesson.fileName}</p>
          <audio src={fileSignedUrl} controls className="w-full max-w-md"
            controlsList={isEmployee ? 'nodownload' : undefined} />
        </div>
      );
    }

    if (fileCategory === 'text') {
      return (
        <div className="max-w-3xl">
          {textContent === null ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <pre className="whitespace-pre-wrap rounded-xl border border-border bg-muted/40 p-5 text-sm font-mono leading-relaxed text-foreground overflow-x-auto">
              {textContent}
            </pre>
          )}
          {!isEmployee && (
            <div className="mt-3 flex justify-end">
              <a href={fileSignedUrl} download={lesson.fileName}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Download size={14} /> Descargar archivo
              </a>
            </div>
          )}
        </div>
      );
    }

    if (fileCategory === 'office') {
      return (
        <div className="flex flex-col h-full gap-3">
          <iframe
            src={`https://docs.google.com/viewer?url=${encodeURIComponent(fileSignedUrl)}&embedded=true`}
            title={lesson.fileName ?? 'Documento'}
            className="w-full flex-1 rounded-2xl border border-border"
            style={{ minHeight: '65vh' }}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground/60">Visor de Google Docs. Si no carga, el archivo puede estar aún procesándose.</p>
            {!isEmployee && (
              <a href={fileSignedUrl} download={lesson.fileName}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                <Download size={14} /> Descargar
              </a>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
          <File size={28} className="text-muted-foreground" />
        </div>
        <p className="font-medium text-foreground mb-1">{lesson.fileName ?? 'Archivo adjunto'}</p>
        {lesson.fileSizeBytes && (
          <p className="text-sm text-muted-foreground mb-4">
            {(lesson.fileSizeBytes / 1024 / 1024).toFixed(2)} MB
          </p>
        )}
        {isEmployee ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <Icon name="eye" size={15} /> Este formato no puede visualizarse en el navegador.
          </div>
        ) : (
          <a href={fileSignedUrl} download={lesson.fileName}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-all active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' }}>
            <Download size={15} /> Descargar archivo
          </a>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">

      {/* Header de lección */}
      <div className="flex-shrink-0 border-b border-border px-6 py-4">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50">
          {lesson.type === 'VIDEO' && <><Video size={12} /> Video</>}
          {lesson.type === 'TEXT'  && <><FileText size={12} /> Lectura</>}
          {lesson.type === 'FILE'  && (
            <>
              <File size={12} />
              {fileCategory === 'pdf'    && 'PDF'}
              {fileCategory === 'image'  && 'Imagen'}
              {fileCategory === 'video'  && 'Video'}
              {fileCategory === 'audio'  && 'Audio'}
              {fileCategory === 'text'   && 'Texto'}
              {fileCategory === 'office' && 'Documento'}
              {fileCategory === 'other'  && 'Archivo'}
            </>
          )}
          {evaluation && (
            <>
              <span className="mx-1 opacity-30">·</span>
              <Shield size={11} className="text-capta-deep dark:text-capta-soft" />
              <span className="text-capta-deep dark:text-capta-soft">Evaluación</span>
            </>
          )}
        </div>
        <h2 className="mt-1 text-xl font-bold text-foreground">{lesson.title}</h2>
      </div>

      {/* Contenido + Quiz */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* VIDEO (Mux) */}
        {lesson.type === 'VIDEO' && (
          <div className="space-y-4">
            {lesson.muxPlaybackId && lesson.muxStatus === 'ready' ? (
              <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-lg">
                <MuxPlayer
                  playbackId={lesson.muxPlaybackId}
                  streamType="on-demand"
                  metadata={{ video_title: lesson.title }}
                  accentColor="#1E4F7A"
                  style={{ width: '100%', height: '100%' }}
                  onEnded={handleComplete}
                />
              </div>
            ) : (
              <div className="aspect-video w-full rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center bg-muted/30">
                {lesson.muxStatus === 'preparing' ? (
                  <><Loader2 size={28} className="text-muted-foreground animate-spin mb-2" />
                    <p className="text-sm text-muted-foreground">Video procesándose…</p></>
                ) : lesson.muxStatus === 'errored' ? (
                  <><Video size={28} className="text-destructive/40 mb-2" />
                    <p className="text-sm text-muted-foreground">Error al procesar el video.</p></>
                ) : (
                  <><Video size={28} className="text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">Video no disponible.</p></>
                )}
              </div>
            )}
          </div>
        )}

        {/* TEXT */}
        {lesson.type === 'TEXT' && (
          <div className="max-w-2xl">
            {loadingContent ? (
              <div className="space-y-3 animate-pulse">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-4 bg-muted rounded" style={{ width: `${70 + i * 5}%` }} />
                ))}
              </div>
            ) : fullLesson?.content ? (
              <MarkdownRenderer content={fullLesson.content} />
            ) : (
              <p className="text-muted-foreground italic">Esta lección no tiene contenido.</p>
            )}
          </div>
        )}

        {/* FILE */}
        {lesson.type === 'FILE' && renderFileContent()}

        {/* Quiz (si existe) */}
        {loadingEval && (
          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Cargando evaluación…
          </div>
        )}
        {!loadingEval && evaluation && enrollment && (
          <QuizPanel
            evaluation={evaluation}
            enrollmentId={enrollment.id}
            onAttemptComplete={handleAttemptComplete}
          />
        )}
      </div>

      {/* Footer: completar lección */}
      <div className="flex-shrink-0 border-t border-border px-6 py-4 flex items-center justify-between gap-3">
        {isCompleted ? (
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
            <CheckCircle2 size={18} /> Lección completada
          </div>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-2">
          {enrollment && !isCompleted && (
            <button
              onClick={handleComplete}
              disabled={completing || (evaluation?.isRequired && !evaluation?.passed && !(lastAttempt?.passed))}
              title={evaluation?.isRequired && !evaluation?.passed && !(lastAttempt?.passed)
                ? 'Debes aprobar la evaluación para continuar'
                : undefined}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.97]"
              style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' }}
            >
              {completing ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              Marcar como completada
            </button>
          )}
          {isCompleted && nextLesson && (
            <button
              onClick={() => onNextLesson(nextLesson)}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Siguiente <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function LearnPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [course,        setCourse]        = useState<Course | null>(null);
  const [enrollment,    setEnrollment]    = useState<Enrollment | null>(null);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [userRole,      setUserRole]      = useState<string>('EMPLOYEE');
  const [loading,       setLoading]       = useState(true);
  const [enrolling,     setEnrolling]     = useState(false);
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [certificate,   setCertificate]   = useState<CertificateData | null>(null);
  const [loadingCert,   setLoadingCert]   = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: courseData } = await api.get<Course>(`/courses/${params.id}`);
      setCourse(courseData);

      const { data: enrollments } = await api.get<Enrollment[]>('/enrollments/my');
      const myEnrollment = enrollments.find(e => e.courseId === params.id);
      if (myEnrollment) {
        const e = { ...myEnrollment, lessonProgress: myEnrollment.lessonProgress ?? [] };
        setEnrollment(e);

        // Si ya completó el curso, buscar certificado
        if (myEnrollment.status === 'COMPLETED') {
          fetchCertificate(params.id);
        }
      }

      const firstLesson = courseData.modules[0]?.lessons[0];
      if (firstLesson) setCurrentLesson(firstLesson);
    } catch {
      router.push('/dashboard/courses');
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  const fetchCertificate = async (courseId: string) => {
    setLoadingCert(true);
    try {
      const { data } = await api.get<CertificateData | null>(`/certificates/course/${courseId}`);
      setCertificate(data);
    } catch {
      setCertificate(null);
    } finally {
      setLoadingCert(false);
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw) as { role?: string };
        setUserRole(u.role ?? 'EMPLOYEE');
      }
    } catch { /* ignorar */ }

    load();
  }, [load]);

  const handleEnroll = async () => {
    if (!course) return;
    setEnrolling(true);
    try {
      const { data } = await api.post<Enrollment>('/enrollments', { courseId: course.id });
      setEnrollment(data);
    } finally { setEnrolling(false); }
  };

  const handleLessonComplete = async () => {
    if (!enrollment || !currentLesson || !course) return;

    const alreadyCompleted = enrollment.lessonProgress.some(
      p => p.lessonId === currentLesson.id && p.completedAt,
    );
    const prevCompletedCount = enrollment.lessonProgress.filter(p => p.completedAt).length;
    const newCount = alreadyCompleted ? prevCompletedCount : prevCompletedCount + 1;
    const newProgress = Math.min(100, Math.round((newCount / (course.totalLessons ?? 1)) * 100));
    const isNowCompleted = newProgress >= 100;

    setEnrollment(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        status: isNowCompleted ? 'COMPLETED' : prev.status,
        progress: newProgress,
        lessonProgress: alreadyCompleted
          ? prev.lessonProgress.map(p =>
              p.lessonId === currentLesson.id
                ? { ...p, completedAt: new Date().toISOString() }
                : p,
            )
          : [...prev.lessonProgress, { lessonId: currentLesson.id, completedAt: new Date().toISOString() }],
      };
    });

    // Si acaba de completar el curso, buscar el certificado
    if (isNowCompleted) {
      // Pequeño delay para que el backend genere el certificado
      setTimeout(() => fetchCertificate(course.id), 1500);
    }
  };

  if (loading || !course) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 size={28} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const completedCount = enrollment?.lessonProgress.filter(p => p.completedAt).length ?? 0;
  const progress       = enrollment?.progress ?? 0;
  const isCompleted    = enrollment?.status === 'COMPLETED';

  const allLessons = course.modules.flatMap(m => m.lessons);
  const currentIdx = currentLesson ? allLessons.findIndex(l => l.id === currentLesson.id) : -1;
  const nextLesson = currentIdx >= 0 && currentIdx < allLessons.length - 1
    ? allLessons[currentIdx + 1]
    : null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* Backdrop mobile */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        className={`
          fixed lg:relative z-50 lg:z-auto inset-y-0 left-0
          w-72 flex-shrink-0 flex flex-col border-r border-border bg-card
          ${sidebarOpen ? 'flex' : 'hidden lg:flex'}
        `}
      >
        {/* Header del sidebar */}
        <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border px-4">
          <Link href="/dashboard/courses" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} /> Cursos
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        {/* Curso info + progreso */}
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 mb-2">{course.title}</h2>
          {enrollment && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{completedCount}/{course.totalLessons} lecciones</span>
                <span className="font-semibold" style={{ color: '#7FD1AE' }}>{progress}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  style={{ background: 'linear-gradient(90deg, #1F5C4D, #7FD1AE)' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Árbol de lecciones */}
        <nav className="flex-1 overflow-y-auto p-3">
          <LessonTree
            course={course}
            enrollment={enrollment}
            currentLessonId={currentLesson?.id ?? null}
            onSelectLesson={lesson => {
              setCurrentLesson(lesson);
              setSidebarOpen(false);
            }}
          />
        </nav>

        {/* Panel de curso completado con certificado */}
        {isCompleted && (
          <div className="flex-shrink-0 border-t border-border p-4 space-y-3">
            {/* Badge completado */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{ background: 'linear-gradient(135deg, #16a34a10, #16a34a05)', border: '1px solid #16a34a20' }}
            >
              <Award size={16} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">¡Curso completado!</p>
                <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500/70">100% de las lecciones</p>
              </div>
            </motion.div>

            {/* Botón de certificado */}
            {loadingCert ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                <Loader2 size={12} className="animate-spin" /> Generando certificado…
              </div>
            ) : certificate ? (
              <motion.a
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                href={`/api/certificates/${certificate.id}/download`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={async e => {
                  e.preventDefault();
                  try {
                    const res = await api.get(`/certificates/${certificate.id}/download`, {
                      responseType: 'blob',
                    });
                    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `certificado-${course.title.replace(/\s+/g, '-').toLowerCase()}.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch { /* silencioso */ }
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white hover:opacity-90 active:scale-[0.97] transition-all"
                style={{
                  background:  'linear-gradient(135deg, #F59E0B, #D97706)',
                  boxShadow:   '0 2px 10px rgba(245,158,11,0.30)',
                }}
              >
                <Certificate size={15} />
                Descargar certificado
              </motion.a>
            ) : null}
          </div>
        )}
      </motion.aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Mobile header */}
        <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground hover:text-foreground">
            <Menu size={20} />
          </button>
          <h1 className="text-sm font-semibold text-foreground truncate max-w-[180px]">{course.title}</h1>
          <span className="text-xs font-semibold" style={{ color: '#7FD1AE' }}>{progress}%</span>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-hidden">
          {!enrollment ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4"
                style={{ background: '#1E4F7A12', color: '#1E4F7A' }}>
                <BookOpen size={28} />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">{course.title}</h2>
              {course.description && (
                <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">{course.description}</p>
              )}
              <p className="text-sm text-muted-foreground mb-6">
                {course.totalLessons} {course.totalLessons === 1 ? 'lección' : 'lecciones'} disponibles
              </p>
              <button
                onClick={handleEnroll}
                disabled={enrolling}
                className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 transition-all active:scale-[0.97]"
                style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' }}
              >
                {enrolling ? <Loader2 size={16} className="animate-spin" /> : null}
                Inscribirme en este curso
              </button>
            </div>
          ) : currentLesson ? (
            <LessonViewer
              lesson={currentLesson}
              enrollment={enrollment}
              userRole={userRole}
              onComplete={handleLessonComplete}
              nextLesson={nextLesson}
              onNextLesson={lesson => setCurrentLesson(lesson)}
              courseId={params.id}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground">Selecciona una lección para comenzar.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
