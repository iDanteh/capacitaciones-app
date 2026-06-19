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
  activeLessonId,
}: {
  module: Module;
  index: number;
  courseId: string;
  onModuleDelete: (id: string) => void;
  onModuleUpdate: (id: string, title: string) => void;
  onLessonDelete: (moduleId: string, lessonId: string) => void;
  onLessonAdd: (moduleId: string, lesson: Lesson) => void;
  onLessonEdit: (lesson: Lesson, moduleId: string) => void;
  activeLessonId?: string | null;
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
      <div className="flex items-center gap-[9px] px-3 py-[11px]" style={{ background: 'rgba(0,0,0,0.02)' }}>
        <GripVertical size={14} className="text-muted-foreground/30 flex-shrink-0 cursor-grab" />

        {/* Número del módulo */}
        <div
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[7px] text-[11px] font-bold tabular-nums"
          style={{
            background: 'color-mix(in srgb, var(--tenant-primary) 10%, transparent)',
            color:      'var(--tenant-primary)',
            border:     '1px solid color-mix(in srgb, var(--tenant-primary) 15%, transparent)',
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
                className="flex-1 rounded-lg border border-capta-soft/40 bg-background px-2.5 py-1.5 text-[14px] font-semibold text-foreground focus:outline-none"
              />
              <button
                onClick={handleSaveTitle}
                disabled={savingTitle}
                className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-capta-deep text-white hover:bg-capta-deep/90 disabled:opacity-50 transition-colors flex-shrink-0"
              >
                {savingTitle ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              </button>
              <button
                onClick={() => { setEditingTitle(false); setTitleInput(module.title); }}
                className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-border text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              >
                <X size={11} />
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex-1 min-w-0 flex items-center gap-2 text-left"
              >
                <div className="flex-1 min-w-0">
                  <span className="block text-[14.5px] font-bold text-foreground truncate">{module.title}</span>
                  {totalCount > 0 && (
                    <div className="mt-0.5 flex items-center gap-2">
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
                      <span className="text-[11.5px] text-muted-foreground/70 font-semibold tabular-nums">
                        {completedCount}/{totalCount}
                      </span>
                    </div>
                  )}
                </div>
                {expanded
                  ? <ChevronDown  size={14} className="flex-shrink-0 text-muted-foreground/50" />
                  : <ChevronRight size={14} className="flex-shrink-0 text-muted-foreground/50" />
                }
              </button>
              <button
                onClick={e => { e.stopPropagation(); setEditingTitle(true); setTitleInput(module.title); }}
                className="flex h-7 w-7 items-center justify-center rounded-[7px] text-muted-foreground opacity-0 group-hover/module:opacity-100 hover:text-capta-deep hover:bg-capta-tint/60 dark:hover:text-capta-soft dark:hover:bg-capta-soft/10 transition-all flex-shrink-0"
                title="Renombrar módulo"
              >
                <Edit3 size={12} />
              </button>
            </>
          )}
        </div>

        {/* Eliminar: oculto mientras se edita el título para evitar solapamiento */}
        {!editingTitle && (
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
                className="flex h-7 w-7 items-center justify-center rounded-[7px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all flex-shrink-0"
              >
                <Trash2 size={13} />
              </motion.button>
            )}
          </AnimatePresence>
        )}
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
            <div className="px-2 pt-1 pb-3 space-y-1.5">
              {module.lessons.map(lesson => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  courseId={courseId}
                  moduleId={module.id}
                  onDelete={id => onLessonDelete(module.id, id)}
                  onEdit={l => onLessonEdit(l, module.id)}
                  isActive={activeLessonId === lesson.id}
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
                    className="rounded-xl border border-capta-soft/40 bg-capta-soft/5 p-3.5 space-y-3"
                    style={{ boxShadow: '0 0 0 3px rgba(143,196,232,0.10)' }}
                  >
                    {/* Selector visual de tipo */}
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                        ¿Qué tipo de lección?
                      </p>
                      <div className="grid grid-cols-3 gap-[7px]">
                        {LESSON_TYPES.map(t => {
                          const active = lessonType === t.value;
                          return (
                            <button
                              key={t.value}
                              type="button"
                              onClick={() => setLessonType(t.value)}
                              className="flex flex-col items-center gap-[5px] rounded-[10px] border py-[11px] text-[12px] font-bold transition-all hover:scale-[1.02] active:scale-[0.97]"
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

                    {/* Título con placeholder contextual */}
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
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm focus:outline-none focus:border-capta-soft"
                    />

                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setAddingLesson(false)}
                        className="text-sm text-muted-foreground hover:text-foreground px-2 py-1 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleAddLesson}
                        disabled={!lessonTitle.trim() || saving}
                        className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-all hover:opacity-90 active:scale-[0.97]"
                        style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)' }}
                      >
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
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
                    className="flex w-full items-center gap-2 rounded-[9px] border border-dashed border-border px-[11px] py-[9px] text-[13.5px] font-semibold text-muted-foreground hover:border-capta-soft/50 hover:text-capta-soft transition-all"
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
