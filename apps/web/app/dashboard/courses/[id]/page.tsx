'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/capta-icon';

// Icon aliases used by CourseEditorPage
const ArrowLeft  = (p: { size?: number; className?: string }) => <Icon name="arrow-left"  size={p.size} className={p.className} />;
const BookOpen   = (p: { size?: number; className?: string }) => <Icon name="book-open"   size={p.size} className={p.className} />;
const Plus       = (p: { size?: number; className?: string }) => <Icon name="plus"        size={p.size} className={p.className} />;
const Trash2     = (p: { size?: number; className?: string }) => <Icon name="trash"       size={p.size} className={p.className} />;
const Edit3      = (p: { size?: number; className?: string }) => <Icon name="edit"        size={p.size} className={p.className} />;
const Globe      = (p: { size?: number; className?: string }) => <Icon name="globe"       size={p.size} className={p.className} />;
const Archive    = (p: { size?: number; className?: string }) => <Icon name="archive"     size={p.size} className={p.className} />;
const Save       = (p: { size?: number; className?: string }) => <Icon name="save"        size={p.size} className={p.className} />;
const Loader2    = (p: { size?: number; className?: string }) => <Icon name="refresh"     size={p.size} className={p.className} />;
const Check      = (p: { size?: number; className?: string }) => <Icon name="check"       size={p.size} className={p.className} />;
const Eye        = (p: { size?: number; className?: string }) => <Icon name="eye"         size={p.size} className={p.className} />;
const RefreshCw  = (p: { size?: number; className?: string }) => <Icon name="refresh"     size={p.size} className={p.className} />;
const Upload     = (p: { size?: number; className?: string }) => <Icon name="upload"      size={p.size} className={p.className} />;

