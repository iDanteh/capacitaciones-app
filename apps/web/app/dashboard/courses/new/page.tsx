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

// Icon aliases for inline usage
const ArrowLeft   = (p: { size?: number; className?: string }) => <Icon name="arrow-left"    size={p.size} className={p.className} />;
const Upload      = (p: { size?: number; className?: string }) => <Icon name="upload"        size={p.size} className={p.className} />;
const X           = (p: { size?: number; className?: string }) => <Icon name="close"         size={p.size} className={p.className} />;
const Loader2     = (p: { size?: number; className?: string }) => <Icon name="refresh"       size={p.size} className={p.className} />;
const Check       = (p: { size?: number; className?: string }) => <Icon name="check"         size={p.size} className={p.className} />;
const AlertCircle = (p: { size?: number; className?: string }) => <Icon name="alert-circle"  size={p.size} className={p.className} />;
const BookOpen    = (p: { size?: number; className?: string }) => <Icon name="book-open"     size={p.size} className={p.className} />;
import { api } from '@/lib/api';

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

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
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

      // 1. Subir thumbnail si existe
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

      // 2. Crear el curso
      const { data: course } = await api.post<{ id: string }>('/courses', {
        ...data,
        thumbnailKey,
        thumbnailUrl,
      });

      // 3. Redirigir al editor
      router.push(`/dashboard/courses/${course.id}`);
    } catch (err: unknown) {
      setUploadingThumb(false);
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setServerError(msg ?? 'Ocurrió un error al crear el curso.');
      toastError(msg ?? 'No pudimos crear el curso. Verifica tu conexión e intenta de nuevo.');
    }
  };

  const isLoading    = isSubmitting || uploadingThumb;
  const statusValue  = watch('status');

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6 lg:py-10">

        {/* ── Breadcrumb ── */}
        <div className="mb-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href="/dashboard/courses"
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} /> Cursos
          </Link>
          <span className="text-border">/</span>
          <span className="text-foreground font-medium">Nuevo curso</span>
        </div>

        {/* ── Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="rounded-2xl border border-border bg-card overflow-hidden"
          style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
        >
          {/* Acento superior con gradiente de marca */}
          <div
            className="h-1 w-full"
            style={{ background: 'linear-gradient(90deg, #1E4F7A 0%, #2D6FA0 50%, #7FD1AE 100%)' }}
          />

          <div className="p-6 lg:p-8">

            {/* Header */}
            <div className="mb-7 flex items-center gap-3">
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, #DCE9F4 0%, #8FC4E820 100%)',
                  border:     '1px solid #1E4F7A18',
                }}
              >
                <BookOpen size={18} className="text-capta-deep dark:text-capta-soft" />
              </div>
              <div>
                <h1 className="font-display text-xl font-normal tracking-tight text-foreground">Nuevo curso</h1>
                <p className="text-sm text-muted-foreground">Completa los datos básicos para comenzar</p>
              </div>
            </div>

            {/* Error de servidor */}
            <AnimatePresence>
              {serverError && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3"
                >
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-destructive" />
                  <p className="text-sm text-destructive">{serverError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

              {/* ── Título ── */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-foreground">
                  Título del curso <span className="text-destructive">*</span>
                </label>
                <input
                  {...register('title')}
                  placeholder="Ej: Introducción a Excel para equipos de ventas"
                  className={`w-full rounded-xl border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-capta-soft transition-all ${
                    errors.title
                      ? 'border-destructive/60 bg-destructive/5'
                      : 'border-border hover:border-capta-deep/20 dark:hover:border-capta-soft/20'
                  }`}
                />
                {errors.title && (
                  <p className="flex items-center gap-1 text-xs text-destructive">
                    <AlertCircle size={11} /> {errors.title.message}
                  </p>
                )}
              </div>

              {/* ── Descripción ── */}
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <label className="block text-sm font-semibold text-foreground">Descripción</label>
                  <span className="text-xs text-muted-foreground">Opcional</span>
                </div>
                <textarea
                  {...register('description')}
                  rows={3}
                  placeholder="¿Qué aprenderán los empleados? ¿Cuál es el objetivo del curso?"
                  className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-capta-soft transition-all hover:border-capta-deep/20 dark:hover:border-capta-soft/20"
                />
              </div>

              {/* ── Thumbnail ── */}
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <label className="block text-sm font-semibold text-foreground">Miniatura del curso</label>
                  <span className="text-xs text-muted-foreground">PNG, JPG · máx. 5 MB</span>
                </div>

                {thumbnailPreview ? (
                  <div className="group relative w-full overflow-hidden rounded-xl border border-border" style={{ aspectRatio: '16/9' }}>
                    <img src={thumbnailPreview} alt="Vista previa" className="h-full w-full object-cover" />
                    {/* Overlay hover */}
                    <div className="absolute inset-0 bg-black/0 transition-all group-hover:bg-black/25" />
                    {/* Badge con nombre del archivo */}
                    <div className="absolute bottom-3 left-3 max-w-[calc(100%-4rem)] rounded-lg bg-black/60 px-2.5 py-1">
                      <p className="truncate text-[11px] font-medium text-white">{thumbnail?.name}</p>
                    </div>
                    {/* Botón eliminar */}
                    <button
                      type="button"
                      onClick={removeThumbnail}
                      className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-all hover:bg-black/80 group-hover:opacity-100"
                    >
                      <X size={13} />
                    </button>
                  </div>
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
                    className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all ${
                      dragOver
                        ? 'scale-[1.01] border-capta-soft bg-capta-soft/10'
                        : 'border-border bg-muted/20 hover:border-capta-soft/40 hover:bg-capta-soft/5'
                    }`}
                  >
                    <div
                      className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl transition-all"
                      style={{
                        background: dragOver ? 'color-mix(in srgb, #8FC4E8 12%, transparent)' : 'color-mix(in srgb, var(--tenant-primary) 8%, transparent)',
                        color:      dragOver ? '#8FC4E8'                                      : 'var(--tenant-primary)',
                      }}
                    >
                      <Upload size={22} />
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {dragOver ? 'Suelta la imagen aquí' : 'Arrastra una imagen aquí'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">o haz clic para seleccionar desde tu dispositivo</p>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleThumbnailFile(f); }}
                    />
                  </label>
                )}
              </div>

              {/* ── Estado inicial ── */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-foreground">Estado inicial</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      value: 'DRAFT',
                      label: 'Borrador',
                      desc:  'Solo visible para administradores',
                      icon:  'archive' as const,
                      color: '#6b7280',
                    },
                    {
                      value: 'PUBLISHED',
                      label: 'Publicado',
                      desc:  'Disponible para inscripción inmediata',
                      icon:  'globe' as const,
                      color: 'var(--tenant-primary)',
                    },
                  ].map(opt => {
                    const selected = statusValue === opt.value;
                    return (
                      <label
                        key={opt.value}
                        className={`relative flex cursor-pointer flex-col gap-2 rounded-xl border p-4 transition-all ${
                          selected
                            ? 'border-capta-deep/40 dark:border-capta-soft/40'
                            : 'border-border hover:border-border/80 hover:bg-muted/30'
                        }`}
                        style={selected ? { background: `${opt.color}07` } : {}}
                      >
                        <input {...register('status')} type="radio" value={opt.value} className="sr-only" />

                        {/* Check badge cuando está seleccionado */}
                        {selected && (
                          <div
                            className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full"
                            style={{ background: opt.color }}
                          >
                            <Check size={9} className="text-white" />
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <div
                            className="flex h-7 w-7 items-center justify-center rounded-lg"
                            style={{ background: `${opt.color}15`, color: opt.color }}
                          >
                            <Icon name={opt.icon} size={14} />
                          </div>
                          <p className={`text-sm font-semibold ${selected ? 'text-capta-deep dark:text-capta-soft' : 'text-foreground'}`}>
                            {opt.label}
                          </p>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">{opt.desc}</p>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* ── Acciones ── */}
              <div className="flex items-center justify-between border-t border-border pt-5">
                <Link
                  href="/dashboard/courses"
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  Cancelar
                </Link>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 hover:scale-[1.02] active:scale-[0.97] transition-all"
                  style={{
                    background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)',
                    boxShadow:  '0 2px 10px color-mix(in srgb, var(--tenant-primary) 25%, transparent)',
                  }}
                >
                  {isLoading ? (
                    <><Loader2 size={15} className="animate-spin" /> {uploadingThumb ? 'Subiendo imagen…' : 'Creando curso…'}</>
                  ) : (
                    <><Check size={14} /> Crear curso</>
                  )}
                </button>
              </div>

            </form>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
