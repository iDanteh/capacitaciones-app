'use client';

import { ThemeProvider } from 'next-themes';
import { ToastProvider } from '@/components/toast';

/**
 * Providers globales de la aplicación.
 *
 * Se mantiene separado del layout raíz (server component) porque ThemeProvider
 * necesita ser un client component. El patrón "wrapper de client en server layout"
 * es el estándar en Next.js App Router para evitar marcar todo el árbol como client.
 *
 * attribute="class" → next-themes agrega/quita la clase "dark" en <html>.
 * Tailwind darkMode: ['class'] ya está configurado para leerla.
 *
 * disableTransitionOnChange → evita el flash de transición de colores al cambiar
 * el tema, que en Tailwind se ve antinatural comparado con el toggle inmediato.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ToastProvider>
        {children}
      </ToastProvider>
    </ThemeProvider>
  );
}
