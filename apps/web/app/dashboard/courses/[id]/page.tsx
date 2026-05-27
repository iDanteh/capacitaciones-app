'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/capta-icon';

// Icon aliases for inline usage
const ArrowLeft    = (p: { size?: number; className?: string }) => <Icon name="arrow-left"     size={p.size} className={p.className} />;
const BookOpen     = (p: { size?: number; className?: string }) => <Icon name="book-open"      size={p.size} className={p.className} />;
const Plus         = (p: { size?: number; className?: string }) => <Icon name="plus"           size={p.size} className={p.className} />;
const Trash2       = (p: { size?: number; className?: string }) => <Icon name="trash"          size={p.size} className={p.className} />;
const Edit3        = (p: { size?: number; className?: string }) => <Icon name="edit"           size={p.size} className={p.className} />;
const ChevronDown  = (p: { size?: number; className?: string }) => <Icon name="chevron-down"   size={p.size} className={p.className} />;
const ChevronRight = (p: { size?: number; className?: string }) => <Icon name="chevron-right"  size={p.size} className={p.className} />;
const Video        = (p: { size?: number; className?: string }) => <Icon name="video"          size={p.size} className={p.className} />;
const FileText     = (p: { size?: number; className?: string }) => <Icon name="file"           size={p.size} className={p.className} />;
const File         = (p: { size?: number; className?: string }) => <Icon name="file"           size={p.size} className={p.className} />;
const Globe        = (p: { size?: number; className?: string }) => <Icon name="globe"          size={p.size} className={p.className} />;
const Archive      = (p: { size?: number; className?: string }) => <Icon name="archive"        size={p.size} className={p.className} />;
const Save         = (p: { size?: number; className?: string }) => <Icon name="save"           size={p.size} className={p.className} />;
const Loader2      = (p: { size?: number; className?: string }) => <Icon name="refresh"        size={p.size} className={p.className} />;
const Play         = (p: { size?: number; className?: string }) => <Icon name="play"           size={p.size} className={p.className} />;
const Check        = (p: { size?: number; className?: string }) => <Icon name="check"          size={p.size} className={p.className} />;
const GripVertical = (p: { size?: number; className?: string }) => <Icon name="grip-vertical"  size={p.size} className={p.className} />;
const X            = (p: { size?: number; className?: string }) => <Icon name="close"          size={p.size} className={p.className} />;
const Upload       = (p: { size?: number; className?: string }) => <Icon name="upload"         size={p.size} className={p.className} />;
const AlertCircle  = (p: { size?: number; className?: string }) => <Icon name="alert-circle"  size={p.size} className={p.className} />;
const RefreshCw    = (p: { size?: number; className?: string }) => <Icon name="refresh"        size={p.size} className={p.className} />;
const Eye          = (p: { size?: number; className?: string }) => <Icon name="eye"            size={p.size} className={p.className} />;
const Shield       = (p: { size?: number; className?: string }) => <Icon name="shield"         size={p.size} className={p.className} />;
const Users        = (p: { size?: number; className?: string }) => <Icon name="users"          size={p.size} className={p.className} />;
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';

// ─── Tipos de evaluación (admin) ──────────────────────────────────────────────

interface EvalOption {
  id:        string;
  text:      string;
  isCorrect: boolean;
  order:     number;
}

interface EvalQuestion {
  id:          string;
  text:        string;
  points:      number;
  order:       number;
  explanation: string | null;
  options:     EvalOption[];
}

interface EvaluationAdmin {
  id:           string;
  lessonId:     string;
  title:        string;
  instructions: string | null;
  minScore:     number;
  maxAttempts:  number;
  timeLimit:    number | null;
  isRequired:   boolean;
  questions:    EvalQuestion[];
  attemptCount: number;
}

// ─── Tipos de solicitudes de reinicio ─────────────────────────────────────────

interface ResetRequestItem {
  id:          string;
  userId:      string;
  userName:    string;
  userEmail:   string;
  message:     string | null;
  requestedAt: string;
}

// ─── Editor de evaluación (tab dentro del drawer) ─────────────────────────────

