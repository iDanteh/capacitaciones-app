'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/capta-icon';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';
import { QuestionForm } from './question-form';
import type { EvaluationAdmin, ResetRequestItem } from './types';

const Shield  = (p: { size?: number; className?: string }) => <Icon name="shield"        size={p.size} className={p.className} />;
const Loader2 = (p: { size?: number; className?: string }) => <Icon name="refresh"       size={p.size} className={p.className} />;
const Edit3   = (p: { size?: number; className?: string }) => <Icon name="edit"          size={p.size} className={p.className} />;
const Save    = (p: { size?: number; className?: string }) => <Icon name="save"          size={p.size} className={p.className} />;
const Trash2  = (p: { size?: number; className?: string }) => <Icon name="trash"         size={p.size} className={p.className} />;
const AlertCircle = (p: { size?: number; className?: string }) => <Icon name="alert-circle" size={p.size} className={p.className} />;
const Check   = (p: { size?: number; className?: string }) => <Icon name="check"         size={p.size} className={p.className} />;
const Plus    = (p: { size?: number; className?: string }) => <Icon name="plus"          size={p.size} className={p.className} />;

export function EvaluationEditorTab({ lessonId, tenantHasEval }: { lessonId: string; tenantHasEval: boolean }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [evaluation,      setEvaluation]      = useState<EvaluationAdmin | null | undefined>(undefined);

  // ── Crear evaluación ──
  const [newTitle,        setNewTitle]        = useState('');
  const [newInstructions, setNewInstructions] = useState('');
  const [minScore,        setMinScore]        = useState(70);
  const [maxAttempts,     setMaxAttempts]     = useState(3);
  const [timeLimitMin,    setTimeLimitMin]    = useState<number | ''>('');
  const [isRequired,      setIsRequired]      = useState(false);
  const [showAnswers,     setShowAnswers]     = useState(true);
  const [creating,        setCreating]        = useState(false);

  // ── Editar configuración de la evaluación ──
  const [editingSettings, setEditingSettings] = useState(false);
  const [editTitle,       setEditTitle]       = useState('');
  const [editInstr,       setEditInstr]       = useState('');
  const [editMinScore,    setEditMinScore]    = useState(70);
  const [editMaxAttempts, setEditMaxAttempts] = useState(3);
  const [editTimeLimitMin,setEditTimeLimitMin]= useState<number | ''>('');
  const [editRequired,    setEditRequired]    = useState(false);
  const [editShowAnswers, setEditShowAnswers] = useState(true);
  const [savingSettings,  setSavingSettings]  = useState(false);

  // ── Preguntas ──
  const [addingQ,         setAddingQ]         = useState(false);
  const [savingQ,         setSavingQ]         = useState(false);
  const [editingQId,      setEditingQId]      = useState<string | null>(null);
  const [savingEditQ,     setSavingEditQ]     = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
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
        showAnswers,
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
    setEditShowAnswers(evaluation.showAnswers ?? true);
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
        showAnswers:  editShowAnswers,
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
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={showAnswers} onChange={e => setShowAnswers(e.target.checked)} className="rounded" />
              <span className="text-sm text-foreground">Mostrar respuestas correctas al reprobar</span>
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
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={editShowAnswers} onChange={e => setEditShowAnswers(e.target.checked)} className="rounded" />
                  <span className="text-sm text-foreground">Mostrar respuestas correctas al reprobar</span>
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
                    {!evaluation.showAnswers && ' · Respuestas ocultas'}
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
