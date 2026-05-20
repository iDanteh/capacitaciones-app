'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Upload, X, Loader2 } from 'lucide-react';
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
  const [thumbnail,       setThumbnail]       = useState<File | null>(null);
  const [thumbnailPreview,setThumbnailPreview] = useState<string | null>(null);
  const [uploadingThumb,  setUploadingThumb]   = useState(false);
  const [serverError,     setServerError]      = useState<string | null>(null);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'DRAFT' },
  });

  // ── Thumbnail preview ──────────────────────────────────────────────────────

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
          isPublic:    true, // Las miniaturas son accesibles públicamente (prefijo public/)
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
    }
  };

  const isLoading = isSubmitting || uploadingThumb;

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      <div className="mx-auto max-w-2xl">

        {/* ── Breadcrumb ── */}
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard/courses" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <ArrowLeft size={14} /> Cursos
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">Nuevo curso</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="rounded-2xl border border-border bg-card shadow-sm p-6 lg:p-8"
        >
          {/* ── Icono + título ── */}
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky/20 to-navy/20">
              <BookOpen size={20} className="text-navy dark:text-sky" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Nuevo curso</h1>
              <p className="text-sm text-muted-foreground">Completa los datos básicos para comenzar.</p>
            </div>
          </div>

          {serverError && (
            <div className="mb-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
              <p className="text-sm text-destructive">{serverError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

            {/* Título */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Título del curso <span className="text-destructive">*</span>
              </label>
              <input
                {...register('title')}
                placeholder="Ej: Introducción a Excel"
                className={`w-full rounded-xl border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-sky/40 focus:border-sky transition-all ${
                  errors.title ? 'border-destructive/60 bg-destructive/5' : 'border-border hover:border-navy/30'
                }`}
              />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>

            {/* Descripción */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Descripción</label>
              <textarea
                {...register('description')}
                rows={4}
                placeholder="Describe qué aprenderán los empleados en este curso..."
                className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-sky/40 focus:border-sky transition-all hover:border-navy/30"
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
            </div>

            {/* Thumbnail */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Miniatura del curso</label>
              {thumbnailPreview ? (
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-border">
                  <img src={thumbnailPreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={removeThumbnail}
                    className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-gray-900/70 text-white hover:bg-gray-900 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full aspect-video rounded-xl border-2 border-dashed border-border bg-muted/30 hover:border-sky/50 hover:bg-sky/5 transition-all cursor-pointer">
                  <Upload size={24} className="text-muted-foreground mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">Arrastra una imagen o haz clic</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">PNG, JPG hasta 5 MB</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Estado inicial */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Estado inicial</label>
              <div className="flex gap-3">
                {[
                  { value: 'DRAFT',     label: 'Borrador',   desc: 'Solo visible para administradores' },
                  { value: 'PUBLISHED', label: 'Publicado',  desc: 'Disponible para inscripción' },
                ].map(opt => {
                  const selected = watch('status') === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`flex-1 cursor-pointer rounded-xl border p-4 transition-all ${
                        selected
                          ? 'border-navy/40 bg-navy/5 dark:border-sky/40 dark:bg-sky/5'
                          : 'border-border hover:border-navy/20'
                      }`}
                    >
                      <input {...register('status')} type="radio" value={opt.value} className="sr-only" />
                      <p className={`text-sm font-semibold ${selected ? 'text-navy dark:text-sky' : 'text-foreground'}`}>
                        {opt.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Acciones */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link
                href="/dashboard/courses"
                className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy/90 active:scale-[0.97] transition-all disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? (
                  <><Loader2 size={15} className="animate-spin" /> {uploadingThumb ? 'Subiendo imagen...' : 'Creando...'}</>
                ) : (
                  'Crear curso'
                )}
              </button>
            </div>

          </form>
        </motion.div>
      </div>
    </div>
  );
}
