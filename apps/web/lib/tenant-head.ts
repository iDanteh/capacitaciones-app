/**
 * tenant-head.ts
 *
 * Utilidades client-side para actualizar dinámicamente el favicon y el
 * meta theme-color según el branding del tenant activo.
 *
 * Estrategia de favicon:
 *   - Si el tenant tiene logoUrl  → se usa esa URL como favicon
 *   - Si solo tiene primaryColor  → se genera un PNG 32x32 con la inicial y el color
 *   - Sin branding                → se restaura el favicon estático (/icon.svg)
 *
 * Se inserta un <link id="tenant-favicon"> al final del <head> para que tome
 * precedencia sobre el favicon estático que Next.js ya insertó; la restauración
 * simplemente remueve ese nodo.
 */

const DEFAULT_COLOR   = '#1E4F7A';
const DEFAULT_FAVICON = '/icon.svg';

export interface TenantHeadOptions {
  primaryColor?: string | null;
  logoUrl?:      string | null;
  appName?:      string | null;
  name?:         string | null;
}

function generateFaviconDataUrl(initial: string, color: string): string {
  const canvas = document.createElement('canvas');
  canvas.width  = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return DEFAULT_FAVICON;

  // Fondo con esquinas redondeadas
  const r = 7;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(32 - r, 0);
  ctx.quadraticCurveTo(32, 0, 32, r);
  ctx.lineTo(32, 32 - r);
  ctx.quadraticCurveTo(32, 32, 32 - r, 32);
  ctx.lineTo(r, 32);
  ctx.quadraticCurveTo(0, 32, 0, 32 - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  // Inicial centrada
  ctx.fillStyle    = '#FFFFFF';
  ctx.font         = 'bold 17px -apple-system, system-ui, sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initial, 16, 17);

  return canvas.toDataURL('image/png');
}

/** Aplica favicon y theme-color del tenant activo. */
export function applyTenantHead({ primaryColor, logoUrl, appName, name }: TenantHeadOptions): void {
  const color        = primaryColor || DEFAULT_COLOR;
  const platformName = appName || name || 'Capta';
  const initial      = platformName.charAt(0).toUpperCase();

  // ── 1. theme-color ────────────────────────────────────────────────────────
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = color;

  // ── 2. favicon ────────────────────────────────────────────────────────────
  // Elimina el nodo dinámico anterior (si existía) antes de reemplazarlo
  document.getElementById('tenant-favicon')?.remove();

  // Sin branding personalizado → dejar que el favicon estático de Next.js gane
  if (!logoUrl && !primaryColor) return;

  const link = document.createElement('link');
  link.id   = 'tenant-favicon';
  link.rel  = 'icon';

  if (logoUrl) {
    link.href = logoUrl;
    link.type = 'image/png';
  } else {
    link.href = generateFaviconDataUrl(initial, color);
    link.type = 'image/png';
  }

  document.head.appendChild(link);
}

/** Restaura favicon y theme-color por defecto (Capta). */
export function resetTenantHead(): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = DEFAULT_COLOR;

  // Eliminar nodo dinámico → el favicon estático de Next.js retoma el control
  document.getElementById('tenant-favicon')?.remove();
}