import { api } from '@/lib/api';
import { useToast } from '@/components/toast';
import { type Course, type Lesson, type Module } from '@/components/courses/types';
import { EnrolleesSection } from '@/components/courses/enrollees-section';
import { LessonContentDrawer } from '@/components/courses/lesson-content-drawer';
import { ModuleAccordion } from '@/components/courses/module-accordion';

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CourseEditorPage() {
  const params       = useParams<{ id: string }>();
  const router       = useRouter();
  const searchParams = useSearchParams();

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
  const [editingLesson,    setEditingLesson]    = useState<Lesson | null>(null);
  const [editingModuleId,  setEditingModuleId]  = useState<string | null>(null);
  const [drawerInitialTab, setDrawerInitialTab] = useState<'content' | 'evaluation'>('content');

  // Estado de upload de thumbnail
  const [thumbUploading, setThumbUploading] = useState(false);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api.get<Course>(`/courses/${params.id}`)
      .then(res => {
        setCourse(res.data);
        setEditTitle(res.data.title);
        setEditDesc(res.data.description ?? '');

        // Si la URL incluye ?lesson=...&tab=evaluation (desde notificación de reset)
        // abrir automáticamente el drawer en la pestaña correcta
        const targetLessonId = searchParams.get('lesson');
        const targetTab      = searchParams.get('tab') as 'content' | 'evaluation' | null;
        if (targetLessonId) {
          for (const m of res.data.modules) {
            const found = m.lessons.find(l => l.id === targetLessonId);
            if (found) {
              setEditingLesson(found);
              setEditingModuleId(m.id);
              setDrawerInitialTab(targetTab === 'evaluation' ? 'evaluation' : 'content');
              break;
            }
          }
        }
      })
      .catch(() => router.push('/dashboard/courses'))
      .finally(() => setLoading(false));
  }, [params.id, router, searchParams]);

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

  const { error: toastError } = useToast();

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

  // ── Upload de imagen de portada ───────────────────────────────────────────
  const handleThumbnailUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setThumbUploading(true);
    try {
      const { data: presigned } = await api.post<{
        uploadUrl: string;
        key:       string;
        publicUrl: string;
      }>('/storage/presigned-upload', {
        fileName:    file.name,
        folder:      'thumbnails',
        contentType: file.type,
        isPublic:    true,
      });

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload  = () =>
          xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`));
        xhr.onerror = () => reject(new Error('Error de red'));
        xhr.open('PUT', presigned.uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      await api.patch(`/courses/${course.id}`, {
        thumbnailKey: presigned.key,
        thumbnailUrl: presigned.publicUrl,
      });
      setCourse(prev => prev ? { ...prev, thumbnailUrl: presigned.publicUrl } : prev);
    } catch {
      toastError(
        'No pudimos actualizar la imagen de portada.',
        'Intenta de nuevo.',
      );
    } finally {
      setThumbUploading(false);
    }
  };

  const STATUS_BADGE = {
    DRAFT:     { label: 'Borrador',  className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
    PUBLISHED: { label: 'Publicado', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' },
    ARCHIVED:  { label: 'Archivado', className: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' },
  };
  const badge = STATUS_BADGE[course.status];

  // Completitud del contenido del curso
  const allLessons = course.modules.flatMap(m => m.lessons);
  const lessonsWithContent = allLessons.filter(l =>
    (l.type === 'VIDEO' && l.muxStatus === 'ready') ||
    (l.type === 'TEXT'  && !!l.content) ||
    (l.type === 'FILE'  && !!l.fileKey),
  ).length;
  const completionPct = allLessons.length > 0
    ? Math.round((lessonsWithContent / allLessons.length) * 100) : 0;

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
          className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
          style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
        >
          {/* Input de thumbnail oculto (reutilizado por banner y por botón sin-thumbnail) */}
          <input
            ref={thumbInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleThumbnailUpload(f);
              e.target.value = '';
            }}
          />

          {/* Thumbnail como banner superior */}
          {course.thumbnailUrl && !editingInfo && (
            <div className="relative h-36 w-full overflow-hidden">
              <img
                src={course.thumbnailUrl}
                alt={course.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.55) 100%)' }} />

              {/* Overlay de upload en progreso */}
              {thumbUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="flex flex-col items-center gap-2 text-white">
                    <div
                      className="h-6 w-6 animate-spin rounded-full border-2 border-white/30"
                      style={{ borderTopColor: '#fff' }}
                    />
                    <span className="text-xs font-medium">Subiendo portada…</span>
                  </div>
                </div>
              )}

              {/* Badge de estado */}
              <div className="absolute bottom-3 left-4">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}>
                  {badge.label}
                </span>
              </div>

              {/* Acciones en la esquina superior derecha */}
              <div className="absolute right-3 top-3 flex items-center gap-1.5">
                {/* Cambiar imagen — siempre visible */}
                <button
                  onClick={() => thumbInputRef.current?.click()}
                  disabled={thumbUploading}
                  className="flex items-center gap-1.5 rounded-lg bg-black/55 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-black/75 disabled:opacity-50 transition-all"
                >
                  <Upload size={11} /> Cambiar imagen
                </button>
                {/* Editar info del curso */}
                <button
                  onClick={() => setEditingInfo(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/55 text-white hover:bg-black/75 transition-colors"
                  title="Editar título y descripción"
                >
                  <Edit3 size={14} />
                </button>
              </div>
            </div>
          )}

          <div className="p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                {editingInfo ? (
                  <div className="space-y-3">
                    <input
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      className="w-full rounded-xl border border-capta-soft/40 bg-background px-3 py-2.5 text-lg font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-capta-soft/40"
                    />
                    <textarea
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-capta-soft/40"
                      placeholder="Descripción del curso…"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingInfo(false)}
                        className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={saveInfo}
                        disabled={saving}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-all"
                        style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' }}
                      >
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className="text-xl font-bold tracking-tight text-foreground">{course.title}</h1>
                    {course.description && (
                      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{course.description}</p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Métricas */}
            {!editingInfo && (
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                {/* Badge de estado (si no hay thumbnail) */}
                {!course.thumbnailUrl && (
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}>
                    {badge.label}
                  </span>
                )}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon name="book-open" size={12} />
                  {course.totalLessons} {course.totalLessons === 1 ? 'lección' : 'lecciones'}
                </div>
                {course.modules.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon name="folder" size={12} />
                    {course.modules.length} {course.modules.length === 1 ? 'módulo' : 'módulos'}
                  </div>
                )}
                {course.enrollmentCount !== undefined && course.enrollmentCount > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon name="users" size={12} />
                    {course.enrollmentCount} {course.enrollmentCount === 1 ? 'inscrito' : 'inscritos'}
                  </div>
                )}
                {/* Acciones al final de métricas */}
                <div className="ml-auto flex items-center gap-2">
                  {/* Agregar portada (solo cuando no hay thumbnail) */}
                  {!course.thumbnailUrl && (
                    <button
                      onClick={() => thumbInputRef.current?.click()}
                      disabled={thumbUploading}
                      className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-all"
                    >
                      {thumbUploading
                        ? <Icon name="refresh" size={11} className="animate-spin" />
                        : <Upload size={11} />}
                      {thumbUploading ? 'Subiendo…' : 'Agregar portada'}
                    </button>
                  )}
                  {/* Editar info (siempre) */}
                  <button
                    onClick={() => setEditingInfo(true)}
                    className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Edit3 size={11} /> Editar info
                  </button>
                </div>
              </div>
            )}

            {/* ── Barra de completitud del contenido ── */}
            {!editingInfo && allLessons.length > 0 && (
              <div className="mt-3 border-t border-border pt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground">Contenido listo</span>
                  <span className="text-[11px] font-semibold tabular-nums" style={{
                    color: completionPct === 100 ? '#16a34a' : completionPct >= 50 ? '#1E4F7A' : '#6b7280',
                  }}>
                    {lessonsWithContent}/{allLessons.length} lecciones
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${completionPct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    style={{
                      background: completionPct === 100
                        ? 'linear-gradient(90deg, #16a34a, #22c55e)'
                        : completionPct >= 50
                        ? 'linear-gradient(90deg, #1E4F7A, #2D6FA0)'
                        : 'linear-gradient(90deg, #6b7280, #9ca3af)',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Inscritos ── */}
        {(course.status === 'PUBLISHED' || (course.enrollmentCount ?? 0) > 0) && (
          <EnrolleesSection courseId={course.id} />
        )}

        {/* ── Estructura del curso ── */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Contenido del curso</h2>
              {course.modules.length > 0 && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {course.modules.length} {course.modules.length === 1 ? 'módulo' : 'módulos'} · {course.totalLessons} {course.totalLessons === 1 ? 'lección' : 'lecciones'}
                </p>
              )}
            </div>
            <button
              onClick={() => setAddingModule(true)}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:border-capta-deep/30 hover:text-capta-deep dark:hover:border-capta-soft/30 dark:hover:text-capta-soft transition-all"
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
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Nombre del módulo
                  </p>
                  <input
                    autoFocus
                    value={moduleTitle}
                    onChange={e => setModuleTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddModule(); if (e.key === 'Escape') setAddingModule(false); }}
                    placeholder="Ej: Módulo 1 — Fundamentos básicos"
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-capta-soft/40 focus:border-capta-soft mb-3"
                  />
                  <div className="flex justify-between items-center">
                    <button
                      onClick={() => setAddingModule(false)}
                      className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleAddModule}
                      disabled={!moduleTitle.trim()}
                      className="flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 active:scale-[0.97] transition-all"
                      style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' }}
                    >
                      <Check size={14} /> Crear módulo
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {course.modules.length === 0 && !addingModule ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border py-16 text-center">
                <div
                  className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ background: '#1E4F7A0A', color: '#1E4F7A50' }}
                >
                  <BookOpen size={28} />
                </div>
                <p className="font-semibold text-foreground mb-1">Sin módulos todavía</p>
                <p className="text-sm text-muted-foreground mb-5">Organiza el contenido en módulos y lecciones.</p>
                <button
                  onClick={() => setAddingModule(true)}
                  className="flex items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-semibold text-white hover:opacity-90 active:scale-[0.97] transition-all"
                  style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)', boxShadow: '0 2px 10px rgba(30,79,122,0.2)' }}
                >
                  <Plus size={14} /> Agregar primer módulo
                </button>
              </div>
            ) : (
              course.modules.map((module, idx) => (
                <ModuleAccordion
                  key={module.id}
                  module={module}
                  index={idx}
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
                    setDrawerInitialTab('content');
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
            initialTab={drawerInitialTab}
            onClose={() => { setEditingLesson(null); setEditingModuleId(null); setDrawerInitialTab('content'); }}
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
