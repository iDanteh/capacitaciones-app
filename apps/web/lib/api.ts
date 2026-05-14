import axios from 'axios';

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
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request: adjunta access token ─────────────────────────────────────────────

api.interceptors.request.use((config) => {
  if (typeof window === 'undefined') return config;
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
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
        `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
        { refreshToken },
      );

      localStorage.setItem('access_token', data.accessToken);
      localStorage.setItem('refresh_token', data.refreshToken);
      api.defaults.headers.common.Authorization = `Bearer ${data.accessToken}`;
      original.headers.Authorization = `Bearer ${data.accessToken}`;

      flushQueue(null, data.accessToken);
      return api(original);
    } catch (refreshError) {
      flushQueue(refreshError);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      if (typeof window !== 'undefined') window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
