'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/capta-icon';
import { api } from '@/lib/api';
import { LessonRow } from './lesson-row';
import { type Lesson, type Module } from './types';

const GripVertical = (p: { size?: number; className?: string }) => <Icon name="grip-vertical"  size={p.size} className={p.className} />;
const Edit3        = (p: { size?: number; className?: string }) => <Icon name="edit"            size={p.size} className={p.className} />;
const Trash2       = (p: { size?: number; className?: string }) => <Icon name="trash"           size={p.size} className={p.className} />;
const Loader2      = (p: { size?: number; className?: string }) => <Icon name="refresh"         size={p.size} className={p.className} />;
const Check        = (p: { size?: number; className?: string }) => <Icon name="check"           size={p.size} className={p.className} />;
const X            = (p: { size?: number; className?: string }) => <Icon name="close"           size={p.size} className={p.className} />;
const ChevronDown  = (p: { size?: number; className?: string }) => <Icon name="chevron-down"   size={p.size} className={p.className} />;
const ChevronRight = (p: { size?: number; className?: string }) => <Icon name="chevron-right"  size={p.size} className={p.className} />;
const Plus         = (p: { size?: number; className?: string }) => <Icon name="plus"            size={p.size} className={p.className} />;

// Selector de tipo de lección — visual, reemplaza el <select> nativo
const LESSON_TYPES = [
  { value: 'TEXT'  as const, label: 'Texto',   iconName: 'file'   as const, color: '#16a34a' },
  { value: 'VIDEO' as const, label: 'Video',   iconName: 'video'  as const, color: '#1E4F7A' },
  { value: 'FILE'  as const, label: 'Archivo', iconName: 'upload' as const, color: '#f59e0b' },
];

