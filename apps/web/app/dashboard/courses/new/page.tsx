'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/capta-icon';
import { useToast } from '@/components/toast';
import { api } from '@/lib/api';

// Icon aliases
const ArrowLeft   = (p: { size?: number; className?: string }) => <Icon name="arrow-left"   size={p.size} className={p.className} />;
const Upload      = (p: { size?: number; className?: string }) => <Icon name="upload"       size={p.size} className={p.className} />;
const X           = (p: { size?: number; className?: string }) => <Icon name="close"        size={p.size} className={p.className} />;
const Loader2     = (p: { size?: number; className?: string }) => <Icon name="refresh"      size={p.size} className={p.className} />;
const Check       = (p: { size?: number; className?: string }) => <Icon name="check"        size={p.size} className={p.className} />;
const AlertCircle = (p: { size?: number; className?: string }) => <Icon name="alert-circle" size={p.size} className={p.className} />;

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  title:       z.string().min(3, 'Mínimo 3 caracteres').max(150),
  description: z.string().max(2000).optional(),
  status:      z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
});

type FormData = z.infer<typeof schema>;

// ─── Componente ───────────────────────────────────────────────────────────────

export default function NewCoursePage() {
  const router = useRouter();
  const { error: toastError } = useToast();
  const [thumbnail,        setThumbnail]        = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [uploadingThumb,   setUploadingThumb]   = useState(false);
  const [serverError,      setServerError]      = useState<string | null>(null);
  const [dragOver,         setDragOver]         = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'DRAFT' },
  });

  // ── Thumbnail ──────────────────────────────────────────────────────────────

  const handleThumbnailFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setThumbnail(file);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  const removeThumbnail = () => {
    setThumbnail(null);
    setThumbnailPreview(null);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      let thumbnailKey: string | undefined;
      let thumbnailUrl: string | undefined;

      if (thumbnail) {
        setUploadingThumb(true);
        const { data: presigned } = await api.post<{
          uploadUrl: string;
          key: string;
          publicUrl: string;
        }>('/storage/presigned-upload', {
          fileName:    thumbnail.name,
          folder:      'thumbnails',
          contentType: thumbnail.type,
          isPublic:    true,
        });
        await fetch(presigned.uploadUrl, {
          method:  'PUT',
          body:    thumbnail,
          headers: { 'Content-Type': thumbnail.type },
        });
        thumbnailKey = presigned.key;
        thumbnailUrl = presigned.publicUrl;
        setUploadingThumb(false);
      }

      const { data: course } = await api.post<{ id: string }>('/courses', {
        ...data,
        thumbnailKey,
        thumbnailUrl,
      });

      router.push(`/dashboard/courses/${course.id}`);
    } catch (err: unknown) {
      setUploadingThumb(false);
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setServerError(msg ?? 'Ocurrió un error al crear el curso.');
      toastError(msg ?? 'No pudimos crear el curso. Verifica tu conexión e intenta de nuevo.');
    }
  };

  const isLoading   = isSubmitting || uploadingThumb;
  const statusValue = watch('status');
  const titleValue  = watch('title');

  return (
    <div className="min-h-screen bg-background">
      {/* ── Barra de navegación superior ── */}
      <div className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl">
        <Link
          href="/dashboard/courses"
          className="group flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
          Cursos
        </Link>
        <span className="text-border/60">›</span>
        <span className="text-sm font-medium text-foreground/70">Nuevo curso</span>

        {/* Título preview en la barra */}
        <AnimatePresence>
          {titleValue && titleValue.length > 2 && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="ml-1 max-w-[240px] truncate text-sm text-muted-foreground/60"
            >
              · {titleValue}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── Layout principal ── */}
      <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_420px]">

          {/* ════ COLUMNA IZQUIERDA — Thumbnail + contexto ════ */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.05 }}
            className="flex flex-col gap-6"
          >
            {/* Portada del curso */}
            <div>
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                Portada del curso
              </p>

              {thumbnailPreview ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="group relative w-full overflow-hidden rounded-2xl border border-border shadow-sm"
                  style={{ aspectRatio: '16/9' }}
                >
                  <img src={thumbnailPreview} alt="Vista previa" className="h-full w-full object-cover" />
                  {/* Overlay sutil */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  {/* Nombre archivo */}
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute bottom-0 left-0 right-0 px-4 py-3 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <p className="truncate text-[11px] font-medium text-white drop-shadow">
                      {thumbnail?.name}
                    </p>
                  </motion.div>
                  {/* Botón cambiar imagen */}
                  <div className="absolute right-3 top-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-black/60 px-3 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/75">
                      <Upload size={12} /> Cambiar
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleThumbnailFile(f); }} />
                    </label>
                    <button
                      type="button"
                      onClick={removeThumbnail}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <label
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setDragOver(false);
                    const f = e.dataTransfer.files[0];
                    if (f) handleThumbnailFile(f);
                  }}
                  className={`group relative flex w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 ${
                    dragOver
                      ? 'border-capta-soft bg-capta-soft/8 scale-[1.01]'
                      : 'border-border/60 bg-muted/10 hover:border-capta-soft/50 hover:bg-muted/20'
                  }`}
                  style={{ aspectRatio: '16/9' }}
                >
                  {/* Fondo sutil con grid */}
                  <div
                    className="pointer-events-none absolute inset-0 opacity-[0.03]"
                    style={{
                      backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
                      backgroundSize: '32px 32px',
                    }}
                  />

                  <motion.div
                    animate={dragOver ? { scale: 1.1 } : { scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{
                      background: dragOver
                        ? 'color-mix(in srgb, #8FC4E8 15%, transparent)'
                        : 'color-mix(in srgb, var(--tenant-primary) 10%, transparent)',
                      color: dragOver ? '#8FC4E8' : 'var(--tenant-primary)',
                    }}
                  >
                    <Upload size={24} />
                  </motion.div>

                  <p className="text-sm font-semibold text-foreground">
                    {dragOver ? 'Suelta para subir' : 'Arrastra tu portada aquí'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PNG o JPG · Recomendado 1280 × 720 px · Máx. 5 MB
                  </p>

                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-px w-12 bg-border/60" />
                    <span className="text-xs text-muted-foreground/60">o</span>
                    <div className="h-px w-12 bg-border/60" />
                  </div>

                  <div
                    className="mt-4 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-all group-hover:opacity-90"
                    style={{ background: 'var(--tenant-primary)' }}
                  >
                    Seleccionar archivo
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleThumbnailFile(f); }}
                  />
                </label>
              )}
            </div>

            {/* Tips card */}
            <div
              className="rounded-xl border border-border/50 p-4"
              style={{ background: 'color-mix(in srgb, var(--tenant-primary) 4%, var(--background))' }}
            >
              <p className="mb-2 text-xs font-semibold text-foreground/70">Consejos para una buena portada</p>
              <ul className="space-y-1.5">
                {[
                  'Usa imágenes horizontales (relación 16:9)',
                  'Texto legible con contraste alto',
                  'Evita bordes y elementos recortados',
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span
                      className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{ background: 'color-mix(in srgb, var(--tenant-primary) 70%, white)' }}
                    >
                      {i + 1}
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

          {/* ════ COLUMNA DERECHA — Formulario ════ */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.1 }}
          >
            {/* Header del formulario */}
            <div className="mb-6">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                Crear nuevo curso
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Configura los datos esenciales. Podrás editar el contenido después.
              </p>
            </div>

            {/* Error de servidor */}
            <AnimatePresence>
              {serverError && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3"
                >
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-destructive" />
                  <p className="text-sm text-destructive">{serverError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

              {/* ── Título ── */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-foreground">
                  Título <span className="text-destructive">*</span>
                </label>
                <input
                  {...register('title')}
                  placeholder="Ej: Introducción a Excel para ventas"
                  className={`w-full rounded-xl border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all ${
                    errors.title
                      ? 'border-destructive/60 bg-destructive/5 focus:ring-destructive/20'
                      : 'border-border hover:border-capta-deep/30 focus:border-capta-soft focus:ring-capta-soft/20 dark:hover:border-capta-soft/30'
                  }`}
                />
                <AnimatePresence>
                  {errors.title && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="flex items-center gap-1 text-xs text-destructive"
                    >
                      <AlertCircle size={11} /> {errors.title.message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Descripción ── */}
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <label className="block text-sm font-semibold text-foreground">Descripción</label>
                  <span className="text-xs text-muted-foreground/60">Opcional</span>
                </div>
                <textarea
                  {...register('description')}
                  rows={4}
                  placeholder="¿Qué aprenderán? ¿Cuál es el objetivo principal del curso?"
                  className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-capta-soft focus:outline-none focus:ring-2 focus:ring-capta-soft/20 focus:ring-offset-1 transition-all hover:border-capta-deep/30 dark:hover:border-capta-soft/30"
                />
              </div>

              {/* ── Estado inicial — Toggle pill ── */}
              <div className="space-y-2.5">
                <label className="block text-sm font-semibold text-foreground">Estado inicial</label>

                {/* Toggle estilo pill/segmented control */}
                <div className="relative flex rounded-xl border border-border bg-muted/20 p-1">
                  {/* Indicador deslizante */}
                  <motion.div
                    layout
                    layoutId="status-pill"
                    className="absolute inset-y-1 rounded-lg"
                    style={{
                      left:       statusValue === 'DRAFT' ? '4px' : '50%',
                      right:      statusValue === 'DRAFT' ? '50%' : '4px',
                      background: statusValue === 'PUBLISHED'
                        ? 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 70%, white) 100%)'
                        : 'var(--background)',
                      boxShadow:  statusValue === 'PUBLISHED'
                        ? '0 2px 8px color-mix(in srgb, var(--tenant-primary) 30%, transparent)'
                        : '0 1px 4px rgba(0,0,0,0.08)',
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  />

                  {[
                    { value: 'DRAFT',     label: 'Borrador',  icon: 'archive' as const },
                    { value: 'PUBLISHED', label: 'Publicado', icon: 'globe'   as const },
                  ].map(opt => {
                    const selected = statusValue === opt.value;
                    const isPublished = opt.value === 'PUBLISHED';
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setValue('status', opt.value as 'DRAFT' | 'PUBLISHED')}
                        className="relative z-10 flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors duration-200"
                        style={{
                          color: selected
                            ? isPublished ? 'white' : 'var(--foreground)'
                            : 'var(--muted-foreground)',
                        }}
                      >
                        <Icon name={opt.icon} size={14} />
                        {opt.label}
                        {/* Input radio oculto para react-hook-form */}
                        <input {...register('status')} type="radio" value={opt.value} className="sr-only" />
                      </button>
                    );
                  })}
                </div>

                {/* Descripción del estado */}
                <AnimatePresence mode="wait">
                  <motion.p
                    key={statusValue}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -3 }}
                    transition={{ duration: 0.15 }}
                    className="px-1 text-xs text-muted-foreground"
                  >
                    {statusValue === 'DRAFT'
                      ? 'Solo visible para administradores. Puedes publicarlo cuando esté listo.'
                      : 'Disponible para que los empleados se inscriban de inmediato.'}
                  </motion.p>
                </AnimatePresence>
              </div>

              {/* ── Divisor ── */}
              <div className="h-px bg-border/60" />

              {/* ── Acciones ── */}
              <div className="flex items-center justify-between">
                <Link
                  href="/dashboard/courses"
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                >
                  Cancelar
                </Link>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="relative flex items-center gap-2 overflow-hidden rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-60 hover:scale-[1.02] active:scale-[0.97]"
                  style={{
                    background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)',
                    boxShadow:  '0 2px 12px color-mix(in srgb, var(--tenant-primary) 30%, transparent)',
                  }}
                >
                  {/* Shimmer en hover */}
                  <span
                    className="pointer-events-none absolute inset-0 -translate-x-full skew-x-12 bg-white/10 transition-transform duration-500 hover:translate-x-full"
                    aria-hidden
                  />
                  {isLoading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      {uploadingThumb ? 'Subiendo imagen…' : 'Creando curso…'}
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      Crear curso
                    </>
                  )}
                </button>
              </div>

            </form>
          </motion.div>

        </div>
      </div>
    </div>
  );
}