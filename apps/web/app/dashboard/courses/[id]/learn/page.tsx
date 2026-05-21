'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/capta-icon';

// Icon aliases for inline usage
const ArrowLeft    = (p: { size?: number; className?: string }) => <Icon name="arrow-left"    size={p.size} className={p.className} />;
const BookOpen     = (p: { size?: number; className?: string }) => <Icon name="book-open"     size={p.size} className={p.className} />;
const CheckCircle2 = (p: { size?: number; className?: string }) => <Icon name="check-circle" size={p.size} className={p.className} />;
const Circle       = (p: { size?: number; className?: string }) => <Icon name="circle"        size={p.size} className={p.className} />;
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
import { api } from '@/lib/api';

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LESSON_ICON = {
  VIDEO: Video,
  TEXT:  FileText,
  FILE:  File,
};

function formatDuration(s?: number): string {
  if (!s) return '';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ─── Componente: árbol de navegación ─────────────────────────────────────────

function LessonTree({
  course,
  enrollment,
  currentLessonId,
  onSelectLesson,
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
                  const Icon      = LESSON_ICON[lesson.type];
                  const completed = completedIds.has(lesson.id);
                  const active    = lesson.id === currentLessonId;

                  return (
                    <button
                      key={lesson.id}
                      onClick={() => onSelectLesson(lesson)}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all ${
                        active
                          ? 'bg-capta-deep/8 text-capta-deep dark:bg-capta-soft/[0.12] dark:text-capta-soft'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {completed
                        ? <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        : <Circle size={14} className="flex-shrink-0 opacity-40" />
                      }
                      <Icon size={13} className="flex-shrink-0 opacity-70" />
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

// ─── Componente: visor de lección ────────────────────────────────────────────

function LessonViewer({
  lesson,
  enrollment,
  onComplete,
  nextLesson,
  onNextLesson,
}: {
  lesson: Lesson;
  enrollment: Enrollment | null;
  onComplete: () => void;
  nextLesson: Lesson | null;
  onNextLesson: (lesson: Lesson) => void;
}) {
  const [completing, setCompleting]   = useState(false);
  const [loadingContent, setLoading]  = useState(false);
  const [fullLesson, setFullLesson]   = useState<Lesson | null>(null);

  // Presigned URL para FILE — se obtiene al seleccionar la lección (no se persiste
  // en el frontend; caduca en 1h, suficiente para la sesión de visualización).
  const [fileSignedUrl, setFileSignedUrl] = useState<string | null>(null);
  const [loadingFile, setLoadingFile]     = useState(false);

  useEffect(() => {
    if (lesson.type !== 'FILE' || !lesson.fileKey) {
      setFileSignedUrl(null);
      return;
    }
    setLoadingFile(true);
    api.get<{ downloadUrl: string }>(`/storage/presigned-download/${lesson.fileKey}`)
      .then(res => setFileSignedUrl(res.data.downloadUrl))
      .catch(() => setFileSignedUrl(null))
      .finally(() => setLoadingFile(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id, lesson.fileKey]);

  const isCompleted = enrollment?.lessonProgress.some(
    p => p.lessonId === lesson.id && p.completedAt,
  );

  useEffect(() => {
    if (lesson.type === 'TEXT') {
      setLoading(true);
      const pathParts = window.location.pathname.split('/');
      const courseId  = pathParts[pathParts.indexOf('courses') + 1];

      api.get<Lesson>(`/courses/${courseId}/modules/${lesson.moduleId}/lessons/${lesson.id}`)
        .then(res => setFullLesson(res.data))
        .catch(() => setFullLesson(lesson))
        .finally(() => setLoading(false));
    } else {
      setFullLesson(lesson);
    }
  }, [lesson]);

  const handleComplete = async () => {
    if (!enrollment || isCompleted) return;
    setCompleting(true);
    try {
      await api.post(`/enrollments/${enrollment.id}/lessons/${lesson.id}/complete`);
      onComplete();
    } finally { setCompleting(false); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {lesson.type === 'VIDEO' && <Video size={13} />}
            {lesson.type === 'TEXT'  && <FileText size={13} />}
            {lesson.type === 'FILE'  && <File size={13} />}
            {lesson.type}
          </div>
        </div>
        <h2 className="mt-1 text-xl font-bold text-foreground">{lesson.title}</h2>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* VIDEO */}
        {lesson.type === 'VIDEO' && (
          <div className="space-y-4">
            {lesson.muxPlaybackId && lesson.muxStatus === 'ready' ? (
              <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-lg">
                {/*
                  Mux Player embed — player.mux.com soporta HLS adaptativo,
                  captions y subtítulos, calidad automática y controles nativos.
                  En producción considera @mux/mux-player-react para mayor control
                  (capítulos, events de progreso, resume desde watchedSeconds).
                */}
                <iframe
                  src={`https://player.mux.com/${lesson.muxPlaybackId}`}
                  className="w-full h-full"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="aspect-video w-full rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center bg-muted/30">
                {lesson.muxStatus === 'preparing' ? (
                  <>
                    <Loader2 size={28} className="text-muted-foreground animate-spin mb-2" />
                    <p className="text-sm text-muted-foreground">Video procesándose...</p>
                  </>
                ) : lesson.muxStatus === 'errored' ? (
                  <>
                    <Video size={28} className="text-destructive/40 mb-2" />
                    <p className="text-sm text-muted-foreground">Error al procesar el video.</p>
                  </>
                ) : (
                  <>
                    <Video size={28} className="text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">Video no disponible.</p>
                  </>
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
                {[...Array(5)].map((_, i) => <div key={i} className="h-4 bg-muted rounded w-full" style={{ width: `${70 + i * 5}%` }} />)}
              </div>
            ) : fullLesson?.content ? (
              <div className="space-y-4 text-sm text-foreground leading-relaxed">
                {fullLesson.content.split('\n').map((line, i) => {
                  if (line.startsWith('# '))  return <h1 key={i} className="text-2xl font-bold mt-6 mb-3">{line.slice(2)}</h1>;
                  if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-semibold mt-5 mb-2">{line.slice(3)}</h2>;
                  if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-semibold mt-4 mb-1">{line.slice(4)}</h3>;
                  if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc">{line.slice(2)}</li>;
                  if (line.trim() === '') return <br key={i} />;
                  return <p key={i}>{line}</p>;
                })}
              </div>
            ) : (
              <p className="text-muted-foreground italic">Esta lección no tiene contenido.</p>
            )}
          </div>
        )}

        {/* FILE — renderiza según MIME type para máxima usabilidad inline */}
        {lesson.type === 'FILE' && (
          <div className="h-full">
            {loadingFile ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 size={28} className="animate-spin text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Cargando archivo…</p>
              </div>
            ) : fileSignedUrl && lesson.fileMimeType?.startsWith('image/') ? (
              /* Imagen: renderizar inline */
              <div className="flex flex-col items-center gap-4">
                <img
                  src={fileSignedUrl}
                  alt={lesson.fileName ?? 'Imagen'}
                  className="max-w-full rounded-2xl border border-border shadow-sm"
                />
                <a
                  href={fileSignedUrl}
                  download={lesson.fileName}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Download size={14} /> Descargar imagen
                </a>
              </div>
            ) : fileSignedUrl && lesson.fileMimeType === 'application/pdf' ? (
              /* PDF: iframe inline (soportado en todos los browsers modernos) */
              <div className="flex flex-col h-full gap-3">
                <iframe
                  src={fileSignedUrl}
                  title={lesson.fileName ?? 'PDF'}
                  className="w-full flex-1 rounded-2xl border border-border"
                  style={{ minHeight: '65vh' }}
                />
                <div className="flex justify-end">
                  <a
                    href={fileSignedUrl}
                    download={lesson.fileName}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Download size={14} /> Descargar PDF
                  </a>
                </div>
              </div>
            ) : (
              /* Otros formatos: botón de descarga estándar */
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
                {fileSignedUrl ? (
                  <a
                    href={fileSignedUrl}
                    download={lesson.fileName}
                    className="flex items-center gap-2 rounded-xl bg-capta-deep px-5 py-2.5 text-sm font-semibold text-white hover:bg-capta-deep/90 transition-colors"
                  >
                    <Download size={15} /> Descargar archivo
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Archivo no disponible.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer: acción completar */}
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
              disabled={completing}
              className="flex items-center gap-2 rounded-xl bg-capta-deep px-5 py-2.5 text-sm font-semibold text-white hover:bg-capta-deep/90 disabled:opacity-60 transition-all active:scale-[0.97]"
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

  const [course,          setCourse]          = useState<Course | null>(null);
  const [enrollment,      setEnrollment]      = useState<Enrollment | null>(null);
  const [currentLesson,   setCurrentLesson]   = useState<Lesson | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [enrolling,       setEnrolling]       = useState(false);
  const [sidebarOpen,     setSidebarOpen]     = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: courseData } = await api.get<Course>(`/courses/${params.id}`);
      setCourse(courseData);

      // Buscar inscripción activa — el DTO devuelve courseId y lessonProgress[]
      const { data: enrollments } = await api.get<Enrollment[]>('/enrollments/my');
      const myEnrollment = enrollments.find(e => e.courseId === params.id);
      if (myEnrollment) setEnrollment({ ...myEnrollment, lessonProgress: myEnrollment.lessonProgress ?? [] });

      // Seleccionar primera lección disponible
      const firstLesson = courseData.modules[0]?.lessons[0];
      if (firstLesson) setCurrentLesson(firstLesson);
    } catch {
      router.push('/dashboard/courses');
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => { load(); }, [load]);

  const handleEnroll = async () => {
    if (!course) return;
    setEnrolling(true);
    try {
      const { data } = await api.post<Enrollment>('/enrollments', { courseId: course.id });
      setEnrollment(data);
    } finally { setEnrolling(false); }
  };

  const handleLessonComplete = async () => {
    if (!enrollment || !currentLesson) return;
    // Actualizar progreso localmente
    setEnrollment(prev => {
      if (!prev) return prev;
      const already = prev.lessonProgress.some(p => p.lessonId === currentLesson.id);
      return {
        ...prev,
        lessonProgress: already
          ? prev.lessonProgress.map(p =>
              p.lessonId === currentLesson.id ? { ...p, completedAt: new Date().toISOString() } : p,
            )
          : [...prev.lessonProgress, { lessonId: currentLesson.id, completedAt: new Date().toISOString() }],
        progress: Math.min(100, Math.round(((prev.lessonProgress.filter(p => p.completedAt).length + 1) / (course?.totalLessons ?? 1)) * 100)),
      };
    });
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

  // Calcular la siguiente lección en orden de módulo/lección
  const allLessons = course.modules.flatMap(m => m.lessons);
  const currentIdx = currentLesson ? allLessons.findIndex(l => l.id === currentLesson.id) : -1;
  const nextLesson = currentIdx >= 0 && currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Sidebar mobile backdrop ── */}
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

      {/* ── Sidebar ── */}
      <motion.aside
        initial={false}
        animate={{ x: sidebarOpen ? 0 : undefined }}
        className={`
          fixed lg:relative z-50 lg:z-auto inset-y-0 left-0
          w-72 flex-shrink-0 flex flex-col border-r border-border bg-card
          ${sidebarOpen ? 'flex' : 'hidden lg:flex'}
        `}
      >
        {/* Sidebar header */}
        <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border px-4">
          <Link href="/dashboard/courses" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} /> Cursos
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        {/* Curso info */}
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 mb-2">{course.title}</h2>

          {/* Barra de progreso */}
          {enrollment && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{completedCount}/{course.totalLessons} lecciones</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{progress}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-emerald-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
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

        {/* Completado */}
        {isCompleted && (
          <div className="flex-shrink-0 border-t border-border p-4">
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2">
              <Award size={16} className="text-emerald-600 dark:text-emerald-400" />
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">¡Curso completado!</p>
            </div>
          </div>
        )}
      </motion.aside>

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Mobile header */}
        <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground hover:text-foreground">
            <Menu size={20} />
          </button>
          <h1 className="text-sm font-semibold text-foreground truncate max-w-[180px]">{course.title}</h1>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">{progress}%</span>
        </div>

        {/* Contenido de lección o estado sin inscripción */}
        <div className="flex-1 overflow-hidden">
          {!enrollment ? (
            // Estado: sin inscripción
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky/20 to-navy/20 mb-4">
                <BookOpen size={28} className="text-capta-deep dark:text-capta-soft" />
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
                className="flex items-center gap-2 rounded-xl bg-capta-deep px-6 py-3 text-sm font-semibold text-white hover:bg-capta-deep/90 disabled:opacity-60 transition-all active:scale-[0.97]"
              >
                {enrolling ? <Loader2 size={16} className="animate-spin" /> : null}
                Inscribirme en este curso
              </button>
            </div>
          ) : currentLesson ? (
            <LessonViewer
              lesson={currentLesson}
              enrollment={enrollment}
              onComplete={handleLessonComplete}
              nextLesson={nextLesson}
              onNextLesson={lesson => setCurrentLesson(lesson)}
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
