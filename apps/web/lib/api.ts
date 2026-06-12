import axios from 'axios';
import { refreshSocketToken } from './socket';

/**
 * Instancia de Axios preconfigurada para comunicarse con el API.
 *
 * Seguridad de tokens:
 *   - access_token  → variable de módulo en memoria (no localStorage/cookie)
 *                     XSS no puede robarlo entre recargas; expira en 15 min.
 *   - refresh_token → cookie httpOnly `__rt` gestionada por el servidor.
 *                     JS nunca puede leerla ni robarla via XSS.
 *
 * Interceptores:
 *   1. Request  → adjunta el access token desde memoria.
 *   2. Response → ante 401, llama /auth/refresh (cookie __rt enviada
 *                 automáticamente). Si falla, limpia estado y redirige a /login.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

// ── Access token en memoria ───────────────────────────────────────────────────

let _accessToken: string | null = null;

export function setAccessToken(token: string): void  { _accessToken = token; }
export function clearAccessToken(): void             { _accessToken = null; }
export function getAccessToken(): string | null      { return _accessToken; }

/**
 * Llama a /auth/refresh usando la cookie __rt para obtener un nuevo access token.
 * Debe invocarse al montar el layout protegido tras una recarga de página,
 * ya que el access token no sobrevive recargas (está en memoria, no en localStorage).
 * Retorna true si la hidratación fue exitosa.
 */
export async function hydrateFromCookie(): Promise<boolean> {
  try {
    const { data } = await axios.post<{ accessToken: string }>(
      `${API_BASE}/auth/refresh`,
      {},
      { withCredentials: true },
    );
    setAccessToken(data.accessToken);
    return true;
  } catch {
    return false;
  }
}

// ── Instancia Axios ───────────────────────────────────────────────────────────

export const api = axios.create({
  baseURL:         API_BASE,
  headers:         { 'Content-Type': 'application/json' },
  withCredentials: true, // Envía cookies httpOnly (__rt) en cada request
});

// ── Request: adjunta access token y tenant slug ───────────────────────────────

api.interceptors.request.use((config) => {
  if (typeof window === 'undefined') return config;
  const token = _accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const tenantSlug = localStorage.getItem('tenant_slug');
  if (tenantSlug) config.headers['X-Tenant-Slug'] = tenantSlug;
  return config;
});

// ── Response: renovación silenciosa de tokens ─────────────────────────────────

let isRefreshing = false;
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

const flushQueue = (error: unknown, token: string | null = null) => {
  pendingQueue.forEach((p) => (token ? p.resolve(token) : p.reject(error)));
  pendingQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthRoute =
      original?.url?.includes('/auth/refresh') ||
      original?.url?.includes('/auth/login')   ||
      original?.url?.includes('/auth/logout')  ||
      original?.url?.includes('/auth/restore-parent');

    if (error.response?.status !== 401 || original?._retry || isAuthRoute) {
      return Promise.reject(error);
    }

    original._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: (token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          },
          reject,
        });
      });
    }

    isRefreshing = true;

    try {
      // Cookie __rt se envía automáticamente gracias a withCredentials: true
      const { data } = await axios.post<{ accessToken: string }>(
        `${API_BASE}/auth/refresh`,
        {},
        { withCredentials: true },
      );

      setAccessToken(data.accessToken);
      api.defaults.headers.common.Authorization = `Bearer ${data.accessToken}`;
      original.headers.Authorization = `Bearer ${data.accessToken}`;

      try { refreshSocketToken(data.accessToken); } catch { /* socket no inicializado */ }

      flushQueue(null, data.accessToken);
      return api(original);
    } catch (refreshError) {
      flushQueue(refreshError);
      clearAccessToken();
      localStorage.removeItem('tenant_slug');
      localStorage.removeItem('user');
      localStorage.removeItem('tenant_logo');
      localStorage.removeItem('tenant_name');
      localStorage.removeItem('tenant_color');
      localStorage.removeItem('tenant_appname');
      localStorage.removeItem('parent_session');
      if (typeof window !== 'undefined') window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
