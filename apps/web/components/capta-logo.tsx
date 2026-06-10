'use client';

/**
 * CaptaLogo — logo de la marca Capta (apertura 01-Aperture).
 *
 * Renderiza el SVG inline para preservar el gradiente.
 * Dos variantes de color según el tema (light / dark).
 * El texto "Capta" se renderiza como nodo React usando la fuente del sistema
 * para evitar dependencias en el SVG.
 */

import { useTheme } from 'next-themes';
import { useEffect, useState, useId } from 'react';

interface CaptaLogoProps {
  /** Tamaño del mark en px (el texto escala proporcionalmente) */
  markSize?: number;
  /** Muestra el texto junto al mark */
  showText?: boolean;
  /** Fuerza un tema sin esperar al montaje (útil en SSR-safe wrappers) */
  forceDark?: boolean;
  /** Reemplaza "Capta" con el nombre de plataforma del tenant (white-label) */
  customText?: string;
}

// Rutas del mark (idéntico en light y dark, solo cambian los colores)
const MARK_PATH = 'M 36 14 A 16 16 0 1 0 36 34';

const THEMES = {
  light: {
    grad: ['#1F5C4D', '#7FD1AE'] as [string, string],
    dot: '#FAFAF7',
    text: '#0B1F2A',
  },
  dark: {
    grad: ['#7FD1AE', '#A8E6CF'] as [string, string],
    dot: '#0B1F2A',
    text: '#F4F2EC',
  },
};

export function CaptaLogo({ markSize = 28, showText = true, forceDark, customText }: CaptaLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // useId() generates stable IDs consistent between SSR and client hydration
  const reactId = useId();
  const gradId = `capta-grad-${reactId.replace(/:/g, '')}`;

  useEffect(() => { setMounted(true); }, []);

  const isDark = mounted ? (forceDark ?? resolvedTheme === 'dark') : false;
  const t = isDark ? THEMES.dark : THEMES.light;
  const scale = markSize / 48; // mark viewBox = 48×48

  return (
    <div className="flex items-center gap-2.5 select-none">
      {/* Mark SVG */}
      <svg
        viewBox="0 0 48 48"
        width={markSize}
        height={markSize}
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={t.grad[0]} />
            <stop offset="1" stopColor={t.grad[1]} />
          </linearGradient>
        </defs>
        <path
          d={MARK_PATH}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={5}
          strokeLinecap="round"
        />
        <circle cx="38" cy="24" r="4" fill={`url(#${gradId})`} />
        <circle cx="38" cy="24" r="2" fill={t.dot} />
      </svg>

      {/* Logotipo textual */}
      {showText && (
        <span
          className="font-semibold tracking-tight leading-none"
          style={{
            fontSize: markSize * 0.58,
            color: t.text,
            letterSpacing: '-0.025em',
          }}
        >
          {customText || 'Capta'}
        </span>
      )}
    </div>
  );
}

/** Versión solo del mark (sin texto) */
export function CaptaMark({ size = 28, forceDark }: { size?: number; forceDark?: boolean }) {
  return <CaptaLogo markSize={size} showText={false} forceDark={forceDark} />;
}
