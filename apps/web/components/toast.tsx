'use client';

/**
 * Toast — sistema global de notificaciones no bloqueantes.
 *
 * Uso:
 *   const { success, error, warning, info } = useToast();
 *   success('Curso guardado');
 *   error('No se pudo conectar', 'Verifica tu conexión e intenta de nuevo.');
 *
 * Integración: envuelve el árbol con <ToastProvider> en providers.tsx.
 */

import React, { createContext, useCallback, useContext, useReducer } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, type IconName } from './capta-icon';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  variant:     ToastVariant;
  title:       string;
  description?: string;
  duration?:   number; // ms — default 4000
}

interface ToastItem extends ToastOptions {
  id: string;
}

type Action =
  | { type: 'ADD';    toast: ToastItem }
  | { type: 'REMOVE'; id: string };

// ─── Variant config ───────────────────────────────────────────────────────────

const VARIANT_CONFIG: Record<ToastVariant, {
  icon:      IconName;
  accent:    string;
  iconBg:    string;
  iconColor: string;
}> = {
  success: {
    icon:      'check-circle',
    accent:    '#16a34a',
    iconBg:    'rgba(22,163,74,0.10)',
    iconColor: '#16a34a',
  },
  error: {
    icon:      'x-circle',
    accent:    'hsl(var(--destructive))',
    iconBg:    'hsla(var(--destructive)/.10)',
    iconColor: 'hsl(var(--destructive))',
  },
  warning: {
    icon:      'alert-triangle',
    accent:    '#d97706',
    iconBg:    'rgba(217,119,6,0.10)',
    iconColor: '#d97706',
  },
  info: {
    icon:      'info',
    accent:    '#1E4F7A',
    iconBg:    'rgba(30,79,122,0.10)',
    iconColor: '#1E4F7A',
  },
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: ToastItem[], action: Action): ToastItem[] {
  switch (action.type) {
    case 'ADD':    return [action.toast, ...state].slice(0, 5);
    case 'REMOVE': return state.filter(t => t.id !== action.id);
    default:       return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface ToastContextValue {
  addToast:    (opts: ToastOptions) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = useReducer(reducer, []);

  const addToast = useCallback((opts: ToastOptions) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    dispatch({ type: 'ADD', toast: { id, ...opts } });
    setTimeout(() => dispatch({ type: 'REMOVE', id }), opts.duration ?? 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    dispatch({ type: 'REMOVE', id });
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');

  return {
    toast:   ctx.addToast,
    success: (title: string, description?: string) =>
      ctx.addToast({ variant: 'success', title, description }),
    error:   (title: string, description?: string) =>
      ctx.addToast({ variant: 'error', title, description }),
    warning: (title: string, description?: string) =>
      ctx.addToast({ variant: 'warning', title, description }),
    info:    (title: string, description?: string) =>
      ctx.addToast({ variant: 'info', title, description }),
  };
}

// ─── Toast card ───────────────────────────────────────────────────────────────

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const cfg      = VARIANT_CONFIG[toast.variant];
  const duration = (toast.duration ?? 4000) / 1000;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 56, scale: 0.92 }}
      animate={{ opacity: 1, x: 0,  scale: 1    }}
      exit={{    opacity: 0, x: 56, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className="relative flex w-80 items-start gap-3 overflow-hidden rounded-2xl border border-border bg-card px-4 py-3.5"
      style={{
        boxShadow: '0 4px 24px rgba(0,0,0,0.10), 0 1px 0 rgba(255,255,255,0.55) inset',
      }}
    >
      {/* Accent side bar */}
      <div
        className="absolute left-0 inset-y-0 w-[3px] rounded-l-2xl"
        style={{ background: cfg.accent }}
      />

      {/* Icon */}
      <div
        className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl"
        style={{ background: cfg.iconBg }}
      >
        <Icon
          name={cfg.icon}
          size={14}
          style={{ color: cfg.iconColor }}
          strokeWidth={1.8}
        />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 pr-1">
        <p className="text-sm font-semibold text-foreground leading-snug">
          {toast.title}
        </p>
        {toast.description && (
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            {toast.description}
          </p>
        )}
      </div>

      {/* Close */}
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mt-0.5"
        aria-label="Cerrar"
      >
        <Icon name="close" size={11} strokeWidth={2} />
      </button>

      {/* Progress bar */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-[2px]"
        style={{ background: cfg.accent, opacity: 0.35, transformOrigin: 'left' }}
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration, ease: 'linear' }}
      />
    </motion.div>
  );
}

// ─── Viewport ─────────────────────────────────────────────────────────────────

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className="fixed bottom-5 right-5 z-[200] flex flex-col-reverse gap-2.5 pointer-events-none"
      aria-live="polite"
      aria-label="Notificaciones"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastCard toast={t} onDismiss={onDismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
