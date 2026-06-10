'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export interface TenantBranding {
  name:         string;
  logoUrl:      string | null;
  primaryColor: string | null;
  appName:      string | null;
}

const SLUG_RE = /^[a-z0-9-]{1,50}$/;

/**
 * Obtiene el branding público de un tenant por slug (sin autenticación).
 * Debouncea el fetch 400ms para no golpear la API en cada keystroke.
 * Retorna null mientras el slug es inválido o no existe.
 */
export function useTenantBranding(slug: string) {
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (!SLUG_RE.test(slug)) {
      setBranding(null);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      api
        .get<TenantBranding | null>(`/tenants/public/${slug}`)
        .then(r => setBranding(r.data ?? null))
        .catch(() => setBranding(null))
        .finally(() => setLoading(false));
    }, 400);

    return () => {
      clearTimeout(timer);
      setLoading(false);
    };
  }, [slug]);

  return { branding, loading };
}
