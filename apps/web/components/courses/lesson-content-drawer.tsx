'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/capta-icon';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';
import { EvaluationEditorTab } from './evaluation-editor-tab';
import { TextLessonSplitEditor } from './text-lesson-split-editor';
import { formatDuration, formatBytes, type Lesson } from './types';

const Video     = (p: { size?: number; className?: string }) => <Icon name="video"        size={p.size} className={p.className} />;
const FileText  = (p: { size?: number; className?: string }) => <Icon name="file"         size={p.size} className={p.className} />;
const File      = (p: { size?: number; className?: string }) => <Icon name="file"         size={p.size} className={p.className} />;
const X         = (p: { size?: number; className?: string }) => <Icon name="close"        size={p.size} className={p.className} />;
const Upload    = (p: { size?: number; className?: string }) => <Icon name="upload"       size={p.size} className={p.className} />;
const Loader2   = (p: { size?: number; className?: string }) => <Icon name="refresh"      size={p.size} className={p.className} />;
const Check     = (p: { size?: number; className?: string }) => <Icon name="check"        size={p.size} className={p.className} />;
const AlertCircle = (p: { size?: number; className?: string }) => <Icon name="alert-circle" size={p.size} className={p.className} />;

// ─── Drawer: Editor de contenido de lección ───────────────────────────────────
//
// Patrón: slide-over panel desde la derecha (estándar SaaS: Linear, Notion, Airtable).
// Cada tipo de lección muestra controles específicos para su contenido.

export function LessonContentDrawer({
  lesson,
  courseId,
  moduleId,
  onClose,
  onUpdated,
  tenantHasEval = true,
  initialTab    = 'content',
}: {
  lesson: Lesson;
  courseId: string;
  moduleId: string;
  onClose: () => void;
  onUpdated: (updated: Partial<Lesson>) => void;
  tenantHasEval?: boolean;
  initialTab?: 'content' | 'evaluation';
}) {
  type DrawerTab = 'content' | 'evaluation';
  const [activeTab, setActiveTab] = useState<DrawerTab>(initialTab);

  const { success: toastSuccess, error: toastError } = useToast();

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

          {/* ── TEXT — split editor full-screen ───────────────────────── */}
          {lesson.type === 'TEXT' && (
            loadingContent ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3">
                <div
                  className="h-5 w-5 animate-spin rounded-full border-2 border-transparent"
                  style={{ borderTopColor: '#1E4F7A', borderRightColor: '#8FC4E820' }}
                />
                <p className="text-sm text-muted-foreground">Cargando contenido…</p>
              </div>
            ) : (
              <TextLessonSplitEditor
                lessonId={lesson.id}
                courseId={courseId}
                moduleId={moduleId}
                lessonTitle={lesson.title}
                initialContent={content}
                onSave={newContent => {
                  setContent(newContent);
                  onUpdated({ content: newContent });
                }}
                onClose={onClose}
              />
            )
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
