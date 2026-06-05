import axios from 'axios';
import { refreshSocketToken } from './socket';

/**
 * Instancia de Axios preconfigurada para comunicarse con el API.
 *
 * BaseURL apunta a /api/v1 — los endpoints se usan sin prefijo:
 *   api.post('/auth/login', data)  →  POST {API_URL}/auth/login
 *
 * Interceptores:
 *   1. Request  → adjunta el access token desde localStorage.
 *   2. Response → ante 401, renueva el par de tokens con el refresh token
 *                 almacenado. Si falla, limpia y redirige a /login.
 *                 Los requests concurrentes se encolan para no lanzar
 *                 múltiples refreshes en paralelo.
 */
// Fallback a localhost para que la app funcione sin configurar NEXT_PUBLIC_API_URL en dev.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request: adjunta access token y tenant slug ───────────────────────────────

api.interceptors.request.use((config) => {
  if (typeof window === 'undefined') return config;
  const token = localStorage.getItem('access_token');
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
      original?.url?.includes('/auth/login');

    if (error.response?.status !== 401 || original?._retry || isAuthRoute) {
      return Promise.reject(error);
    }

    original._retry = true;

    // Si ya hay un refresh en vuelo, encolar este request
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
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) throw new Error('No refresh token available');

      // El endpoint /auth/refresh espera { refreshToken } en el body
      const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
        `${API_BASE}/auth/refresh`,
        { refreshToken },
      );

      localStorage.setItem('access_token', data.accessToken);
      localStorage.setItem('refresh_token', data.refreshToken);
      api.defaults.headers.common.Authorization = `Bearer ${data.accessToken}`;
      original.headers.Authorization = `Bearer ${data.accessToken}`;

      // Actualizar el socket con el nuevo token — si estaba conectado, reconecta
      // inmediatamente para que el gateway valide las nuevas credenciales.
      try { refreshSocketToken(data.accessToken); } catch { /* socket no inicializado */ }

      flushQueue(null, data.accessToken);
      return api(original);
    } catch (refreshError) {
      flushQueue(refreshError);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('tenant_slug');
      localStorage.removeItem('user');
      if (typeof window !== 'undefined') window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