export function ModuleAccordion({
  module,
  index,
  courseId,
  onModuleDelete,
  onModuleUpdate,
  onLessonDelete,
  onLessonAdd,
  onLessonEdit,
}: {
  module: Module;
  index: number;
  courseId: string;
  onModuleDelete: (id: string) => void;
  onModuleUpdate: (id: string, title: string) => void;
  onLessonDelete: (moduleId: string, lessonId: string) => void;
  onLessonAdd: (moduleId: string, lesson: Lesson) => void;
  onLessonEdit: (lesson: Lesson, moduleId: string) => void;
}) {
  const [expanded,      setExpanded]      = useState(true);
  const [addingLesson,  setAddingLesson]  = useState(false);
  const [lessonTitle,   setLessonTitle]   = useState('');
  const [lessonType,    setLessonType]    = useState<'VIDEO' | 'TEXT' | 'FILE'>('TEXT');
  const [saving,        setSaving]        = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [editingTitle,  setEditingTitle]  = useState(false);
  const [titleInput,    setTitleInput]    = useState(module.title);
  const [savingTitle,   setSavingTitle]   = useState(false);

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

  const handleSaveTitle = async () => {
    const trimmed = titleInput.trim();
    if (!trimmed || trimmed === module.title) {
      setEditingTitle(false);
      setTitleInput(module.title);
      return;
    }
    setSavingTitle(true);
    try {
      await api.patch(`/courses/${courseId}/modules/${module.id}`, { title: trimmed });
      onModuleUpdate(module.id, trimmed);
      setEditingTitle(false);
    } catch {
      setTitleInput(module.title);
    } finally { setSavingTitle(false); }
  };

  const completedCount = module.lessons.filter(
    l => (l.type === 'VIDEO' && l.muxStatus === 'ready') ||
         (l.type === 'TEXT'  && l.content) ||
         (l.type === 'FILE'  && l.fileKey),
  ).length;

  const totalCount    = module.lessons.length;
  const progressPct   = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const moduleNumStr  = String(index + 1).padStart(2, '0');

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* ── Header del módulo ── */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: 'rgba(0,0,0,0.02)' }}>
        <GripVertical size={15} className="text-muted-foreground/30 flex-shrink-0 cursor-grab" />

        {/* Número del módulo */}
        <div
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums"
          style={{
            background: 'linear-gradient(135deg, #1E4F7A18, #2D6FA018)',
            color:      '#1E4F7A',
            border:     '1px solid #1E4F7A22',
          }}
        >
          {moduleNumStr}
        </div>

        {/* Título + mini-barra de progreso */}
        <div className="flex-1 min-w-0 flex items-center gap-2 group/module">
          {editingTitle ? (
            <div className="flex flex-1 items-center gap-2">
              <input
                autoFocus
                value={titleInput}
                onChange={e => setTitleInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') { setEditingTitle(false); setTitleInput(module.title); }
                }}
                className="flex-1 rounded-lg border border-capta-soft/40 bg-background px-2.5 py-1 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-capta-soft/40"
              />
              <button
                onClick={handleSaveTitle}
                disabled={savingTitle}
                className="flex h-6 w-6 items-center justify-center rounded-lg bg-capta-deep text-white hover:bg-capta-deep/90 disabled:opacity-50 transition-colors flex-shrink-0"
              >
                {savingTitle ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              </button>
              <button
                onClick={() => { setEditingTitle(false); setTitleInput(module.title); }}
                className="flex h-6 w-6 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              >
                <X size={11} />
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex-1 min-w-0 flex items-center gap-3 text-left"
              >
                <div className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-foreground truncate">{module.title}</span>
                  {totalCount > 0 && (
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1 flex-1 max-w-[80px] rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width:      `${progressPct}%`,
                            background: progressPct === 100
                              ? 'linear-gradient(90deg, #16a34a, #22c55e)'
                              : 'linear-gradient(90deg, #1E4F7A, #8FC4E8)',
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {completedCount}/{totalCount}
                      </span>
                    </div>
                  )}
                </div>
                {expanded
                  ? <ChevronDown  size={15} className="flex-shrink-0 text-muted-foreground/60" />
                  : <ChevronRight size={15} className="flex-shrink-0 text-muted-foreground/60" />
                }
              </button>
              <button
                onClick={e => { e.stopPropagation(); setEditingTitle(true); setTitleInput(module.title); }}
                className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground opacity-0 group-hover/module:opacity-100 hover:text-capta-deep hover:bg-capta-tint/60 dark:hover:text-capta-soft dark:hover:bg-capta-soft/10 transition-all flex-shrink-0"
                title="Renombrar módulo"
              >
                <Edit3 size={11} />
              </button>
            </>
          )}
        </div>

        {/* Eliminar: toggle ícono ↔ mini-confirmación */}
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
              <span className="hidden text-[11px] text-muted-foreground sm:block">¿Eliminar módulo?</span>
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

      {/* ── Lecciones ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-2 p-4">
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

              {/* ── Formulario agregar lección ── */}
              <AnimatePresence mode="wait">
                {addingLesson ? (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="rounded-xl border border-capta-soft/30 bg-capta-soft/5 p-3 space-y-3"
                  >
                    {/* Selector visual de tipo — PRIMERO para definir intención */}
                    <div>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                        ¿Qué tipo de lección?
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {LESSON_TYPES.map(t => {
                          const active = lessonType === t.value;
                          return (
                            <button
                              key={t.value}
                              type="button"
                              onClick={() => setLessonType(t.value)}
                              className="flex flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.97]"
                              style={
                                active
                                  ? { background: t.color, borderColor: t.color, color: '#fff', boxShadow: `0 2px 8px ${t.color}40` }
                                  : { borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'var(--background)' }
                              }
                            >
                              <Icon name={t.iconName} size={16} />
                              {t.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Título — DESPUÉS del tipo, con placeholder contextual */}
                    <input
                      autoFocus
                      value={lessonTitle}
                      onChange={e => setLessonTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddLesson(); if (e.key === 'Escape') setAddingLesson(false); }}
                      placeholder={
                        lessonType === 'VIDEO' ? 'Ej: Introducción al módulo' :
                        lessonType === 'TEXT'  ? 'Ej: Fundamentos teóricos' :
                        'Ej: Material de referencia PDF'
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capta-soft/40 focus:border-capta-soft"
                    />

                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setAddingLesson(false)}
                        className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleAddLesson}
                        disabled={!lessonTitle.trim() || saving}
                        className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50 transition-all hover:opacity-90 active:scale-[0.97]"
                        style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' }}
                      >
                        {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                        Crear lección
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.button
                    key="add-btn"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setAddingLesson(true)}
                    className="flex w-full items-center gap-2 rounded-xl border-2 border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-capta-soft/50 hover:text-capta-soft transition-all"
                  >
                    <Plus size={14} /> Agregar lección
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
