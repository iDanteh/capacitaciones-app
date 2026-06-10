import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#1E4F7A',
};

export const metadata: Metadata = {
  title: {
    default: 'Capta',
    template: '%s — Capta',
  },
  description:
    'Capacita a tu equipo de forma eficiente, mide el progreso y potencia el talento de tu empresa.',
  keywords: ['capacitación', 'e-learning', 'LMS', 'formación empresarial', 'Capta'],
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/icon.svg',
    apple:    '/icon.svg',
    other: [
      { rel: 'mask-icon', url: '/icon.svg', color: '#0B2840' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={geist.variable}>
      <body className={`${geist.className} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
