/**
 * CaptaIcon — sistema de íconos propio de Capta.
 *
 * Todos los paths provienen de Capta-Kit (24×24, stroke 1.6, round caps/joins).
 * Los íconos marcados como "extra" son complementos para funcionalidades
 * que no tienen equivalente en el kit (logout, refresh, credit-card, etc.)
 */

import React from 'react';

// ─── Catálogo de íconos ──────────────────────────────────────────────────────

const icons = {
  // ── Navegación ──────────────────────────────────────────────────────────────
  home: (
    <>
      <path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-3v-7h-8v7H5a2 2 0 0 1-2-2v-9z" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.8" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8" />
    </>
  ),
  menu: (
    <path d="M4 7h16M4 12h16M4 17h16" />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.5-4.5" />
    </>
  ),
  plus: (
    <path d="M12 5v14M5 12h14" />
  ),
  minus: (
    <path d="M5 12h14" />
  ),
  chevron: (
    <path d="m6 9 6 6 6-6" />
  ),
  'chevron-down': (
    <path d="m6 9 6 6 6-6" />
  ),
  'chevron-up': (
    <path d="m6 15 6-6 6 6" />
  ),
  'chevron-left': (
    <path d="m15 6-6 6 6 6" />
  ),
  'chevron-right': (
    <path d="m9 6 6 6-6 6" />
  ),
  'arrow-right': (
    <path d="M4 12h16M13 5l7 7-7 7" />
  ),
  'arrow-left': (
    <path d="M20 12H4M11 19l-7-7 7-7" />
  ),
  'arrow-up-right': (
    <path d="M7 17 17 7M7 7h10v10" />
  ),
  close: (
    <path d="M6 6l12 12M6 18 18 6" />
  ),
  external: (
    <>
      <path d="M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
      <path d="M15 3h6v6M10 14 21 3" />
    </>
  ),
  'external-link': (
    <>
      <path d="M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
      <path d="M15 3h6v6M10 14 21 3" />
    </>
  ),

  // ── Contenido ───────────────────────────────────────────────────────────────
  book: (
    <>
      <path d="M4 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16l-7-3-7 3V4z" />
    </>
  ),
  'book-open': (
    <path d="M3 5a2 2 0 0 1 2-2h6v18H5a2 2 0 0 1-2-2V5zm10-2h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6V3z" />
  ),
  video: (
    <>
      <rect x="2" y="6" width="14" height="13" rx="2" />
      <path d="m16 10 6-3v10l-6-3" />
    </>
  ),
  play: (
    <path d="M7 5v14a1 1 0 0 0 1.5.87l12-7a1 1 0 0 0 0-1.74l-12-7A1 1 0 0 0 7 5z" fill="currentColor" stroke="none" />
  ),
  file: (
    <>
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M13 2v7h7" />
    </>
  ),
  folder: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </>
  ),
  download: (
    <path d="M12 3v13M5 12l7 7 7-7M3 21h18" />
  ),
  upload: (
    <path d="M12 21V8M5 12l7-7 7 7M3 3h18" />
  ),
  trash: (
    <>
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),

  // ── Personas ────────────────────────────────────────────────────────────────
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.5 20c.8-3.2 3.2-5.2 6.5-5.2s5.7 2 6.5 5.2" />
      <circle cx="17" cy="9" r="2.8" />
      <path d="M21.5 18.5c-.6-2.4-2-3.8-4-4.5" />
    </>
  ),
  'user-plus': (
    <>
      <circle cx="10" cy="8" r="4" />
      <path d="M2 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      <path d="M18 13v6M21 16h-6" />
    </>
  ),
  'user-minus': (
    <>
      <circle cx="10" cy="8" r="4" />
      <path d="M2 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      <path d="M21 16h-6" />
    </>
  ),
  'user-cog': (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21c1.5-4 4.5-6 8-6" />
      <circle cx="19" cy="18" r="2" />
      <path d="M19 14v2M19 20v2M15.5 15.5l1.4 1.4M21.1 20.6l1.4 1.4M14 18h2M22 18h2M15.5 20.5l1.4-1.4M21.1 15.4l1.4-1.4" strokeWidth="1.4" />
    </>
  ),

  // ── Datos ───────────────────────────────────────────────────────────────────
  'chart-bar': (
    <>
      <path d="M4 19V5M4 19h16" />
      <rect x="7" y="11" width="3" height="8" rx="1" />
      <rect x="12" y="7" width="3" height="12" rx="1" />
      <rect x="17" y="13" width="3" height="6" rx="1" />
    </>
  ),
  'chart-line': (
    <>
      <path d="M4 19V5M4 19h16M7 15l3-4 3 2 4-6 3 4" />
    </>
  ),

  // ── Logros ──────────────────────────────────────────────────────────────────
  certificate: (
    <>
      <circle cx="12" cy="9" r="5.5" />
      <path d="m9 13.5-2 7 5-3 5 3-2-7" />
    </>
  ),
  star: (
    <path d="m12 3 2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.1l-6 3.1 1.3-6.6L2.5 9l6.6-.9z" />
  ),
  check: (
    <path d="M5 12.5 9.2 17 19 7" />
  ),
  shield: (
    <>
      <path d="M12 3 4 6v6c0 4.5 3.2 8.3 8 9.4 4.8-1.1 8-4.9 8-9.4V6l-8-3z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),

  // ── Sistema ─────────────────────────────────────────────────────────────────
  bell: (
    <>
      <path d="M6 10a6 6 0 0 1 12 0c0 4 2 5 2 5H4s2-1 2-5" />
      <path d="M9.5 20a2.5 2.5 0 0 0 5 0" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1.5v3M12 19.5v3M5.6 5.6 7.7 7.7M16.3 16.3l2.1 2.1M1.5 12h3M19.5 12h3M5.6 18.4 7.7 16.3M16.3 7.7l2.1-2.1" />
      <circle cx="12" cy="12" r="9" strokeDasharray="1.4 2.2" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4" />
    </>
  ),
  moon: (
    <path d="M20 14.5A8 8 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.2 2" />
    </>
  ),
  sparkle: (
    <path d="M12 3 13.6 7 18 8.2 14 10 12 14 10 10 6 8.2 10.2 7zM18 14l1 2.5L21.5 18l-2.5 1L18 21.5 17 19 14.5 18l2.5-1z" />
  ),
  heart: (
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1a5.5 5.5 0 0 0-7.8 7.7L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z" />
  ),
  message: (
    <>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </>
  ),
  wave: (
    <path d="M2 12c1.5-3 3-4.5 4.5-4.5S9 9 10.5 9s3-1.5 4.5-1.5S18 9 19.5 9 21 7.5 22 6" />
  ),
  route: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M6 8.5v4a4 4 0 0 0 4 4h4" />
    </>
  ),
  lightning: (
    <path d="M13 2 4.5 13H12l-1 9L21 11h-7.5z" fill="currentColor" stroke="none" />
  ),

  // ── Extras (no incluidos en el kit original) ────────────────────────────────
  edit: (
    <>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M2 12h20M12 2a15.4 15.4 0 0 1 4 10 15.4 15.4 0 0 1-4 10 15.4 15.4 0 0 1-4-10 15.4 15.4 0 0 1 4-10z" />
    </>
  ),
  archive: (
    <>
      <rect x="2" y="4" width="20" height="5" rx="1" />
      <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
      <path d="M10 13h4" />
    </>
  ),
  save: (
    <>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8M7 3v5h8" />
    </>
  ),
  'grip-vertical': (
    <>
      <circle cx="9" cy="5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="19" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="19" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  eye: (
    <>
      <path d="M1 12C3 6 7 3 12 3s9 3 11 9c-2 6-6 9-11 9S3 18 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  circle: (
    <circle cx="12" cy="12" r="9" />
  ),
  award: (
    <>
      <circle cx="12" cy="8" r="6" />
      <path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </>
  ),
  refresh: (
    <>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </>
  ),
  'credit-card': (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M7 15h4" />
    </>
  ),
  trending: (
    <path d="M22 7l-9.5 9.5-4-4L2 19M22 7h-6M22 7v6" />
  ),
  filter: (
    <path d="M4 4h16M7 10h10M10 16h4" />
  ),
  'more-horizontal': (
    <>
      <circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  'more-vertical': (
    <>
      <circle cx="12" cy="5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 7 10-7" />
    </>
  ),
  'alert-circle': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </>
  ),
  infinity: (
    <path d="M12 12c-2-2.5-4-4-6-4a4 4 0 0 0 0 8c2 0 4-1.5 6-4zm0 0c2 2.5 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.5-6 4z" />
  ),
  'hard-drive': (
    <>
      <rect x="2" y="14" width="20" height="7" rx="2" />
      <path d="M2 14l2-9h16l2 9" />
      <circle cx="6.5" cy="17.5" r="1" fill="currentColor" stroke="none" />
      <path d="M11 17.5h6" />
    </>
  ),
  package: (
    <>
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  zap: (
    <path d="M13 2 4.5 13H12l-1 9L21 11h-7.5z" />
  ),
  'x-circle': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-6 6M9 9l6 6" />
    </>
  ),
  'check-circle': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 5-5" />
    </>
  ),
  'alert-triangle': (
    <>
      <path d="M10.3 4 2 20h20L13.7 4a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
  'pin': (
    <>
      <path d="M12 2a5 5 0 0 1 5 5c0 4-5 10-5 10S7 11 7 7a5 5 0 0 1 5-5z" />
      <circle cx="12" cy="7" r="1.8" />
    </>
  ),
};

export type IconName = keyof typeof icons;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

/**
 * Componente de ícono del sistema Capta.
 * Renderiza SVGs inline del Capta-Kit con stroke 1.6 por defecto.
 */
export function Icon({ name, size = 18, className = '', strokeWidth = 1.6, style }: IconProps) {
  const content = icons[name];
  if (!content) return null;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {content}
    </svg>
  );
}
