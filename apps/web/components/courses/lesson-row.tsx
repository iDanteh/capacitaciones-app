'use client';

import { useState } from 'react';
import { Icon } from '@/components/capta-icon';
import { api } from '@/lib/api';
import { LESSON_TYPE_CONFIG, formatDuration, formatBytes, type Lesson } from './types';

const GripVertical = (p: { size?: number; className?: string }) => <Icon name="grip-vertical" size={p.size} className={p.className} />;
const Edit3        = (p: { size?: number; className?: string }) => <Icon name="edit"          size={p.size} className={p.className} />;
const Trash2       = (p: { size?: number; className?: string }) => <Icon name="trash"         size={p.size} className={p.className} />;
const Loader2      = (p: { size?: number; className?: string }) => <Icon name="refresh"       size={p.size} className={p.className} />;

export function LessonRow({
  lesson,
  onDelete,
  onEdit,
  courseId,
  moduleId,
  isActive = false,
}: {
  lesson: Lesson;
  onDelete: (id: string) => void;
  onEdit: (lesson: Lesson) => void;
  courseId: string;
  moduleId: string;
  isActive?: boolean;
}) {
  const [deleting,      setDeleting]      = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/courses/${courseId}/modules/${moduleId}/lessons/${lesson.id}`);
      onDelete(lesson.id);
    } catch { setDeleting(false); setDeleteConfirm(false); }
  };

  const hasContent =
    (lesson.type === 'VIDEO' && lesson.muxStatus === 'ready') ||
    (lesson.type === 'TEXT'  && !!lesson.content) ||
    (lesson.type === 'FILE'  && !!lesson.fileKey);

  const isPreparing = lesson.type === 'VIDEO' && lesson.muxStatus === 'preparing';
  const typeConfig  = LESSON_TYPE_CONFIG[lesson.type];

  return (
    <div
      className={`group relative flex items-center gap-[9px] rounded-[9px] border py-[9px] pr-[10px] transition-all overflow-hidden cursor-pointer ${
        isActive
          ? 'border-capta-soft/50 bg-capta-tint/40 dark:bg-capta-soft/10 shadow-sm'
          : 'border-border bg-background hover:border-capta-soft/30 hover:bg-muted/40 hover:shadow-sm'
      }`}
      style={{ paddingLeft: 10 }}
      onClick={() => !deleteConfirm && onEdit(lesson)}
    >
      {/* Borde izquierdo coloreado por tipo */}
      <div
        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full transition-all"
        style={{ background: isActive ? typeConfig.color : `${typeConfig.color}70` }}
      />

      <GripVertical size={13} className="ml-0.5 text-muted-foreground/35 flex-shrink-0 cursor-grab" />

      {/* Ícono del tipo */}
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[8px]"
        style={{ background: `${typeConfig.color}12`, color: typeConfig.color }}
      >
        <Icon name={typeConfig.iconName} size={13} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-semibold text-foreground truncate">{lesson.title}</p>
        <div className="flex items-center gap-2 mt-px">
          <span className="text-[11px] font-semibold capitalize" style={{ color: 'var(--muted-foreground)' }}>
            {typeConfig.label}
          </span>
          {lesson.isPreview && (
            <span className="rounded-full bg-capta-tint px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-capta-deep dark:bg-capta-soft/10 dark:text-capta-soft">
              Preview
            </span>
          )}
          {lesson.duration && (
            <span className="text-[10px] text-muted-foreground">{formatDuration(lesson.duration)}</span>
          )}
          {lesson.type === 'FILE' && lesson.fileSizeBytes && (
            <span className="text-[10px] text-muted-foreground">{formatBytes(lesson.fileSizeBytes)}</span>
          )}
          {isPreparing && (
            <span className="flex items-center gap-1 text-[10px] text-amber-500 font-medium">
              <Loader2 size={9} className="animate-spin" /> Procesando…
            </span>
          )}
          {lesson.type === 'VIDEO' && lesson.muxStatus === 'errored' && (
            <span className="text-[10px] font-medium text-destructive">Error de video</span>
          )}
        </div>
      </div>

      {/* Dot de estado de contenido */}
      {!isPreparing && (
        <div
          className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
          title={hasContent ? 'Con contenido' : 'Sin contenido'}
          style={{ background: hasContent ? '#16a34a' : '#d1d5db' }}
        />
      )}

      {/* Acciones: editar + eliminar */}
      {deleteConfirm ? (
        <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
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
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setDeleteConfirm(true)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
