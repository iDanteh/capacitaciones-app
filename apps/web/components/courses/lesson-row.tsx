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
}: {
  lesson: Lesson;
  onDelete: (id: string) => void;
  onEdit: (lesson: Lesson) => void;
  courseId: string;
  moduleId: string;
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
    <div className="group relative flex items-center gap-3 rounded-xl border border-border bg-background pl-3 pr-3 py-2.5 hover:border-capta-soft/30 hover:shadow-sm transition-all overflow-hidden">
      {/* Borde izquierdo coloreado por tipo */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
        style={{ background: typeConfig.color }}
      />

      <GripVertical size={14} className="ml-1 text-muted-foreground/40 flex-shrink-0 cursor-grab" />

      {/* Ícono del tipo con fondo sutil */}
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${typeConfig.color}12`, color: typeConfig.color }}
      >
        <Icon name={typeConfig.iconName} size={13} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{lesson.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {/* Tipo */}
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: typeConfig.color }}>
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
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
          <button
            onClick={() => onEdit(lesson)}
            className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-capta-deep hover:border-capta-soft/40 dark:hover:text-capta-soft transition-all"
          >
            <Edit3 size={11} /> Editar
          </button>
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
