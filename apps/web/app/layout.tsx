import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'Capacitaciones — Plataforma de Aprendizaje Empresarial',
    template: '%s | Capacitaciones',
  },
  description:
    'Capacita a tu equipo de forma eficiente, mide el progreso y potencia el talento de tu empresa.',
  keywords: ['capacitación', 'e-learning', 'LMS', 'formación empresarial'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
