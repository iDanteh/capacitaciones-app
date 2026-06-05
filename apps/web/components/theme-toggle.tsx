'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Icon } from './capta-icon';

interface ThemeToggleProps {
  className?: string;
  iconSize?: number;
}

export function ThemeToggle({ className = '', iconSize = 16 }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Placeholder del mismo tamaño para evitar layout shift durante hidratación
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
      <Icon name={isDark ? 'sun' : 'moon'} size={iconSize} />
    </button>
  );
}
