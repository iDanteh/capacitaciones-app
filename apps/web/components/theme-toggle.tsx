'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  /** Clases adicionales para el botón contenedor */
  className?: string;
  /** Tamaño del ícono en px. Default 16. */
  iconSize?: number;
}

/**
 * Botón de toggle light / dark mode.
 *
 * Usa `suppressHydrationWarning` pattern: renderiza un placeholder vacío
 * del mismo tamaño hasta que el componente esté montado en el cliente.
 * Esto evita el hydration mismatch ya que el tema inicial se determina
 * en el cliente (no en el servidor).
 */
export function ThemeToggle({ className = '', iconSize = 16 }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Placeholder del mismo tamaño que el botón real para no causar layout shift
  if (!mounted) {
    return <div className="h-8 w-8 flex-shrink-0" aria-hidden="true" />;
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg
        text-muted-foreground transition-all duration-150
        hover:bg-muted hover:text-foreground
        active:scale-95
        ${className}`}
    >
      {isDark
        ? <Sun  size={iconSize} strokeWidth={1.75} />
        : <Moon size={iconSize} strokeWidth={1.75} />
      }
    </button>
  );
}
