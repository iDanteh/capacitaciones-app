'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { motion } from 'framer-motion';
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

  const inputCls = 'w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--tenant-primary)] focus:ring-2 focus:ring-[var(--tenant-primary)]/20';

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
      });
      success('Quiz creado', 'Ahora agrega preguntas y asigna empleados');
      router.push(`/dashboard/quizzes/${res.data.id}`);
    } catch {
      toastError('Error al crear el quiz');
      setSaving(false);
    }
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <button
            onClick={() => router.back()}
            className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="arrow-left" size={13} /> Quizzes
          </button>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Nuevo quiz</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define los parámetros del quiz. Luego podrás agregar preguntas y asignar empleados.
          </p>
        </motion.div>

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.06 }}
          className="rounded-2xl border border-border bg-card p-6"
          style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Título <span className="text-destructive">*</span></label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ej. Evaluación de seguridad industrial"
                required
                className={inputCls}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Descripción</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Breve descripción del objetivo del quiz..."
                rows={3}
                className={`${inputCls} resize-none`}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Instrucciones para el empleado</label>
              <textarea
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder="Instrucciones que verá el empleado antes de comenzar..."
                rows={3}
                className={`${inputCls} resize-none`}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Calificación mínima (%)</label>
                <input
                  type="number" min={0} max={100}
                  value={minScore}
                  onChange={e => setMinScore(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Tiempo límite (minutos)</label>
                <input
                  type="number" min={1}
                  value={timeLimitMin}
                  onChange={e => setTimeLimitMin(e.target.value)}
                  placeholder="Sin límite"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Info note */}
            <div className="flex gap-3 rounded-xl border border-border bg-muted/30 p-4 text-sm">
              <Icon name="info" size={15} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
              <p className="text-muted-foreground leading-relaxed">
                Los empleados tienen <strong className="text-foreground font-medium">una sola oportunidad</strong> para completar
                el quiz. El sistema bloqueará toda navegación mientras el quiz está activo.
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!title.trim() || saving}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-all hover:scale-[1.02] hover:brightness-110 active:scale-[0.97]"
                style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)', boxShadow: '0 2px 10px color-mix(in srgb, var(--tenant-primary) 20%, transparent)' }}
              >
                {saving && <Icon name="refresh" size={14} className="animate-spin" />}
                Crear quiz
              </button>
            </div>

          </form>
        </motion.div>

      </div>
    </div>
  );
}