// Subformulario reutilizable para agregar / editar una pregunta
function QuestionForm({
  initial,
  hasAttempts,
  saving,
  onSave,
  onCancel,
}: {
  initial?: { text: string; explanation: string; options: { text: string; isCorrect: boolean }[] };
  hasAttempts: boolean;
  saving: boolean;
  onSave: (data: { text: string; explanation: string; options: { text: string; isCorrect: boolean }[] }) => void;
  onCancel: () => void;
}) {
  const [text,        setText]        = useState(initial?.text        ?? '');
  const [explanation, setExplanation] = useState(initial?.explanation ?? '');
  const [options,     setOptions]     = useState<{ text: string; isCorrect: boolean }[]>(
    initial?.options ?? [{ text: '', isCorrect: false }, { text: '', isCorrect: false }],
  );
  const [localError,  setLocalError]  = useState<string | null>(null);

  const handleSave = () => {
    if (!text.trim()) { setLocalError('El texto de la pregunta es obligatorio.'); return; }
    const valid = options.filter(o => o.text.trim());
    if (valid.length < 2) { setLocalError('Agrega al menos 2 opciones con texto.'); return; }
    if (!valid.some(o => o.isCorrect)) { setLocalError('Debes marcar al menos una opción como correcta.'); return; }
    setLocalError(null);
    onSave({ text: text.trim(), explanation: explanation.trim(), options: valid });
  };

  return (
    <div className="space-y-3">
      {localError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2">
          <AlertCircle size={13} className="text-destructive flex-shrink-0" />
          <p className="text-xs text-destructive">{localError}</p>
        </div>
      )}

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={2}
        placeholder="Texto de la pregunta…"
        className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capta-soft/40 focus:border-capta-soft"
      />

      {/* Opciones */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Opciones — marca la respuesta correcta (●)</p>
          {hasAttempts && (
            <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
              Solo texto editable*
            </span>
          )}
        </div>
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setOptions(prev => prev.map((o, idx) => ({ ...o, isCorrect: idx === i })))
              }
              disabled={hasAttempts}
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all disabled:cursor-not-allowed"
              style={{
                borderColor: opt.isCorrect ? '#16a34a' : undefined,
                background:  opt.isCorrect ? '#16a34a' : 'transparent',
              }}
              title={hasAttempts ? 'No se puede cambiar la respuesta correcta con intentos registrados' : 'Marcar como correcta'}
            >
              {opt.isCorrect && <div className="h-2 w-2 rounded-full bg-white" />}
            </button>
            <input
              value={opt.text}
              onChange={e =>
                setOptions(prev => prev.map((o, idx) => idx === i ? { ...o, text: e.target.value } : o))
              }
              placeholder={`Opción ${i + 1}`}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-capta-soft/40"
            />
            {options.length > 2 && !hasAttempts && (
              <button
                type="button"
                onClick={() => setOptions(prev => prev.filter((_, idx) => idx !== i))}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        {!hasAttempts && (
          <button
            type="button"
            onClick={() => setOptions(prev => [...prev, { text: '', isCorrect: false }])}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-capta-deep dark:hover:text-capta-soft transition-colors"
          >
            <Plus size={12} /> Agregar opción
          </button>
        )}
        {hasAttempts && (
          <p className="text-[10px] text-muted-foreground italic">
            * Las opciones no pueden cambiarse porque ya existen intentos registrados.
          </p>
        )}
      </div>

      {/* Explicación */}
      <textarea
        value={explanation}
        onChange={e => setExplanation(e.target.value)}
        rows={2}
        placeholder="Explicación opcional — se muestra al revisar resultados"
        className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-capta-soft/40"
      />

      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50 transition-all hover:opacity-90 active:scale-[0.97]"
          style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' }}
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Guardar
        </button>
      </div>
    </div>
  );
}

function EvaluationEditorTab({ lessonId, tenantHasEval }: { lessonId: string; tenantHasEval: boolean }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [evaluation,      setEvaluation]      = useState<EvaluationAdmin | null | undefined>(undefined);

  // ── Crear evaluación ──
  const [newTitle,        setNewTitle]        = useState('');
  const [newInstructions, setNewInstructions] = useState('');
  const [minScore,        setMinScore]        = useState(70);
  const [maxAttempts,     setMaxAttempts]     = useState(3);
  const [timeLimitMin,    setTimeLimitMin]    = useState<number | ''>('');  // en minutos ('' = sin límite)
  const [isRequired,      setIsRequired]      = useState(false);
  const [creating,        setCreating]        = useState(false);

  // ── Editar configuración de la evaluación ──
  const [editingSettings, setEditingSettings] = useState(false);
  const [editTitle,       setEditTitle]       = useState('');
  const [editInstr,       setEditInstr]       = useState('');
  const [editMinScore,    setEditMinScore]    = useState(70);
  const [editMaxAttempts, setEditMaxAttempts] = useState(3);
  const [editTimeLimitMin,setEditTimeLimitMin]= useState<number | ''>('');
  const [editRequired,    setEditRequired]    = useState(false);
  const [savingSettings,  setSavingSettings]  = useState(false);

  // ── Preguntas ──
  const [addingQ,         setAddingQ]         = useState(false);
  const [savingQ,         setSavingQ]         = useState(false);
  const [editingQId,      setEditingQId]      = useState<string | null>(null);
  const [savingEditQ,     setSavingEditQ]     = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);  // qId | 'evaluation'
  const [deletingId,      setDeletingId]      = useState<string | null>(null);

  // ── Solicitudes de reinicio de intentos (admin) ──
  const [resetRequests,   setResetRequests]   = useState<ResetRequestItem[]>([]);
  const [processingReqId, setProcessingReqId] = useState<string | null>(null);

  // Carga evaluación al montar / cambiar lección
  useEffect(() => {
    setEvaluation(undefined);
    setEditingSettings(false);
    setAddingQ(false);
    setEditingQId(null);
    setResetRequests([]);
    api.get<EvaluationAdmin | null>(`/lessons/${lessonId}/evaluation/admin`)
      .then(res => {
        setEvaluation(res.data);
        if (res.data) {
          api.get<ResetRequestItem[]>(`/evaluations/${res.data.id}/reset-requests`)
            .then(r => setResetRequests(r.data))
            .catch(() => {});
        }
      })
      .catch(() => setEvaluation(null));
  }, [lessonId]);

  if (!tenantHasEval) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl mb-3"
          style={{ background: '#f59e0b12', color: '#f59e0b' }}>
          <Shield size={20} />
        </div>
        <p className="font-semibold text-foreground mb-1">Plan no compatible</p>
        <p className="text-sm text-muted-foreground">Las evaluaciones requieren el plan Business o Enterprise.</p>
      </div>
    );
  }

  if (evaluation === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Crear evaluación ──
  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post<EvaluationAdmin>(`/lessons/${lessonId}/evaluation`, {
        title:        newTitle.trim(),
        instructions: newInstructions.trim() || undefined,
        minScore,
        maxAttempts,
        timeLimit:    timeLimitMin !== '' ? Number(timeLimitMin) * 60 : undefined,
        isRequired,
      });
      setEvaluation(data);
      toastSuccess('Evaluación creada.');
    } catch (e: any) {
      toastError(e?.response?.data?.message ?? 'No se pudo crear la evaluación.');
    } finally { setCreating(false); }
  };

  // ── Abrir edición de configuración ──
  const openEditSettings = () => {
    if (!evaluation) return;
    setEditTitle(evaluation.title);
    setEditInstr(evaluation.instructions ?? '');
    setEditMinScore(evaluation.minScore);
    setEditMaxAttempts(evaluation.maxAttempts);
    setEditTimeLimitMin(evaluation.timeLimit ? Math.round(evaluation.timeLimit / 60) : '');
    setEditRequired(evaluation.isRequired);
    setEditingSettings(true);
  };

  // ── Guardar configuración ──
  const handleSaveSettings = async () => {
    if (!evaluation || !editTitle.trim()) return;
    setSavingSettings(true);
    try {
      const { data } = await api.patch<EvaluationAdmin>(`/evaluations/${evaluation.id}`, {
        title:        editTitle.trim(),
        instructions: editInstr.trim() || null,
        minScore:     editMinScore,
        maxAttempts:  editMaxAttempts,
        timeLimit:    editTimeLimitMin !== '' ? Number(editTimeLimitMin) * 60 : null,
        isRequired:   editRequired,
      });
      setEvaluation(data);
      setEditingSettings(false);
      toastSuccess('Configuración guardada.');
    } catch (e: any) {
      toastError(e?.response?.data?.message ?? 'No se pudo guardar.');
    } finally { setSavingSettings(false); }
  };

  // ── Confirmar eliminación de evaluación ──
  const handleDeleteEval = async () => {
    if (!evaluation) return;
    setDeletingId('evaluation');
    try {
      await api.delete(`/evaluations/${evaluation.id}`);
      setEvaluation(null);
      setDeleteConfirmId(null);
      toastSuccess('Evaluación eliminada.');
    } catch {
      toastError('No se pudo eliminar la evaluación.');
    } finally { setDeletingId(null); }
  };

  // ── Agregar pregunta ──
  const handleAddQuestion = async (qData: { text: string; explanation: string; options: { text: string; isCorrect: boolean }[] }) => {
    if (!evaluation) return;
    setSavingQ(true);
    try {
      const { data } = await api.post<EvaluationAdmin>(`/evaluations/${evaluation.id}/questions`, {
        text:        qData.text,
        explanation: qData.explanation || undefined,
        options:     qData.options.map((o, i) => ({ text: o.text, isCorrect: o.isCorrect, order: i })),
      });
      setEvaluation(data);
      setAddingQ(false);
      toastSuccess('Pregunta agregada.');
    } catch (e: any) {
      toastError(e?.response?.data?.message ?? 'No se pudo guardar la pregunta.');
    } finally { setSavingQ(false); }
  };

  // ── Editar pregunta ──
  const handleEditQuestion = async (
    questionId: string,
    qData: { text: string; explanation: string; options: { text: string; isCorrect: boolean }[] },
  ) => {
    if (!evaluation) return;
    setSavingEditQ(true);
    try {
      const hasAttempts = (evaluation.attemptCount ?? 0) > 0;
      const payload: Record<string, unknown> = {
        text:        qData.text,
        explanation: qData.explanation || null,
      };
      // Solo enviar options si no hay intentos registrados
      if (!hasAttempts) {
        payload.options = qData.options.map((o, i) => ({ text: o.text, isCorrect: o.isCorrect, order: i }));
      }
      const { data } = await api.patch<EvaluationAdmin>(
        `/evaluations/${evaluation.id}/questions/${questionId}`,
        payload,
      );
      setEvaluation(data);
      setEditingQId(null);
      toastSuccess('Pregunta actualizada.');
    } catch (e: any) {
      toastError(e?.response?.data?.message ?? 'No se pudo actualizar la pregunta.');
    } finally { setSavingEditQ(false); }
  };

  // ── Confirmar eliminación de pregunta ──
  const handleDeleteQuestion = async (questionId: string) => {
    if (!evaluation) return;
    setDeletingId(questionId);
    try {
      await api.delete(`/evaluations/${evaluation.id}/questions/${questionId}`);
      setEvaluation(prev =>
        prev ? { ...prev, questions: prev.questions.filter(q => q.id !== questionId) } : prev,
      );
      setDeleteConfirmId(null);
    } catch {
      toastError('No se pudo eliminar la pregunta.');
    } finally { setDeletingId(null); }
  };

  // ── Aprobar solicitud de reinicio ──
  const handleApproveReset = async (reqId: string) => {
    if (!evaluation) return;
    setProcessingReqId(reqId);
    try {
      await api.post(`/evaluations/${evaluation.id}/reset-requests/${reqId}/approve`);
      setResetRequests(prev => prev.filter(r => r.id !== reqId));
      // El attemptCount se resetea para ese usuario pero el total puede cambiar
      toastSuccess('Intentos restablecidos. El estudiante puede volver a intentarlo.');
    } catch {
      toastError('No se pudo aprobar la solicitud.');
    } finally { setProcessingReqId(null); }
  };

  // ── Rechazar solicitud de reinicio ──
  const handleDenyReset = async (reqId: string) => {
    if (!evaluation) return;
    setProcessingReqId(reqId);
    try {
      await api.post(`/evaluations/${evaluation.id}/reset-requests/${reqId}/deny`);
      setResetRequests(prev => prev.filter(r => r.id !== reqId));
      toastSuccess('Solicitud rechazada.');
    } catch {
      toastError('No se pudo rechazar la solicitud.');
    } finally { setProcessingReqId(null); }
  };

  const hasAttempts = (evaluation?.attemptCount ?? 0) > 0;

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Sin evaluación: formulario de creación ── */}
      {!evaluation && (
        <div className="rounded-2xl border border-dashed border-border p-5 space-y-4">
          <div className="text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl mx-auto mb-2"
              style={{ background: '#1E4F7A10', color: '#1E4F7A' }}>
              <Shield size={18} />
            </div>
            <p className="font-semibold text-foreground text-sm">Sin evaluación</p>
            <p className="text-xs text-muted-foreground mt-0.5">Crea un quiz para esta lección</p>
          </div>

          <div className="space-y-3">
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Título del quiz (Ej: Evaluación Módulo 1)"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capta-soft/40 focus:border-capta-soft"
            />
            <textarea
              value={newInstructions}
              onChange={e => setNewInstructions(e.target.value)}
              rows={2}
              placeholder="Instrucciones para el empleado (opcional)"
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-capta-soft/40"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Puntuación mínima (%)</label>
                <input type="number" min="0" max="100" value={minScore}
                  onChange={e => setMinScore(Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capta-soft/40" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Intentos máximos (-1=∞)</label>
                <input type="number" min="-1" value={maxAttempts}
                  onChange={e => setMaxAttempts(Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capta-soft/40" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Tiempo límite (min, opcional)</label>
                <input
                  type="number" min="1"
                  value={timeLimitMin}
                  onChange={e => setTimeLimitMin(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Sin límite"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capta-soft/40" />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={isRequired} onChange={e => setIsRequired(e.target.checked)} className="rounded" />
              <span className="text-sm text-foreground">Obligatoria (bloquea avance hasta aprobar)</span>
            </label>
            <button
              onClick={handleCreate}
              disabled={!newTitle.trim() || creating}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-all hover:opacity-90 active:scale-[0.97]"
              style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' }}
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
              Crear evaluación
            </button>
          </div>
        </div>
      )}

      {/* ── Evaluación existente ── */}
      {evaluation && (
        <div className="space-y-3">

          {/* Header de la evaluación */}
          <AnimatePresence mode="wait">
            {editingSettings ? (
              /* ── Formulario de edición de configuración ── */
              <motion.div
                key="settings-edit"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-capta-soft/30 bg-capta-soft/5 p-4 space-y-3"
              >
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Configuración de la evaluación
                </p>
                <input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  placeholder="Título"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capta-soft/40 focus:border-capta-soft"
                />
                <textarea
                  value={editInstr}
                  onChange={e => setEditInstr(e.target.value)}
                  rows={2}
                  placeholder="Instrucciones (opcional)"
                  className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-capta-soft/40"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Puntuación mínima (%)</label>
                    <input type="number" min="0" max="100" value={editMinScore}
                      onChange={e => setEditMinScore(Number(e.target.value))}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-capta-soft/40" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Intentos máximos</label>
                    <input type="number" min="-1" value={editMaxAttempts}
                      onChange={e => setEditMaxAttempts(Number(e.target.value))}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-capta-soft/40" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Tiempo límite (min)</label>
                    <input
                      type="number" min="1"
                      value={editTimeLimitMin}
                      onChange={e => setEditTimeLimitMin(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Sin límite"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-capta-soft/40" />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={editRequired} onChange={e => setEditRequired(e.target.checked)} className="rounded" />
                  <span className="text-sm text-foreground">Obligatoria</span>
                </label>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditingSettings(false)}
                    className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveSettings}
                    disabled={!editTitle.trim() || savingSettings}
                    className="flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50 transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' }}
                  >
                    {savingSettings ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    Guardar
                  </button>
                </div>
              </motion.div>
            ) : deleteConfirmId === 'evaluation' ? (
              /* ── Confirmación de borrado de evaluación ── */
              <motion.div
                key="eval-delete-confirm"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-semibold text-destructive">¿Eliminar evaluación?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Se borrarán todas las preguntas e intentos.</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => setDeleteConfirmId(null)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
                    Cancelar
                  </button>
                  <button
                    onClick={handleDeleteEval}
                    disabled={deletingId === 'evaluation'}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-destructive hover:bg-destructive/90 disabled:opacity-60 transition-all"
                  >
                    {deletingId === 'evaluation' ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    Eliminar
                  </button>
                </div>
              </motion.div>
            ) : (
              /* ── Vista de resumen de la evaluación ── */
              <motion.div
                key="eval-header"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-start justify-between rounded-xl border border-border bg-muted/30 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{evaluation.title}</p>
                    {evaluation.isRequired && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                        style={{ background: '#f59e0b18', color: '#f59e0b' }}>
                        Obligatoria
                      </span>
                    )}
                    {hasAttempts && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                        style={{ background: '#8FC4E818', color: '#1E4F7A' }}>
                        {evaluation.attemptCount} {evaluation.attemptCount === 1 ? 'intento' : 'intentos'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Mínimo {evaluation.minScore}% ·{' '}
                    {evaluation.maxAttempts === -1 ? 'intentos ilimitados' : `${evaluation.maxAttempts} intentos`}
                    {evaluation.timeLimit && ` · ${Math.round(evaluation.timeLimit / 60)} min`}
                  </p>
                  {evaluation.instructions && (
                    <p className="text-xs text-muted-foreground/70 italic mt-1 line-clamp-2">{evaluation.instructions}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                  <button
                    onClick={openEditSettings}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-capta-deep hover:bg-capta-tint/60 dark:hover:text-capta-soft dark:hover:bg-capta-soft/10 transition-colors"
                    title="Editar configuración"
                  >
                    <Edit3 size={13} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId('evaluation')}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Eliminar evaluación"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Solicitudes de reinicio pendientes ── */}
          {resetRequests.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle size={12} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">
                  Nueva oportunidad solicitada ({resetRequests.length})
                </h4>
              </div>
              {resetRequests.map(req => (
                <div
                  key={req.id}
                  className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-900/10 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{req.userName}</p>
                      <p className="text-xs text-muted-foreground truncate">{req.userEmail}</p>
                      {req.message && (
                        <p className="mt-1 text-xs text-foreground/70 italic border-l-2 border-amber-300 dark:border-amber-700 pl-2">
                          "{req.message}"
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(req.requestedAt).toLocaleDateString('es-MX', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleDenyReset(req.id)}
                        disabled={processingReqId === req.id}
                        className="text-xs px-2.5 py-1 rounded-lg border border-border bg-background text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors disabled:opacity-50"
                      >
                        Rechazar
                      </button>
                      <button
                        onClick={() => handleApproveReset(req.id)}
                        disabled={processingReqId === req.id}
                        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg text-white font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' }}
                      >
                        {processingReqId === req.id
                          ? <Loader2 size={10} className="animate-spin" />
                          : <Check size={10} />}
                        Aprobar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Lista de preguntas */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Preguntas ({evaluation.questions.length})
            </h4>
            {evaluation.questions.length === 0 && (
              <p className="text-sm text-muted-foreground italic px-1">Sin preguntas. Agrega al menos una.</p>
            )}

            <AnimatePresence initial={false}>
              {evaluation.questions.map((q, qi) => (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="rounded-xl border border-border bg-background overflow-hidden transition-colors hover:border-capta-soft/30"
                >
                  {/* Cabecera de la pregunta */}
                  <div className="flex items-start gap-2 px-3 py-2.5">
                    <span className="text-xs font-bold text-muted-foreground/60 mt-0.5 flex-shrink-0 tabular-nums">{qi + 1}.</span>
                    <p className="text-sm font-medium text-foreground flex-1 leading-snug">{q.text}</p>
                    <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                      <button
                        onClick={() => {
                          setEditingQId(editingQId === q.id ? null : q.id);
                          setDeleteConfirmId(null);
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground hover:text-capta-deep hover:bg-capta-tint/60 dark:hover:text-capta-soft dark:hover:bg-capta-soft/10 transition-colors"
                        title="Editar pregunta"
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        onClick={() => {
                          setDeleteConfirmId(deleteConfirmId === q.id ? null : q.id);
                          setEditingQId(null);
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Eliminar pregunta"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Opciones en vista de solo lectura */}
                  {editingQId !== q.id && deleteConfirmId !== q.id && (
                    <div className="px-3 pb-3 space-y-1">
                      {q.options.map(o => (
                        <div key={o.id} className="flex items-center gap-2">
                          <div
                            className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full"
                            style={{
                              background: o.isCorrect ? '#16a34a18' : '#ef444418',
                              border:     `1.5px solid ${o.isCorrect ? '#16a34a40' : '#ef444440'}`,
                            }}
                          >
                            {o.isCorrect && <div className="h-1.5 w-1.5 rounded-full bg-emerald-600" />}
                          </div>
                          <span className={`text-xs ${o.isCorrect ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                            {o.text}
                          </span>
                        </div>
                      ))}
                      {q.explanation && (
                        <p className="mt-1.5 text-xs text-muted-foreground/70 italic border-l-2 border-border pl-2">{q.explanation}</p>
                      )}
                    </div>
                  )}

                  {/* Formulario de edición inline */}
                  <AnimatePresence>
                    {editingQId === q.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-border"
                      >
                        <div className="px-3 py-3 bg-capta-soft/5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-3">
                            Editando pregunta
                          </p>
                          <QuestionForm
                            initial={{
                              text:        q.text,
                              explanation: q.explanation ?? '',
                              options:     q.options.map(o => ({ text: o.text, isCorrect: o.isCorrect })),
                            }}
                            hasAttempts={hasAttempts}
                            saving={savingEditQ}
                            onSave={data => handleEditQuestion(q.id, data)}
                            onCancel={() => setEditingQId(null)}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Confirmación de borrado inline */}
                  <AnimatePresence>
                    {deleteConfirmId === q.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden border-t border-destructive/20"
                      >
                        <div className="px-3 py-2.5 bg-destructive/5 flex items-center justify-between gap-3">
                          <p className="text-xs text-destructive font-medium">¿Eliminar esta pregunta?</p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={() => setDeleteConfirmId(null)}
                              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors">
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleDeleteQuestion(q.id)}
                              disabled={deletingId === q.id}
                              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-white bg-destructive hover:bg-destructive/90 disabled:opacity-60 transition-all"
                            >
                              {deletingId === q.id ? <Loader2 size={10} className="animate-spin" /> : null}
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Agregar pregunta */}
          <AnimatePresence>
            {addingQ ? (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-xl border border-capta-soft/30 bg-capta-soft/5 p-4"
              >
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground mb-3">
                  Nueva pregunta
                </p>
                <QuestionForm
                  hasAttempts={false}
                  saving={savingQ}
                  onSave={handleAddQuestion}
                  onCancel={() => setAddingQ(false)}
                />
              </motion.div>
            ) : (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => { setAddingQ(true); setEditingQId(null); setDeleteConfirmId(null); }}
                className="flex w-full items-center gap-2 rounded-xl border-2 border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground hover:border-capta-soft/50 hover:text-capta-soft transition-all"
              >
                <Plus size={14} /> Agregar pregunta
              </motion.button>
            )}
          </AnimatePresence>

        </div>
      )}
    </div>
  );
}

// ─── Inscritos en el curso ────────────────────────────────────────────────────

interface EnrolleeUser {
  id:        string;
  firstName: string;
  lastName:  string;
  email:     string;
  avatarUrl?: string;
}

interface Enrollee {
  id:          string;
  progress:    number;
  status:      'ACTIVE' | 'COMPLETED' | 'DROPPED';
  completedAt: string | null;
  createdAt:   string;
  user:        EnrolleeUser;
}

const ENROLLEE_STATUS: Record<string, { label: string; className: string }> = {
  ACTIVE:    { label: 'En curso',   className: 'bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400' },
  COMPLETED: { label: 'Completado', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' },
  DROPPED:   { label: 'Abandonó',   className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

function EnrolleesSection({ courseId }: { courseId: string }) {
  const [open,     setOpen]     = useState(false);
  const [enrollees,setEnrollees]= useState<Enrollee[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [fetched,  setFetched]  = useState(false);

  const load = useCallback(async () => {
    if (fetched) return;
    setLoading(true);
    try {
      const { data } = await api.get<Enrollee[]>(`/enrollments/course/${courseId}`);
      setEnrollees(data);
      setFetched(true);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [courseId, fetched]);

  const handleToggle = () => {
    if (!open && !fetched) load();
    setOpen(o => !o);
  };

  const completedCount = enrollees.filter(e => e.status === 'COMPLETED').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.08 }}
      className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
    >
      {/* Header colapsable */}
      <button
        onClick={handleToggle}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'linear-gradient(135deg, #DCE9F4, #8FC4E840)', color: '#1E4F7A' }}
        >
          <Users size={15} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Estudiantes inscritos</p>
          {fetched && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {enrollees.length} {enrollees.length === 1 ? 'estudiante' : 'estudiantes'}
              {completedCount > 0 && ` · ${completedCount} completaron`}
            </p>
          )}
        </div>
        {fetched && enrollees.length > 0 && (
          <span
            className="flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' }}
          >
            {enrollees.length}
          </span>
        )}
        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Contenido colapsable */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="enrollees-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-border"
          >
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div
                  className="h-5 w-5 animate-spin rounded-full border-2 border-transparent"
                  style={{ borderTopColor: '#1E4F7A', borderRightColor: '#8FC4E820' }}
                />
              </div>
            ) : enrollees.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted mb-3">
                  <Users size={18} className="text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-foreground">Sin inscritos aún</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Los estudiantes aparecerán aquí cuando se inscriban al curso.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {enrollees.map(e => {
                  const fullName = `${e.user.firstName} ${e.user.lastName}`;
                  const initials = `${e.user.firstName.charAt(0)}${e.user.lastName.charAt(0)}`.toUpperCase();
                  const st = ENROLLEE_STATUS[e.status] ?? ENROLLEE_STATUS.ACTIVE;
                  const enrollDate = new Date(e.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
                  const doneDate   = e.completedAt
                    ? new Date(e.completedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
                    : null;

                  return (
                    <div key={e.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                      {/* Avatar */}
                      <div
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                        style={{ background: 'linear-gradient(135deg, #DCE9F4, #8FC4E830)', color: '#1E4F7A' }}
                      >
                        {initials}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{fullName}</p>
                        <p className="text-xs text-muted-foreground truncate">{e.user.email}</p>
                      </div>

                      {/* Progreso */}
                      <div className="hidden sm:flex flex-col items-end gap-1 w-28 flex-shrink-0">
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[10px] text-muted-foreground">Progreso</span>
                          <span className="text-[11px] font-semibold text-foreground">{e.progress}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${e.progress}%`,
                              background: e.status === 'COMPLETED'
                                ? 'linear-gradient(90deg, #16a34a, #22c55e)'
                                : 'linear-gradient(90deg, #1E4F7A, #2D6FA0)',
                            }}
                          />
                        </div>
                      </div>

                      {/* Estado */}
                      <span className={`hidden md:inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.className}`}>
                        {st.label}
                      </span>

                      {/* Fecha */}
                      <div className="hidden lg:flex flex-col items-end flex-shrink-0 text-right">
                        {doneDate ? (
                          <>
                            <span className="text-[10px] text-muted-foreground">Completó</span>
                            <span className="text-[11px] font-medium text-foreground">{doneDate}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] text-muted-foreground">Inscrito</span>
                            <span className="text-[11px] font-medium text-foreground">{enrollDate}</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Lesson {
  id: string;
  title: string;
  type: 'VIDEO' | 'TEXT' | 'FILE';
  order: number;
  isPreview: boolean;
  duration?: number;
  muxStatus?: string;
  muxPlaybackId?: string;
  fileKey?: string;
  fileName?: string;
  fileSizeBytes?: number;
  content?: string;
}

interface Module {
  id: string;
  title: string;
  description?: string;
  order: number;
  lessons: Lesson[];
}

interface Course {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  totalLessons: number;
  enrollmentCount?: number;
  modules: Module[];
}

// ─── Iconos y helpers ─────────────────────────────────────────────────────────

const LESSON_ICON = { VIDEO: Video, TEXT: FileText, FILE: File };

function formatDuration(seconds?: number): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')} min`;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Drawer: Editor de contenido de lección ───────────────────────────────────
//
// Patrón: slide-over panel desde la derecha (estándar SaaS: Linear, Notion, Airtable).
// Cada tipo de lección muestra controles específicos para su contenido.

function LessonContentDrawer({
  lesson,
  courseId,
  moduleId,
  onClose,
  onUpdated,
  tenantHasEval = true,
}: {
  lesson: Lesson;
  courseId: string;
  moduleId: string;
  onClose: () => void;
  onUpdated: (updated: Partial<Lesson>) => void;
  tenantHasEval?: boolean;
}) {
  type DrawerTab = 'content' | 'evaluation';
  const [activeTab, setActiveTab] = useState<DrawerTab>('content');

  const { success: toastSuccess, error: toastError } = useToast();

  // ── Estado compartido ──
  const [saving,   setSaving]   = useState(false);

  // ── Estado VIDEO ──
  const [videoFile,     setVideoFile]     = useState<File | null>(null);
  const [uploadProgress,setUploadProgress]= useState(0);
  const [uploading,     setUploading]     = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // ── Estado TEXT ──
  const [content, setContent] = useState(lesson.content ?? '');
  const [loadingContent, setLoadingContent] = useState(false);

  // La query del árbol del editor excluye `content` para no transferir Markdown
  // pesado en cada carga. Cargamos el contenido completo al abrir el drawer.
  useEffect(() => {
    if (lesson.type !== 'TEXT' || lesson.content !== undefined) return;
    setLoadingContent(true);
    api.get<{ content?: string }>(`/courses/${courseId}/modules/${moduleId}/lessons/${lesson.id}`)
      .then(res => setContent(res.data.content ?? ''))
      .catch(() => {})
      .finally(() => setLoadingContent(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  // ── Estado FILE ──
  const [docFile,     setDocFile]     = useState<File | null>(null);
  const [docProgress, setDocProgress] = useState(0);
  const [docUploading,setDocUploading]= useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);

  // ── Handler VIDEO ─────────────────────────────────────────────────────────

  const handleVideoUpload = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);

    try {
      // 1. Crear direct upload en Mux
      const { data: muxData } = await api.post<{ uploadUrl: string; uploadId: string }>(
        '/video/upload-url',
        { lessonId: lesson.id },
      );

      // 2. Subir el video directamente a Mux con XMLHttpRequest para tener progreso real
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload  = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
        xhr.onerror = () => reject(new Error('Error de red al subir el video'));
        xhr.open('PUT', muxData.uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      // El webhook de Mux actualizará muxStatus → 'ready' cuando termine de procesar.
      onUpdated({ muxStatus: 'preparing' });
      toastSuccess('Video subido', 'Se procesará en unos momentos.');
    } catch (e: unknown) {
      toastError((e as Error).message ?? 'Error al subir el video. Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  // ── Handler TEXT ──────────────────────────────────────────────────────────

  const handleTextSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/courses/${courseId}/modules/${moduleId}/lessons/${lesson.id}`, { content });
      onUpdated({ content });
      toastSuccess('Guardado correctamente.');
    } catch {
      toastError('No se pudo guardar el contenido.');
    } finally {
      setSaving(false);
    }
  };

  // ── Handler FILE ──────────────────────────────────────────────────────────

  const handleFileUpload = async (file: File) => {
    setDocUploading(true);
    setDocProgress(0);

    try {
      // 1. Obtener presigned URL (archivos de lecciones son privados — sin isPublic)
      const { data: presigned } = await api.post<{ uploadUrl: string; key: string }>(
        '/storage/presigned-upload',
        { fileName: file.name, folder: 'lessons', contentType: file.type },
      );

      // 2. Subir con XHR para progreso real
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setDocProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload  = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
        xhr.onerror = () => reject(new Error('Error de red al subir el archivo'));
        xhr.open('PUT', presigned.uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      // 3. Guardar metadata del archivo en la lección
      await api.patch(`/courses/${courseId}/modules/${moduleId}/lessons/${lesson.id}`, {
        fileKey:       presigned.key,
        fileName:      file.name,
        fileSizeBytes: file.size,
        fileMimeType:  file.type,
      });

      onUpdated({ fileKey: presigned.key, fileName: file.name, fileSizeBytes: file.size });
      setDocFile(null);
      toastSuccess('Archivo subido correctamente.');
    } catch (e: unknown) {
      toastError((e as Error).message ?? 'Error al subir el archivo. Intenta de nuevo.');
    } finally {
      setDocUploading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
      />

      {/* Panel */}
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-card border-l border-border shadow-2xl"
      >
        {/* Header */}
        <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border px-5">
          <div className="flex items-center gap-2.5">
            {lesson.type === 'VIDEO' && <Video size={16} className="text-capta-soft" />}
            {lesson.type === 'TEXT'  && <FileText size={16} className="text-emerald-600 dark:text-emerald-400" />}
            {lesson.type === 'FILE'  && <File size={16} className="text-amber-500" />}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {lesson.type === 'VIDEO' ? 'Lección de video' : lesson.type === 'TEXT' ? 'Lección de texto' : 'Archivo adjunto'}
              </p>
              <p className="text-sm font-bold text-foreground leading-tight truncate max-w-[260px]">
                {lesson.title}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-border px-5 gap-1 flex-shrink-0">
          {([
            { key: 'content',    label: 'Contenido', icon: 'file' },
            { key: 'evaluation', label: 'Evaluación', icon: 'shield' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-all -mb-px ${
                activeTab === tab.key
                  ? 'border-capta-deep text-capta-deep dark:border-capta-soft dark:text-capta-soft'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={tab.icon as any} size={12} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Contenido del drawer */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Tab: Evaluación */}
          {activeTab === 'evaluation' && (
            <EvaluationEditorTab lessonId={lesson.id} tenantHasEval={tenantHasEval} />
          )}

          {/* Tab: Contenido — visible solo cuando activeTab === 'content' */}
          <div className={activeTab === 'content' ? 'contents' : 'hidden'}>

          {/* ── VIDEO ─────────────────────────────────────────────────────── */}
          {lesson.type === 'VIDEO' && (
            <div className="space-y-4">
              {/* Estado actual del video */}
              {lesson.muxStatus && (
                <div className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 ${
                  lesson.muxStatus === 'ready'
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/5'
                    : lesson.muxStatus === 'errored'
                    ? 'border-destructive/20 bg-destructive/5'
                    : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
                }`}>
                  {lesson.muxStatus === 'ready' && <Check size={15} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />}
                  {lesson.muxStatus === 'errored' && <AlertCircle size={15} className="text-destructive flex-shrink-0" />}
                  {lesson.muxStatus === 'preparing' && <Loader2 size={15} className="text-amber-600 animate-spin flex-shrink-0" />}
                  <div>
                    <p className={`text-sm font-medium ${
                      lesson.muxStatus === 'ready' ? 'text-emerald-600 dark:text-emerald-400' : lesson.muxStatus === 'errored' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'
                    }`}>
                      {lesson.muxStatus === 'ready' ? 'Video listo para reproducirse'
                        : lesson.muxStatus === 'errored' ? 'Error al procesar el video'
                        : 'Video procesándose… puede tardar unos minutos'}
                    </p>
                    {lesson.duration && lesson.muxStatus === 'ready' && (
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDuration(lesson.duration)}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Drop zone de video */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {lesson.muxStatus ? 'Reemplazar video' : 'Subir video'}
                </label>
                <p className="text-xs text-muted-foreground mb-3">
                  Formatos: MP4, MOV, MKV, WebM. Máx. recomendado: 4 GB.
                  El video se procesará en Mux (streaming adaptativo).
                </p>

                {uploading ? (
                  // Progreso de carga
                  <div className="rounded-2xl border border-capta-soft/30 bg-capta-soft/5 p-5 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{videoFile?.name}</span>
                      <span className="text-capta-soft font-semibold">{uploadProgress}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-capta-soft"
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        transition={{ ease: 'linear', duration: 0.2 }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Subiendo a Mux… no cierres esta ventana.
                    </p>
                  </div>
                ) : (
                  <label
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      const f = e.dataTransfer.files[0];
                      if (f) { setVideoFile(f); handleVideoUpload(f); }
                    }}
                    className="flex flex-col items-center justify-center w-full rounded-2xl border-2 border-dashed border-border bg-muted/20 py-10 px-6 text-center hover:border-capta-soft/50 hover:bg-capta-soft/5 transition-all cursor-pointer"
                  >
                    <Upload size={28} className="text-muted-foreground mb-3" />
                    <p className="text-sm font-medium text-foreground mb-1">
                      Arrastra el video aquí, o haz clic para seleccionar
                    </p>
                    <p className="text-xs text-muted-foreground">MP4 · MOV · MKV · WebM</p>
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) { setVideoFile(f); handleVideoUpload(f); }
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* ── TEXT ──────────────────────────────────────────────────────── */}
          {lesson.type === 'TEXT' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-foreground">
                  Contenido (Markdown soportado)
                </label>
                <span className="text-xs text-muted-foreground">{content.length} caracteres</span>
              </div>
              {loadingContent ? (
                <div className="rounded-xl border border-border bg-background px-4 py-3 space-y-2.5 animate-pulse" style={{ minHeight: '18rem' }}>
                  {[55, 80, 65, 90, 70, 45].map((w, i) => (
                    <div key={i} className="h-3 rounded-md bg-muted" style={{ width: `${w}%` }} />
                  ))}
                </div>
              ) : (
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  rows={18}
                  placeholder={`# Título de la lección\n\nEscribe el contenido aquí...\n\n## Subtítulo\n\nPuedes usar **negrita**, *cursiva*, \`código\`, listas, etc.`}
                  className="w-full resize-y rounded-xl border border-border bg-background px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-capta-soft/40 focus:border-capta-soft transition-all leading-relaxed"
                />
              )}
              <button
                onClick={handleTextSave}
                disabled={saving || loadingContent}
                className="flex items-center gap-2 rounded-xl bg-capta-deep px-4 py-2.5 text-sm font-semibold text-white hover:bg-capta-deep/90 disabled:opacity-50 transition-all active:scale-[0.97]"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Guardar contenido
              </button>
            </div>
          )}

          {/* ── FILE ──────────────────────────────────────────────────────── */}
          {activeTab === 'content' && lesson.type === 'FILE' && (
            <div className="space-y-4">
              {/* Archivo actual */}
              {lesson.fileKey && (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/20">
                    <File size={16} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{lesson.fileName}</p>
                    {lesson.fileSizeBytes && (
                      <p className="text-xs text-muted-foreground">{formatBytes(lesson.fileSizeBytes)}</p>
                    )}
                  </div>
                  <span className="flex-shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    Cargado
                  </span>
                </div>
              )}

              {/* Drop zone */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {lesson.fileKey ? 'Reemplazar archivo' : 'Subir archivo'}
                </label>
                <p className="text-xs text-muted-foreground mb-3">
                  PDF, ZIP, DOCX, XLSX, PPTX y más. Máx. según tu plan de storage.
                  El archivo se descargará de forma segura (URL firmada).
                </p>

                {docUploading ? (
                  <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-5 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{docFile?.name}</span>
                      <span className="text-amber-600 font-semibold">{docProgress}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-amber-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${docProgress}%` }}
                        transition={{ ease: 'linear', duration: 0.2 }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Subiendo archivo…</p>
                  </div>
                ) : (
                  <label
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      const f = e.dataTransfer.files[0];
                      if (f) { setDocFile(f); handleFileUpload(f); }
                    }}
                    className="flex flex-col items-center justify-center w-full rounded-2xl border-2 border-dashed border-border bg-muted/20 py-10 px-6 text-center hover:border-amber-400/50 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-all cursor-pointer"
                  >
                    <Upload size={28} className="text-muted-foreground mb-3" />
                    <p className="text-sm font-medium text-foreground mb-1">
                      Arrastra el archivo aquí, o haz clic para seleccionar
                    </p>
                    <p className="text-xs text-muted-foreground">PDF · DOCX · XLSX · PPTX · ZIP · y más</p>
                    <input
                      ref={docInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) { setDocFile(f); handleFileUpload(f); }
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          )}
          </div>{/* fin div de contenido del tab */}
        </div>
      </motion.aside>
    </>
  );
}

// ─── Componente: fila de lección ─────────────────────────────────────────────

function LessonRow({
  lesson,
  onDelete,
  onEdit,
  courseId,
  moduleId,
}: {
  lesson: Lesson;
  onDelete: (id: string) => void;
  onEdit: (lesson: Lesson) => void;
  courseId: string;
  moduleId: string;
}) {
  const Icon = LESSON_ICON[lesson.type];
  const [deleting,       setDeleting]       = useState(false);
  const [deleteConfirm,  setDeleteConfirm]  = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/courses/${courseId}/modules/${moduleId}/lessons/${lesson.id}`);
      onDelete(lesson.id);
    } catch { setDeleting(false); setDeleteConfirm(false); }
  };

  // Indicador de si tiene contenido cargado
  const hasContent =
    (lesson.type === 'VIDEO' && lesson.muxStatus === 'ready') ||
    (lesson.type === 'TEXT'  && !!lesson.content) ||
    (lesson.type === 'FILE'  && !!lesson.fileKey);

  const isPreparing = lesson.type === 'VIDEO' && lesson.muxStatus === 'preparing';

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 hover:border-capta-soft/30 transition-all">
      <GripVertical size={14} className="text-muted-foreground/40 flex-shrink-0 cursor-grab" />
      <Icon size={15} className="text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{lesson.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {lesson.isPreview && (
            <span className="text-[10px] font-semibold text-capta-soft uppercase tracking-wide">Preview</span>
          )}
          {lesson.duration && (
            <span className="text-[10px] text-muted-foreground">{formatDuration(lesson.duration)}</span>
          )}
          {isPreparing && (
            <span className="flex items-center gap-1 text-[10px] text-amber-500 font-medium">
              <Loader2 size={9} className="animate-spin" /> Procesando…
            </span>
          )}
          {lesson.type === 'VIDEO' && lesson.muxStatus === 'errored' && (
            <span className="text-[10px] font-medium text-destructive">Error de video</span>
          )}
          {/* Indicador de contenido vacío */}
          {!hasContent && !isPreparing && (
            <span className="text-[10px] text-muted-foreground/60 italic">Sin contenido</span>
          )}
        </div>
      </div>

      {/* Acciones: editar + eliminar */}
      {deleteConfirm ? (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[11px] text-muted-foreground">¿Eliminar?</span>
          <button
            onClick={() => setDeleteConfirm(false)}
            className="rounded-lg px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted transition-colors"
          >
            No
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold text-white bg-destructive hover:bg-destructive/90 disabled:opacity-60 transition-all"
          >
            {deleting && <Loader2 size={10} className="animate-spin" />}
            Sí
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={() => onEdit(lesson)}
            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-capta-deep hover:border-capta-soft/40 dark:hover:text-capta-soft transition-all"
          >
            <Edit3 size={11} /> Editar
          </button>
          <button
            onClick={() => setDeleteConfirm(true)}
            className="opacity-0 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          >
            <Trash2 size={13} />
          </button>
        </>
      )}
    </div>
  );
}

// ─── Componente: acordeón de módulo ──────────────────────────────────────────

function ModuleAccordion({
  module,
  courseId,
  onModuleDelete,
  onModuleUpdate,
  onLessonDelete,
  onLessonAdd,
  onLessonEdit,
}: {
  module: Module;
  courseId: string;
  onModuleDelete: (id: string) => void;
  onModuleUpdate: (id: string, title: string) => void;
  onLessonDelete: (moduleId: string, lessonId: string) => void;
  onLessonAdd: (moduleId: string, lesson: Lesson) => void;
  onLessonEdit: (lesson: Lesson, moduleId: string) => void;
}) {
  const [expanded,       setExpanded]       = useState(true);
  const [addingLesson,   setAddingLesson]   = useState(false);
  const [lessonTitle,    setLessonTitle]    = useState('');
  const [lessonType,     setLessonType]     = useState<'VIDEO' | 'TEXT' | 'FILE'>('TEXT');
  const [saving,         setSaving]         = useState(false);
  const [deleting,       setDeleting]       = useState(false);
  const [deleteConfirm,  setDeleteConfirm]  = useState(false);

  const handleAddLesson = async () => {
    if (!lessonTitle.trim()) return;
    setSaving(true);
    try {
      const { data } = await api.post<Lesson>(
        `/courses/${courseId}/modules/${module.id}/lessons`,
        { title: lessonTitle.trim(), type: lessonType },
      );
      onLessonAdd(module.id, data);
      setLessonTitle('');
      setAddingLesson(false);
    } finally { setSaving(false); }
  };

  const handleDeleteModule = async () => {
    setDeleteConfirm(false);
    setDeleting(true);
    try {
      await api.delete(`/courses/${courseId}/modules/${module.id}`);
      onModuleDelete(module.id);
    } catch { setDeleting(false); }
  };

  const completedCount = module.lessons.filter(
    l => (l.type === 'VIDEO' && l.muxStatus === 'ready') ||
         (l.type === 'TEXT'  && l.content) ||
         (l.type === 'FILE'  && l.fileKey),
  ).length;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header del módulo */}
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/30">
        <GripVertical size={16} className="text-muted-foreground/40 flex-shrink-0" />
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center gap-2 text-left"
        >
          {expanded
            ? <ChevronDown size={16} className="text-muted-foreground" />
            : <ChevronRight size={16} className="text-muted-foreground" />
          }
          <span className="text-sm font-semibold text-foreground">{module.title}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {completedCount}/{module.lessons.length} con contenido
          </span>
        </button>

        {/* Delete: toggle entre ícono y mini-confirmación */}
        <AnimatePresence mode="wait">
          {deleteConfirm ? (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.12 }}
              className="flex items-center gap-1.5 flex-shrink-0"
            >
              <span className="text-[11px] text-muted-foreground hidden sm:block">¿Eliminar módulo?</span>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="rounded-lg px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted transition-colors"
              >
                No
              </button>
              <button
                onClick={handleDeleteModule}
                disabled={deleting}
                className="flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-[11px] font-semibold text-white bg-destructive hover:bg-destructive/90 disabled:opacity-60 transition-all"
              >
                {deleting && <Loader2 size={10} className="animate-spin" />}
                Eliminar
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="trash"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(true)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all flex-shrink-0"
            >
              <Trash2 size={13} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Lecciones */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-2">
              {module.lessons.map(lesson => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  courseId={courseId}
                  moduleId={module.id}
                  onDelete={id => onLessonDelete(module.id, id)}
                  onEdit={l => onLessonEdit(l, module.id)}
                />
              ))}

              {/* Formulario agregar lección */}
              {addingLesson ? (
                <div className="rounded-xl border border-capta-soft/30 bg-capta-soft/5 p-3 space-y-2">
                  <input
                    autoFocus
                    value={lessonTitle}
                    onChange={e => setLessonTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddLesson(); if (e.key === 'Escape') setAddingLesson(false); }}
                    placeholder="Título de la lección"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capta-soft/40 focus:border-capta-soft"
                  />
                  <div className="flex gap-2 items-center">
                    <select
                      value={lessonType}
                      onChange={e => setLessonType(e.target.value as typeof lessonType)}
                      className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-capta-soft/40"
                    >
                      <option value="TEXT">Texto / Markdown</option>
                      <option value="VIDEO">Video (Mux)</option>
                      <option value="FILE">Archivo descargable</option>
                    </select>
                    <div className="flex gap-2 ml-auto">
                      <button onClick={() => setAddingLesson(false)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">Cancelar</button>
                      <button
                        onClick={handleAddLesson}
                        disabled={!lessonTitle.trim() || saving}
                        className="flex items-center gap-1.5 rounded-lg bg-capta-deep px-3 py-1.5 text-xs font-semibold text-white hover:bg-capta-deep/90 disabled:opacity-50 transition-colors"
                      >
                        {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                        Crear
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingLesson(true)}
                  className="flex w-full items-center gap-2 rounded-xl border-2 border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-capta-soft/50 hover:text-capta-soft transition-all"
                >
                  <Plus size={14} /> Agregar lección
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CourseEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [course,       setCourse]       = useState<Course | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [publishing,     setPublishing]     = useState(false);
  const [archiving,      setArchiving]      = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [deleteConfirm,  setDeleteConfirm]  = useState(false);
  const [deleting,       setDeleting]       = useState(false);
  const [addingModule, setAddingModule] = useState(false);
  const [moduleTitle,  setModuleTitle]  = useState('');
  const [editTitle,    setEditTitle]    = useState('');
  const [editDesc,     setEditDesc]     = useState('');
  const [editingInfo,  setEditingInfo]  = useState(false);

  // Estado del drawer de edición de lección
  const [editingLesson,   setEditingLesson]   = useState<Lesson | null>(null);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<Course>(`/courses/${params.id}`)
      .then(res => {
        setCourse(res.data);
        setEditTitle(res.data.title);
        setEditDesc(res.data.description ?? '');
      })
      .catch(() => router.push('/dashboard/courses'))
      .finally(() => setLoading(false));
  }, [params.id, router]);

  useEffect(() => { load(); }, [load]);

  // ── WebSocket: actualizar estado del video sin recargar página ──────────────
  // Cuando Mux termina de procesar, el admin ve el cambio en tiempo real.
  const handleVideoReady = useCallback(
    ({ lessonId, muxPlaybackId }: { lessonId: string; muxPlaybackId: string }) => {
      const updates = { muxStatus: 'ready', muxPlaybackId };
      // Actualizar árbol de módulos
      setCourse(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          modules: prev.modules.map(m => ({
            ...m,
            lessons: m.lessons.map(l => l.id === lessonId ? { ...l, ...updates } : l),
          })),
        };
      });
      // Si el drawer está abierto para esta lección, actualizar también el estado del drawer
      setEditingLesson(prev => prev?.id === lessonId ? { ...prev, ...updates } : prev);
    },
    [],
  );

  useNotifications({ onVideoReady: handleVideoReady });

  if (loading || !course) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  const saveInfo = async () => {
    setSaving(true);
    try {
      await api.patch(`/courses/${course.id}`, { title: editTitle, description: editDesc });
      setCourse(prev => prev ? { ...prev, title: editTitle, description: editDesc } : prev);
      setEditingInfo(false);
    } finally { setSaving(false); }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const { data } = await api.patch<Course>(`/courses/${course.id}/publish`);
      setCourse(prev => prev ? { ...prev, status: data.status } : prev);
    } finally { setPublishing(false); }
  };

  const handleArchive = async () => {
    setArchiveConfirm(false);
    setArchiving(true);
    try {
      const { data } = await api.patch<Course>(`/courses/${course.id}/archive`);
      setCourse(prev => prev ? { ...prev, status: data.status } : prev);
    } finally { setArchiving(false); }
  };

  const handleUnarchive = async () => {
    setArchiveConfirm(false);
    setArchiving(true);
    try {
      const { data } = await api.patch<Course>(`/courses/${course.id}/unarchive`);
      setCourse(prev => prev ? { ...prev, status: data.status } : prev);
    } finally { setArchiving(false); }
  };

  const handleDeleteCourse = async () => {
    setDeleting(true);
    try {
      await api.delete(`/courses/${course.id}`);
      router.push('/dashboard/courses');
    } catch {
      setDeleteConfirm(false);
    } finally { setDeleting(false); }
  };

  const handleAddModule = async () => {
    if (!moduleTitle.trim()) return;
    const { data } = await api.post<Module>(`/courses/${course.id}/modules`, { title: moduleTitle.trim() });
    setCourse(prev => prev ? { ...prev, modules: [...prev.modules, { ...data, lessons: [] }] } : prev);
    setModuleTitle('');
    setAddingModule(false);
  };

  const handleModuleDelete = (moduleId: string) => {
    setCourse(prev => prev ? { ...prev, modules: prev.modules.filter(m => m.id !== moduleId) } : prev);
  };

  const handleLessonDelete = (moduleId: string, lessonId: string) => {
    setCourse(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        totalLessons: Math.max(0, prev.totalLessons - 1),
        modules: prev.modules.map(m =>
          m.id === moduleId ? { ...m, lessons: m.lessons.filter(l => l.id !== lessonId) } : m,
        ),
      };
    });
  };

  const handleLessonAdd = (moduleId: string, lesson: Lesson) => {
    setCourse(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        totalLessons: prev.totalLessons + 1,
        modules: prev.modules.map(m =>
          m.id === moduleId ? { ...m, lessons: [...m.lessons, lesson] } : m,
        ),
      };
    });
  };

  const handleLessonUpdated = (lessonId: string, moduleId: string, updates: Partial<Lesson>) => {
    setCourse(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        modules: prev.modules.map(m =>
          m.id === moduleId
            ? { ...m, lessons: m.lessons.map(l => l.id === lessonId ? { ...l, ...updates } : l) }
            : m,
        ),
      };
    });
  };

  const STATUS_BADGE = {
    DRAFT:     { label: 'Borrador',  className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
    PUBLISHED: { label: 'Publicado', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' },
    ARCHIVED:  { label: 'Archivado', className: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' },
  };
  const badge = STATUS_BADGE[course.status];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl p-6 lg:p-8 space-y-6">

        {/* ── Breadcrumb + acciones ── */}
        <div className="space-y-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link href="/dashboard/courses" className="flex items-center gap-1 hover:text-foreground">
                <ArrowLeft size={14} /> Cursos
              </Link>
              <span>/</span>
              <span className="text-foreground font-medium truncate max-w-[200px]">{course.title}</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {course.status === 'PUBLISHED' && (
                <Link
                  href={`/dashboard/courses/${course.id}/learn`}
                  className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <Eye size={14} /> Vista previa
                </Link>
              )}
              {course.status === 'DRAFT' && (
                <button
                  onClick={handlePublish}
                  disabled={publishing || course.totalLessons === 0}
                  title={course.totalLessons === 0 ? 'Agrega al menos una lección para publicar' : ''}
                  className="flex items-center gap-1.5 rounded-xl bg-capta-deep px-4 py-2 text-sm font-semibold text-white hover:bg-capta-deep/90 disabled:opacity-50 transition-all"
                >
                  {publishing ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
                  Publicar
                </button>
              )}
              {course.status === 'PUBLISHED' && !archiveConfirm && (
                <button
                  onClick={() => { setArchiveConfirm(true); setDeleteConfirm(false); }}
                  disabled={archiving}
                  className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  {archiving ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                  Archivar
                </button>
              )}
              {course.status === 'ARCHIVED' && !archiveConfirm && (
                <button
                  onClick={() => { setArchiveConfirm(true); setDeleteConfirm(false); }}
                  disabled={archiving}
                  className="flex items-center gap-1.5 rounded-xl border border-amber-300 dark:border-amber-700 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                >
                  {archiving ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Restaurar a Borrador
                </button>
              )}
              {!deleteConfirm && (
                <button
                  onClick={() => { setDeleteConfirm(true); setArchiveConfirm(false); }}
                  className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5 transition-colors"
                >
                  <Trash2 size={14} /> Eliminar
                </button>
              )}
            </div>
          </div>

          {/* ── Confirmación de archivar ── */}
          <AnimatePresence>
            {archiveConfirm && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/10 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                    {course.status === 'PUBLISHED' ? '¿Archivar este curso?' : '¿Restaurar a Borrador?'}
                  </p>
                  <p className="text-xs text-amber-700/70 dark:text-amber-500/70 mt-0.5">
                    {course.status === 'PUBLISHED'
                      ? 'Quedará oculto del catálogo. Las inscripciones y el progreso se conservan.'
                      : 'El curso volverá a estado Borrador y podrás editarlo y volver a publicarlo.'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setArchiveConfirm(false)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={course.status === 'PUBLISHED' ? handleArchive : handleUnarchive}
                    disabled={archiving}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60 transition-all"
                  >
                    {archiving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                    Confirmar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Confirmación de eliminar ── */}
          <AnimatePresence>
            {deleteConfirm && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-destructive">¿Eliminar este curso?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Se eliminará el curso y todo su contenido. Esta acción no se puede deshacer.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDeleteCourse}
                    disabled={deleting}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-destructive hover:bg-destructive/90 disabled:opacity-60 transition-all"
                  >
                    {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    Eliminar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Info del curso ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="rounded-2xl border border-border bg-card shadow-sm p-6"
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              {editingInfo ? (
                <div className="space-y-3">
                  <input
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="w-full rounded-xl border border-capta-soft/40 bg-background px-3 py-2 text-lg font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-capta-soft/40"
                  />
                  <textarea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-capta-soft/40"
                    placeholder="Descripción del curso…"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setEditingInfo(false)} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border">Cancelar</button>
                    <button
                      onClick={saveInfo}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-lg bg-capta-deep px-3 py-1.5 text-xs font-semibold text-white hover:bg-capta-deep/90"
                    >
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-xl font-bold text-foreground">{course.title}</h1>
                  {course.description && (
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{course.description}</p>
                  )}
                </>
              )}
            </div>
            {!editingInfo && (
              <button onClick={() => setEditingInfo(true)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0">
                <Edit3 size={14} />
              </button>
            )}
          </div>

          {/* Métricas */}
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}>
              {badge.label}
            </span>
            <span className="text-sm text-muted-foreground">{course.totalLessons} {course.totalLessons === 1 ? 'lección' : 'lecciones'}</span>
            {course.enrollmentCount !== undefined && course.enrollmentCount > 0 && (
              <span className="text-sm text-muted-foreground">{course.enrollmentCount} inscritos</span>
            )}
            {course.modules.length > 0 && (
              <span className="text-sm text-muted-foreground">{course.modules.length} módulos</span>
            )}
          </div>
        </motion.div>

        {/* ── Estructura del curso ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">Contenido del curso</h2>
            <button
              onClick={() => setAddingModule(true)}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:border-navy/40 hover:text-capta-deep dark:hover:text-capta-soft transition-all"
            >
              <Plus size={14} /> Agregar módulo
            </button>
          </div>

          <div className="space-y-3">
            <AnimatePresence>
              {addingModule && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-2xl border border-capta-soft/30 bg-capta-soft/5 p-4"
                >
                  <input
                    autoFocus
                    value={moduleTitle}
                    onChange={e => setModuleTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddModule(); if (e.key === 'Escape') setAddingModule(false); }}
                    placeholder="Nombre del módulo (Ej: Módulo 1 — Fundamentos)"
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-capta-soft/40 focus:border-capta-soft mb-3"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setAddingModule(false)} className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5">Cancelar</button>
                    <button
                      onClick={handleAddModule}
                      disabled={!moduleTitle.trim()}
                      className="flex items-center gap-1.5 rounded-xl bg-capta-deep px-4 py-1.5 text-sm font-semibold text-white hover:bg-capta-deep/90 disabled:opacity-50"
                    >
                      <Check size={14} /> Crear módulo
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {course.modules.length === 0 && !addingModule ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border py-14 text-center">
                <BookOpen size={32} className="text-muted-foreground/30 mb-3" />
                <p className="font-medium text-foreground mb-1">Sin módulos todavía</p>
                <p className="text-sm text-muted-foreground mb-4">Organiza el contenido en módulos y lecciones.</p>
                <button
                  onClick={() => setAddingModule(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-capta-deep px-4 py-2 text-sm font-semibold text-white hover:bg-capta-deep/90"
                >
                  <Plus size={14} /> Agregar primer módulo
                </button>
              </div>
            ) : (
              course.modules.map(module => (
                <ModuleAccordion
                  key={module.id}
                  module={module}
                  courseId={course.id}
                  onModuleDelete={handleModuleDelete}
                  onModuleUpdate={(id, title) =>
                    setCourse(prev => prev ? {
                      ...prev,
                      modules: prev.modules.map(m => m.id === id ? { ...m, title } : m),
                    } : prev)
                  }
                  onLessonDelete={handleLessonDelete}
                  onLessonAdd={handleLessonAdd}
                  onLessonEdit={(lesson, moduleId) => {
                    setEditingLesson(lesson);
                    setEditingModuleId(moduleId);
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Inscritos ── */}
        {(course.status === 'PUBLISHED' || (course.enrollmentCount ?? 0) > 0) && (
          <EnrolleesSection courseId={course.id} />
        )}

      </div>

      {/* ── Drawer de edición de lección ── */}
      <AnimatePresence>
        {editingLesson && editingModuleId && (
          <LessonContentDrawer
            lesson={editingLesson}
            courseId={course.id}
            moduleId={editingModuleId}
            onClose={() => { setEditingLesson(null); setEditingModuleId(null); }}
            onUpdated={updates => {
              handleLessonUpdated(editingLesson.id, editingModuleId, updates);
              setEditingLesson(prev => prev ? { ...prev, ...updates } : prev);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
