'use client';

import { useState } from 'react';
import { Icon } from '@/components/capta-icon';

const AlertCircle = (p: { size?: number; className?: string }) => <Icon name="alert-circle" size={p.size} className={p.className} />;
const X           = (p: { size?: number; className?: string }) => <Icon name="close"        size={p.size} className={p.className} />;
const Plus        = (p: { size?: number; className?: string }) => <Icon name="plus"         size={p.size} className={p.className} />;
const Loader2     = (p: { size?: number; className?: string }) => <Icon name="refresh"      size={p.size} className={p.className} />;
const Check       = (p: { size?: number; className?: string }) => <Icon name="check"        size={p.size} className={p.className} />;

// Subformulario reutilizable para agregar / editar una pregunta
export function QuestionForm({
  initial,
  hasAttempts,
  saving,
  onSave,
  onCancel,
}: {
  initial?: { text: string; explanation: string; options: { text: string; isCorrect: boolean }[] };
  hasAttempts: boolean;
  saving: boolean;
  onSave: (data: { text: string; explanation: string; options: { text: string; isCorrect: boolean }[] }) => void;
  onCancel: () => void;
}) {
  const [text,        setText]        = useState(initial?.text        ?? '');
  const [explanation, setExplanation] = useState(initial?.explanation ?? '');
  const [options,     setOptions]     = useState<{ text: string; isCorrect: boolean }[]>(
    initial?.options ?? [{ text: '', isCorrect: false }, { text: '', isCorrect: false }],
  );
  const [localError,  setLocalError]  = useState<string | null>(null);

  const handleSave = () => {
    if (!text.trim()) { setLocalError('El texto de la pregunta es obligatorio.'); return; }
    const valid = options.filter(o => o.text.trim());
    if (valid.length < 2) { setLocalError('Agrega al menos 2 opciones con texto.'); return; }
    if (!valid.some(o => o.isCorrect)) { setLocalError('Debes marcar al menos una opción como correcta.'); return; }
    setLocalError(null);
    onSave({ text: text.trim(), explanation: explanation.trim(), options: valid });
  };

  return (
    <div className="space-y-3">
      {localError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2">
          <AlertCircle size={13} className="text-destructive flex-shrink-0" />
          <p className="text-xs text-destructive">{localError}</p>
        </div>
      )}

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={2}
        placeholder="Texto de la pregunta…"
        className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capta-soft/40 focus:border-capta-soft"
      />

      {/* Opciones */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Opciones — marca la respuesta correcta (●)</p>
          {hasAttempts && (
            <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
              Solo texto editable*
            </span>
          )}
        </div>
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setOptions(prev => prev.map((o, idx) => ({ ...o, isCorrect: idx === i })))
              }
              disabled={hasAttempts}
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all disabled:cursor-not-allowed"
              style={{
                borderColor: opt.isCorrect ? '#16a34a' : undefined,
                background:  opt.isCorrect ? '#16a34a' : 'transparent',
              }}
              title={hasAttempts ? 'No se puede cambiar la respuesta correcta con intentos registrados' : 'Marcar como correcta'}
            >
              {opt.isCorrect && <div className="h-2 w-2 rounded-full bg-white" />}
            </button>
            <input
              value={opt.text}
              onChange={e =>
                setOptions(prev => prev.map((o, idx) => idx === i ? { ...o, text: e.target.value } : o))
              }
              placeholder={`Opción ${i + 1}`}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-capta-soft/40"
            />
            {options.length > 2 && !hasAttempts && (
              <button
                type="button"
                onClick={() => setOptions(prev => prev.filter((_, idx) => idx !== i))}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        {!hasAttempts && (
          <button
            type="button"
            onClick={() => setOptions(prev => [...prev, { text: '', isCorrect: false }])}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-capta-deep dark:hover:text-capta-soft transition-colors"
          >
            <Plus size={12} /> Agregar opción
          </button>
        )}
        {hasAttempts && (
          <p className="text-[10px] text-muted-foreground italic">
            * Las opciones no pueden cambiarse porque ya existen intentos registrados.
          </p>
        )}
      </div>

      {/* Explicación */}
      <textarea
        value={explanation}
        onChange={e => setExplanation(e.target.value)}
        rows={2}
        placeholder="Explicación opcional — se muestra al revisar resultados"
        className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-capta-soft/40"
      />

      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50 transition-all hover:opacity-90 active:scale-[0.97]"
          style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' }}
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Guardar
        </button>
      </div>
    </div>
  );
}
