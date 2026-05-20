'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, BookOpen, Plus, Trash2, Edit3, ChevronDown, ChevronRight,
  Video, FileText, File, Globe, Archive, Save, Loader2, Play, Check,
  GripVertical, X, Upload, AlertCircle, RefreshCw, Eye,
} from 'lucide-react';
import { api } from '@/lib/api';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Lesson {
  id: string;
  title: string;
  type: 'VIDEO' | 'TEXT' | 'FILE';
  order: number;
  isPreview: boolean;
  duration?: number;
  muxStatus?: string;
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
}: {
  lesson: Lesson;
  courseId: string;
  moduleId: string;
  onClose: () => void;
  onUpdated: (updated: Partial<Lesson>) => void;
}) {
  // ── Estado compartido ──
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState(false);

  // ── Estado VIDEO ──
  const [videoFile,     setVideoFile]     = useState<File | null>(null);
  const [uploadProgress,setUploadProgress]= useState(0);
  const [uploading,     setUploading]     = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // ── Estado TEXT ──
  const [content, setContent] = useState(lesson.content ?? '');

  // ── Estado FILE ──
  const [docFile,     setDocFile]     = useState<File | null>(null);
  const [docProgress, setDocProgress] = useState(0);
  const [docUploading,setDocUploading]= useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);

  const showSuccess = () => {
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2500);
  };

  // ── Handler VIDEO ─────────────────────────────────────────────────────────

  const handleVideoUpload = async (file: File) => {
    setError(null);
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
      showSuccess();
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Error al subir el video. Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  // ── Handler TEXT ──────────────────────────────────────────────────────────

  const handleTextSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/courses/${courseId}/modules/${moduleId}/lessons/${lesson.id}`, { content });
      onUpdated({ content });
      showSuccess();
    } catch {
      setError('No se pudo guardar el contenido.');
    } finally {
      setSaving(false);
    }
  };

  // ── Handler FILE ──────────────────────────────────────────────────────────

  const handleFileUpload = async (file: File) => {
    setError(null);
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
      showSuccess();
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Error al subir el archivo. Intenta de nuevo.');
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
            {lesson.type === 'VIDEO' && <Video size={16} className="text-sky" />}
            {lesson.type === 'TEXT'  && <FileText size={16} className="text-teal" />}
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

        {/* Contenido del drawer */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Feedback de error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3"
              >
                <AlertCircle size={15} className="text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Feedback de éxito */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-center gap-2 rounded-xl border border-teal/20 bg-teal/5 px-4 py-3"
              >
                <Check size={15} className="text-teal" />
                <p className="text-sm font-medium text-teal">Guardado correctamente.</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── VIDEO ─────────────────────────────────────────────────────── */}
          {lesson.type === 'VIDEO' && (
            <div className="space-y-4">
              {/* Estado actual del video */}
              {lesson.muxStatus && (
                <div className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 ${
                  lesson.muxStatus === 'ready'
                    ? 'border-teal/20 bg-teal/5'
                    : lesson.muxStatus === 'errored'
                    ? 'border-destructive/20 bg-destructive/5'
                    : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
                }`}>
                  {lesson.muxStatus === 'ready' && <Check size={15} className="text-teal flex-shrink-0" />}
                  {lesson.muxStatus === 'errored' && <AlertCircle size={15} className="text-destructive flex-shrink-0" />}
                  {lesson.muxStatus === 'preparing' && <Loader2 size={15} className="text-amber-600 animate-spin flex-shrink-0" />}
                  <div>
                    <p className={`text-sm font-medium ${
                      lesson.muxStatus === 'ready' ? 'text-teal' : lesson.muxStatus === 'errored' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'
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
                  <div className="rounded-2xl border border-sky/30 bg-sky/5 p-5 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{videoFile?.name}</span>
                      <span className="text-sky font-semibold">{uploadProgress}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-sky"
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
                    className="flex flex-col items-center justify-center w-full rounded-2xl border-2 border-dashed border-border bg-muted/20 py-10 px-6 text-center hover:border-sky/50 hover:bg-sky/5 transition-all cursor-pointer"
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
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={18}
                placeholder={`# Título de la lección\n\nEscribe el contenido aquí...\n\n## Subtítulo\n\nPuedes usar **negrita**, *cursiva*, \`código\`, listas, etc.`}
                className="w-full resize-y rounded-xl border border-border bg-background px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-sky/40 focus:border-sky transition-all leading-relaxed"
              />
              <button
                onClick={handleTextSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-50 transition-all active:scale-[0.97]"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Guardar contenido
              </button>
            </div>
          )}

          {/* ── FILE ──────────────────────────────────────────────────────── */}
          {lesson.type === 'FILE' && (
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
                  <span className="flex-shrink-0 rounded-full bg-teal/10 px-2 py-0.5 text-xs font-semibold text-teal">
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
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar la lección "${lesson.title}"?`)) return;
    setDeleting(true);
    try {
      await api.delete(`/courses/${courseId}/modules/${moduleId}/lessons/${lesson.id}`);
      onDelete(lesson.id);
    } catch { setDeleting(false); }
  };

  // Indicador de si tiene contenido cargado
  const hasContent =
    (lesson.type === 'VIDEO' && lesson.muxStatus === 'ready') ||
    (lesson.type === 'TEXT'  && !!lesson.content) ||
    (lesson.type === 'FILE'  && !!lesson.fileKey);

  const isPreparing = lesson.type === 'VIDEO' && lesson.muxStatus === 'preparing';

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 hover:border-sky/30 transition-all">
      <GripVertical size={14} className="text-muted-foreground/40 flex-shrink-0 cursor-grab" />
      <Icon size={15} className="text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{lesson.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {lesson.isPreview && (
            <span className="text-[10px] font-semibold text-sky uppercase tracking-wide">Preview</span>
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

      {/* Botón editar contenido */}
      <button
        onClick={() => onEdit(lesson)}
        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-navy hover:border-navy/40 dark:hover:text-sky transition-all"
      >
        <Edit3 size={11} /> Editar
      </button>

      <button
        onClick={handleDelete}
        disabled={deleting}
        className="opacity-0 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
      >
        {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
      </button>
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
  const [expanded,     setExpanded]     = useState(true);
  const [addingLesson, setAddingLesson] = useState(false);
  const [lessonTitle,  setLessonTitle]  = useState('');
  const [lessonType,   setLessonType]   = useState<'VIDEO' | 'TEXT' | 'FILE'>('TEXT');
  const [saving,       setSaving]       = useState(false);
  const [deleting,     setDeleting]     = useState(false);

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
    if (!confirm(`¿Eliminar el módulo "${module.title}" y todas sus lecciones?`)) return;
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
        <button
          onClick={handleDeleteModule}
          disabled={deleting}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
        >
          {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>
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
                <div className="rounded-xl border border-sky/30 bg-sky/5 p-3 space-y-2">
                  <input
                    autoFocus
                    value={lessonTitle}
                    onChange={e => setLessonTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddLesson(); if (e.key === 'Escape') setAddingLesson(false); }}
                    placeholder="Título de la lección"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky/40 focus:border-sky"
                  />
                  <div className="flex gap-2 items-center">
                    <select
                      value={lessonType}
                      onChange={e => setLessonType(e.target.value as typeof lessonType)}
                      className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky/40"
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
                        className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy/90 disabled:opacity-50 transition-colors"
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
                  className="flex w-full items-center gap-2 rounded-xl border-2 border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-sky/50 hover:text-sky transition-all"
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
  const [saving,       setSaving]       = useState(false);
  const [publishing,   setPublishing]   = useState(false);
  const [archiving,    setArchiving]    = useState(false);
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
    if (!confirm('¿Archivar este curso? Quedará oculto del catálogo pero se conservan las inscripciones y el progreso.')) return;
    setArchiving(true);
    try {
      const { data } = await api.patch<Course>(`/courses/${course.id}/archive`);
      setCourse(prev => prev ? { ...prev, status: data.status } : prev);
    } finally { setArchiving(false); }
  };

  const handleUnarchive = async () => {
    if (!confirm('¿Restaurar este curso a Borrador? Podrás editarlo y volver a publicarlo.')) return;
    setArchiving(true);
    try {
      const { data } = await api.patch<Course>(`/courses/${course.id}/unarchive`);
      setCourse(prev => prev ? { ...prev, status: data.status } : prev);
    } finally { setArchiving(false); }
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
    PUBLISHED: { label: 'Publicado', className: 'bg-teal/10 text-teal dark:text-teal-400' },
    ARCHIVED:  { label: 'Archivado', className: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' },
  };
  const badge = STATUS_BADGE[course.status];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl p-6 lg:p-8 space-y-6">

        {/* ── Breadcrumb + acciones ── */}
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
                className="flex items-center gap-1.5 rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal/90 disabled:opacity-50 transition-all"
              >
                {publishing ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
                Publicar
              </button>
            )}
            {course.status === 'PUBLISHED' && (
              <button
                onClick={handleArchive}
                disabled={archiving}
                className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {archiving ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                Archivar
              </button>
            )}
            {course.status === 'ARCHIVED' && (
              <button
                onClick={handleUnarchive}
                disabled={archiving}
                className="flex items-center gap-1.5 rounded-xl border border-amber-300 dark:border-amber-700 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
              >
                {archiving ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Restaurar a Borrador
              </button>
            )}
          </div>
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
                    className="w-full rounded-xl border border-sky/40 bg-background px-3 py-2 text-lg font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-sky/40"
                  />
                  <textarea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-sky/40"
                    placeholder="Descripción del curso…"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setEditingInfo(false)} className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border">Cancelar</button>
                    <button
                      onClick={saveInfo}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy/90"
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
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:border-navy/40 hover:text-navy dark:hover:text-sky transition-all"
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
                  className="rounded-2xl border border-sky/30 bg-sky/5 p-4"
                >
                  <input
                    autoFocus
                    value={moduleTitle}
                    onChange={e => setModuleTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddModule(); if (e.key === 'Escape') setAddingModule(false); }}
                    placeholder="Nombre del módulo (Ej: Módulo 1 — Fundamentos)"
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky/40 focus:border-sky mb-3"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setAddingModule(false)} className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5">Cancelar</button>
                    <button
                      onClick={handleAddModule}
                      disabled={!moduleTitle.trim()}
                      className="flex items-center gap-1.5 rounded-xl bg-navy px-4 py-1.5 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-50"
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
                  className="flex items-center gap-1.5 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90"
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
