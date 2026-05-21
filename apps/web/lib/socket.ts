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

// Usar la misma base que la API REST, pero sin el prefijo /api/v1
// El gateway de Socket.IO no pasa por el versioning de NestJS.
const API_HOST =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000')
    : 'http://localhost:5000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(`${API_HOST}/notifications`, {
      autoConnect: false,
      transports:  ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
  }
  return socket;
}

export function connectSocket(): void {
  if (typeof window === 'undefined') return;

  const token = localStorage.getItem('access_token');
  if (!token) return; // No conectar si no hay sesión

  const sock = getSocket();
  // Actualizar auth en cada conexión para tener siempre el token más fresco
  sock.auth = { token };

  if (!sock.connected) sock.connect();
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null; // Forzar re-creación con nuevo token en la próxima sesión
}
