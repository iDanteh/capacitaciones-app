'use client';

import { useEffect } from 'react';
import { getSocket, connectSocket } from '@/lib/socket';

// ─── Tipos de payload por evento ─────────────────────────────────────────────

export interface VideoReadyPayload {
  lessonId:      string;
  lessonTitle:   string;
  muxPlaybackId: string;
}

export interface EnrollmentCompletedPayload {
  userId:      string;
  courseId:    string;
  courseTitle: string;
}

export interface NewNotificationPayload {
  id:        string;
  type:      string;
  title:     string;
  body:      string;
  data:      Record<string, string> | null;
  readAt:    string | null;
  createdAt: string;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseNotificationsOptions {
  onVideoReady?:          (payload: VideoReadyPayload) => void;
  onEnrollmentCompleted?: (payload: EnrollmentCompletedPayload) => void;
  /** Se dispara cuando llega una notificación nueva vía WebSocket. */
  onNewNotification?:     (payload: NewNotificationPayload) => void;
}

/**
 * useNotifications — suscripción a eventos WebSocket del tenant y personales.
 *
 * El hook garantiza que:
 * 1. La conexión se establece solo si hay token de sesión.
 * 2. Los handlers se registran/desregistran limpiamente en el ciclo de vida.
 * 3. Múltiples componentes pueden usar el hook — todos comparten la misma conexión.
 *
 * @example
 *   useNotifications({
 *     onVideoReady: ({ lessonId, lessonTitle }) => {
 *       toast.success(`"${lessonTitle}" está listo para reproducirse`);
 *     },
 *     onNewNotification: (n) => {
 *       toast.info(n.title);
 *     },
 *   });
 */
export function useNotifications({
  onVideoReady,
  onEnrollmentCompleted,
  onNewNotification,
}: UseNotificationsOptions = {}): void {
  useEffect(() => {
    connectSocket(); // No-op si ya está conectado o si no hay token

    const sock = getSocket();

    if (onVideoReady)          sock.on('video.ready',           onVideoReady);
    if (onEnrollmentCompleted) sock.on('enrollment.completed',  onEnrollmentCompleted);
    if (onNewNotification)     sock.on('notification.new',      onNewNotification);

    return () => {
      // Limpieza precisa: solo remover los handlers de ESTA instancia del hook,
      // sin afectar a otros componentes que también estén suscritos.
      if (onVideoReady)          sock.off('video.ready',          onVideoReady);
      if (onEnrollmentCompleted) sock.off('enrollment.completed', onEnrollmentCompleted);
      if (onNewNotification)     sock.off('notification.new',     onNewNotification);
    };
  // Los handlers deben ser estables (definidos con useCallback en el componente padre).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
