import type { Metadata, Viewport } from 'next';
import { Geist, DM_Serif_Display } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

const dmSerif = DM_Serif_Display({
  weight: ['400'],
  subsets: ['latin'],
  variable: '--font-dm-serif',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#1E4F7A',
};

export const metadata: Metadata = {
  title: 'Capta',
  description:
    'Capacita a tu equipo de forma eficiente, mide el progreso y potencia el talento de tu empresa.',
  keywords: ['capacitación', 'e-learning', 'LMS', 'formación empresarial', 'Capta'],
  icons: {
    icon: [
      { url: '/icon', type: 'image/png' },           // generado por icon.tsx (PNG — Safari, iOS, todos)
      { url: '/icon.svg', type: 'image/svg+xml' },   // SVG para Chrome/Firefox
    ],
    shortcut: '/icon',
    apple:    '/icon',
    other: [
      { rel: 'mask-icon', url: '/icon.svg', color: '#0B2840' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={`${geist.variable} ${dmSerif.variable}`}>
      <body className={`${geist.className} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
