/**
 * socket.ts — Singleton de Socket.IO para notificaciones en tiempo real.
 *
 * El cliente se conecta al namespace `/notifications` en el mismo host que la API.
 * La autenticación usa el access_token JWT del usuario — el gateway lo verifica
 * y une al cliente a la room de su tenant para aislamiento multi-tenant.
 *
 * Patrón singleton: toda la app comparte una sola conexión, sin importar cuántos
 * componentes llamen a getSocket(). connectSocket / disconnectSocket gestionan
 * el ciclo de vida desde el layout del dashboard.
 */

import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api';

const API_HOST =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000')
    : 'http://localhost:5000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(`${API_HOST}/notifications`, {
      autoConnect:          false,
      transports:           ['websocket'],   // skip polling — más rápido
      reconnection:         true,
      reconnectionAttempts: 8,
      reconnectionDelay:    300,             // ms antes del primer reintento (era 2000)
      reconnectionDelayMax: 3000,            // cap de backoff exponencial
      timeout:              8000,            // timeout de handshake inicial
      forceNew:             false,           // reusar el singleton
    });

    // Log de ciclo de vida sólo en dev
    if (process.env.NODE_ENV === 'development') {
      socket.on('connect',           () => console.debug('[WS] conectado', socket?.id));
      socket.on('disconnect',        (r) => console.debug('[WS] desconectado:', r));
      socket.on('connect_error',     (e) => console.debug('[WS] error:', e.message));
      socket.on('reconnect_attempt', (n) => console.debug('[WS] reintento #' + n));
    }
  }
  return socket;
}

export function connectSocket(): void {
  if (typeof window === 'undefined') return;

  const token = getAccessToken();
  if (!token) return;

  const sock = getSocket();

  // Si el token cambió (p.ej. tras un refresh JWT), reconectar con el nuevo
  const currentToken = (sock.auth as { token?: string })?.token;
  if (currentToken && currentToken !== token && sock.connected) {
    sock.disconnect();
    sock.auth = { token };
    sock.connect();
    return;
  }

  sock.auth = { token };
  if (!sock.connected) sock.connect();
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null; // Forzar re-creación con nuevo token en la próxima sesión
}

/**
 * Actualiza el token JWT del socket activo sin cortar la conexión.
 * Llamar después de un refresh silencioso de access_token.
 */
export function refreshSocketToken(newToken: string): void {
  if (!socket) return;
  if ((socket.auth as { token?: string })?.token === newToken) return;

  socket.auth = { token: newToken };

  // Si está conectado, reconectar para que el servidor valide el nuevo token
  if (socket.connected) {
    socket.disconnect();
    socket.connect();
  }
}
