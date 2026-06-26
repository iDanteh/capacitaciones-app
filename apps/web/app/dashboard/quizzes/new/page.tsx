'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/capta-icon';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';

export default function NewQuizPage() {
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [title,        setTitle]        = useState('');
  const [description,  setDescription]  = useState('');
  const [instructions, setInstructions] = useState('');
  const [minScore,     setMinScore]     = useState(70);
  const [timeLimitMin, setTimeLimitMin] = useState('');
  const [saving,       setSaving]       = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await api.post<{ id: string }>('/quizzes', {
        title:        title.trim(),
        description:  description.trim()  || undefined,
        instructions: instructions.trim() || undefined,
        minScore,
        timeLimit: timeLimitMin ? parseInt(timeLimitMin) * 60 : undefined,
        isActive:  false,
      });
      success('Quiz creado', 'Ahora agrega preguntas y asigna empleados');
      router.push(`/dashboard/quizzes/${res.data.id}`);
    } catch {
      toastError('Error al crear el quiz');
      setSaving(false);
    }
  };

  // ── Score color helper ─────────────────────────────────────────────────────
  const scoreColor =
    minScore >= 90 ? '#ef4444' :
    minScore >= 70 ? 'var(--tenant-primary)' :
    '#22c55e';

  const scoreLabel =
    minScore >= 90 ? 'Muy exigente' :
    minScore >= 70 ? 'Estándar' :
    'Flexible';

  const timeLabel = timeLimitMin
    ? `${timeLimitMin} min`
    : 'Sin límite';

  const inputCls =
    'w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground ' +
    'placeholder:text-muted-foreground/40 outline-none transition-all ' +
    'hover:border-[var(--tenant-primary)]/30 ' +
    'focus:border-[var(--tenant-primary)] focus:ring-2 focus:ring-[var(--tenant-primary)]/20';

  return (
    <div className="min-h-screen bg-background">

      {/* ── Barra sticky ── */}
      <div className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="group flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
        >
          <Icon name="arrow-left" size={14} className="transition-transform group-hover:-translate-x-0.5" />
          Quizzes
        </button>
        <span className="text-border/60">›</span>
        <span className="text-sm font-medium text-foreground/70">Nuevo quiz</span>

        <AnimatePresence>
          {title.length > 2 && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="ml-1 max-w-[240px] truncate text-sm text-muted-foreground/60"
            >
              · {title}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── Layout principal ── */}
      <div className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_420px]">

          {/* ════ COLUMNA IZQUIERDA — Panel de configuración visual ════ */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.05 }}
            className="flex flex-col gap-6"
          >

            {/* Preview card del quiz */}
            <div>
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                Vista previa de configuración
              </p>

              <div
                className="relative overflow-hidden rounded-2xl border border-border p-6"
                style={{
                  background: 'linear-gradient(145deg, color-mix(in srgb, var(--tenant-primary) 5%, var(--card)) 0%, var(--card) 100%)',
                  boxShadow:  '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)',
                }}
              >
                {/* Acento superior */}
                <div
                  className="absolute inset-x-0 top-0 h-0.5"
                  style={{ background: 'linear-gradient(90deg, #1E4F7A 0%, #2D6FA0 50%, #7FD1AE 100%)' }}
                />

                {/* Título dinámico */}
                <div className="mb-5">
                  <AnimatePresence mode="wait">
                    {title.trim() ? (
                      <motion.h2
                        key="title"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="text-base font-semibold text-foreground"
                      >
                        {title}
                      </motion.h2>
                    ) : (
                      <motion.p
                        key="placeholder"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-base text-muted-foreground/40 italic"
                      >
                        El título aparecerá aquí…
                      </motion.p>
                    )}
                  </AnimatePresence>
                  {description.trim() && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-1.5 line-clamp-2 text-xs text-muted-foreground"
                    >
                      {description}
                    </motion.p>
                  )}
                </div>

                {/* Métricas */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Score mínimo */}
                  <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                    <p className="mb-1 text-xs text-muted-foreground/70">Calificación mínima</p>
                    <motion.p
                      key={minScore}
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      className="text-2xl font-bold tabular-nums"
                      style={{ color: scoreColor }}
                    >
                      {minScore}%
                    </motion.p>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={scoreLabel}
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -3 }}
                        className="mt-0.5 text-[11px] font-medium"
                        style={{ color: scoreColor }}
                      >
                        {scoreLabel}
                      </motion.p>
                    </AnimatePresence>
                  </div>

                  {/* Tiempo límite */}
                  <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                    <p className="mb-1 text-xs text-muted-foreground/70">Tiempo límite</p>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={timeLabel}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        className="text-2xl font-bold tabular-nums text-foreground"
                      >
                        {timeLimitMin || '∞'}
                      </motion.p>
                    </AnimatePresence>
                    <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                      {timeLimitMin ? 'minutos' : 'sin límite'}
                    </p>
                  </div>
                </div>

                {/* Barra de score visual */}
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground/60">Umbral de aprobación</span>
                    <span className="text-[11px] font-semibold" style={{ color: scoreColor }}>{minScore}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                    <motion.div
                      animate={{ width: `${minScore}%` }}
                      transition={{ type: 'spring', stiffness: 180, damping: 22 }}
                      className="h-full rounded-full"
                      style={{ background: scoreColor }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/40">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Nota informativa */}
            <div
              className="flex gap-3 rounded-xl border border-border/50 p-4"
              style={{ background: 'color-mix(in srgb, var(--tenant-primary) 4%, var(--background))' }}
            >
              <Icon
                name="info"
                size={15}
                className="mt-0.5 flex-shrink-0"
                style={{ color: 'var(--tenant-primary)' } as React.CSSProperties}
              />
              <div>
                <p className="mb-1 text-xs font-semibold text-foreground/80">Antes de publicar</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Los empleados tienen <strong className="font-semibold text-foreground">un solo intento</strong> para
                  completar el quiz. El sistema bloqueará toda navegación mientras esté activo.
                </p>
              </div>
            </div>

          </motion.div>

          {/* ════ COLUMNA DERECHA — Formulario ════ */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.1 }}
          >
            <div className="mb-6">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                Crear nuevo quiz
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Define los parámetros. Podrás agregar preguntas y asignar empleados después.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* ── Título ── */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-foreground">
                  Título <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ej: Evaluación de seguridad industrial"
                  required
                  className={inputCls}
                />
              </div>

              {/* ── Descripción ── */}
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <label className="block text-sm font-semibold text-foreground">Descripción</label>
                  <span className="text-xs text-muted-foreground/60">Opcional</span>
                </div>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Breve descripción del objetivo del quiz…"
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* ── Instrucciones ── */}
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <label className="block text-sm font-semibold text-foreground">
                    Instrucciones para el empleado
                  </label>
                  <span className="text-xs text-muted-foreground/60">Opcional</span>
                </div>
                <textarea
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  placeholder="Instrucciones que verá el empleado antes de comenzar…"
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* ── Parámetros numéricos ── */}
              <div className="grid grid-cols-2 gap-4">

                {/* Score mínimo con slider */}
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <label className="block text-sm font-semibold text-foreground">
                      Calificación mínima
                    </label>
                    <span
                      className="text-xs font-bold tabular-nums"
                      style={{ color: scoreColor }}
                    >
                      {minScore}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={minScore}
                    onChange={e => setMinScore(Number(e.target.value))}
                    className="w-full accent-[var(--tenant-primary)] cursor-pointer"
                    style={{ accentColor: scoreColor }}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground/50">
                    <span>Flexible</span>
                    <span>Exigente</span>
                  </div>
                </div>

                {/* Tiempo límite */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-foreground">
                    Tiempo límite
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      value={timeLimitMin}
                      onChange={e => setTimeLimitMin(e.target.value)}
                      placeholder="Sin límite"
                      className={`${inputCls} pr-12`}
                    />
                    {timeLimitMin && (
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60">
                        min
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground/50">
                    Déjalo vacío para sin límite
                  </p>
                </div>

              </div>

              {/* ── Divisor ── */}
              <div className="h-px bg-border/60" />

              {/* ── Acciones ── */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={!title.trim() || saving}
                  className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.97]"
                  style={{
                    background:  'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)',
                    boxShadow:   '0 2px 12px color-mix(in srgb, var(--tenant-primary) 30%, transparent)',
                  }}
                >
                  {saving && <Icon name="refresh" size={14} className="animate-spin" />}
                  Crear quiz
                </button>
              </div>

            </form>
          </motion.div>

        </div>
      </div>
    </div>
  );
}