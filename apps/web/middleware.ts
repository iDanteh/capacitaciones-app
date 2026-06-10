/**
 * middleware.ts — Resolución de dominios personalizados por tenant.
 *
 * Cuando un usuario llega desde un dominio personalizado (ej: app.tuempresa.com),
 * este middleware resuelve qué tenant lo posee, guarda el slug en una cookie
 * JS-legible y deja pasar la request sin redirigir.
 *
 * El login page lee esa cookie para pre-llenar el campo de slug y mostrar el
 * branding del tenant sin que el usuario tenga que escribir nada.
 *
 * Cookie: tenant_domain_slug
 *   - Valor:  slug del tenant   (string)
 *   - Valor:  '__unknown__'     si el dominio no está registrado (TTL corto)
 *   - httpOnly: false — necesita ser leída por el JS del login page
 *   - TTL:    60 min para dominios conocidos, 5 min para desconocidos
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Hosts del dominio principal de la plataforma — nunca se resuelven como custom domains
const MAIN_HOSTS = new Set([
  'capacitaciones.app',
  'www.capacitaciones.app',
  'localhost',
  '127.0.0.1',
]);

const COOKIE_NAME    = 'tenant_domain_slug';
const KNOWN_MAX_AGE  = 60 * 60;   // 1 hora  — dominio conocido
const UNKNOWN_MAX_AGE = 60 * 5;   // 5 min   — dominio no registrado

function isMainHost(hostname: string): boolean {
  return (
    MAIN_HOSTS.has(hostname) ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.')      ||
    hostname === '::1'
  );
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const host     = request.headers.get('host') ?? '';
  const hostname = host.split(':')[0].toLowerCase();

  // 1. Dominio principal → pasar sin hacer nada
  if (isMainHost(hostname)) return NextResponse.next();

  // 2. Cookie cacheada → el dominio ya fue resuelto en esta sesión
  if (request.cookies.has(COOKIE_NAME)) return NextResponse.next();

  // 3. Resolver dominio → tenant a través del backend
  //    Usa API_INTERNAL_URL (Docker network) si está disponible,
  //    de lo contrario usa la URL pública configurada.
  const apiBase =
    process.env.API_INTERNAL_URL ??
    (process.env.NEXT_PUBLIC_API_URL?.startsWith('http')
      ? process.env.NEXT_PUBLIC_API_URL
      : null) ??
    'http://localhost:5000/api/v1';

  const response = NextResponse.next();

  try {
    const res = await fetch(
      `${apiBase}/tenants/public/domain/${encodeURIComponent(hostname)}`,
      { cache: 'no-store' },
    );

    if (res.ok) {
      const data = (await res.json()) as { slug: string };
      response.cookies.set(COOKIE_NAME, data.slug, {
        httpOnly: false,
        maxAge:   KNOWN_MAX_AGE,
        sameSite: 'lax',
        secure:   process.env.NODE_ENV === 'production',
        path:     '/',
      });
    } else {
      // Dominio no registrado — marcar para no volver a consultar pronto
      response.cookies.set(COOKIE_NAME, '__unknown__', {
        httpOnly: false,
        maxAge:   UNKNOWN_MAX_AGE,
        sameSite: 'lax',
        secure:   process.env.NODE_ENV === 'production',
        path:     '/',
      });
    }
  } catch {
    // Backend inalcanzable — dejar pasar sin cookie (reintentará en la próxima request)
  }

  return response;
}

export const config = {
  // Excluye assets estáticos de Next.js, favicons y archivos de raíz
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|robots\\.txt|sitemap\\.xml).*)',
  ],
};
