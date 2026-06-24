'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, type IconName } from '@/components/capta-icon';
import { api } from '@/lib/api';
import { getSocket, connectSocket } from '@/lib/socket';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface NotifData {
  courseId?:      string;
  lessonId?:      string;
  evaluationId?:  string;
  quizId?:        string;
  assignmentId?:  string;
  userId?:        string;
  studentName?:   string;
  courseTitle?:   string;
}

interface Notification {
  id:        string;
  type:      string;
  title:     string;
  body:      string;
  data:      NotifData | null;
  readAt:    string | null;
  createdAt: string;
}

interface NotificationListResponse {
  notifications: Notification[];
  unreadCount:   number;
}

// ─── Mapas de icono y color por tipo ─────────────────────────────────────────

const ICON: Record<string, IconName> = {
  RESET_REQUEST:    'refresh',
  ENROLLMENT:       'users',
  COURSE_COMPLETED: 'check-circle',
  VIDEO_READY:      'video',
  RESET_APPROVED:   'check',
  RESET_DENIED:     'close',
  QUIZ_ASSIGNED:    'clipboard',
  QUIZ_COMPLETED:   'check-circle',
};

const COLOR: Record<string, string> = {
  RESET_REQUEST:    '#f59e0b',
  ENROLLMENT:       '#1E4F7A',
  COURSE_COMPLETED: '#16a34a',
  VIDEO_READY:      '#8b5cf6',
  RESET_APPROVED:   '#16a34a',
  RESET_DENIED:     '#ef4444',
  QUIZ_ASSIGNED:    '#ea580c',  // naranja — visualmente distinto del resto
  QUIZ_COMPLETED:   '#0891b2',  // cyan para el admin que recibe el resultado
};

// ─── URL de navegación al hacer click en la notificación ─────────────────────

function getUrl(n: Notification): string {
  const d = n.data;
  switch (n.type) {
    case 'RESET_REQUEST':
      return d?.courseId
        ? `/dashboard/courses/${d.courseId}?lesson=${d.lessonId ?? ''}&tab=evaluation`
        : '/dashboard/courses';
    case 'ENROLLMENT':
    case 'COURSE_COMPLETED':
      return d?.courseId ? `/dashboard/courses/${d.courseId}` : '/dashboard/courses';
    case 'VIDEO_READY':
      return d?.courseId
        ? `/dashboard/courses/${d.courseId}?lesson=${d.lessonId ?? ''}`
        : '/dashboard/courses';
    case 'RESET_APPROVED':
    case 'RESET_DENIED':
      return d?.courseId ? `/dashboard/courses/${d.courseId}/learn` : '/dashboard/courses';
    case 'QUIZ_ASSIGNED':
      return '/dashboard'; // QuizLockdown interceptará automáticamente
    case 'QUIZ_COMPLETED':
      return d?.quizId ? `/dashboard/quizzes/${d.quizId}` : '/dashboard/quizzes';
    default:
      return '/dashboard';
  }
}

// ─── Tiempo relativo ─────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min  = Math.floor(diff / 60_000);
  if (min < 1)   return 'Ahora mismo';
  if (min < 60)  return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)    return `Hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)     return `Hace ${d}d`;
  return new Date(dateStr).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function NotificationBell() {
  const router = useRouter();

  const [open,          setOpen]          = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(false);
  const [panelPos,      setPanelPos]      = useState({ top: 0, right: 0 });
  // mounted flag necesario para que createPortal funcione solo en el cliente
  const [mounted,       setMounted]       = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef  = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // ── Fetch inicial ──
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<NotificationListResponse>('/notifications?limit=25');
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // ── WebSocket en tiempo real ──
  useEffect(() => {
    connectSocket();
    const sock = getSocket();

    const handleNew = (n: Notification) => {
      setNotifications(prev => [n, ...prev].slice(0, 25));
      setUnreadCount(c => c + 1);
    };

    sock.on('notification.new', handleNew);
    return () => { sock.off('notification.new', handleNew); };
  }, []);

  // ── Cerrar al hacer click fuera ──
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current  && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ── Recalcular posición al hacer scroll o resize ──
  useEffect(() => {
    if (!open) return;
    const recalc = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      setPanelPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    };
    window.addEventListener('scroll',  recalc, true);
    window.addEventListener('resize',  recalc);
    return () => {
      window.removeEventListener('scroll',  recalc, true);
      window.removeEventListener('resize',  recalc);
    };
  }, [open]);

  // ── Marcar todas como leídas ──
  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, readAt: new Date().toISOString() })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  // ── Click en notificación ──
  const handleClick = async (n: Notification) => {
    if (!n.readAt) {
      try {
        await api.patch(`/notifications/${n.id}/read`);
        setNotifications(prev =>
          prev.map(x => x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x),
        );
        setUnreadCount(c => Math.max(0, c - 1));
      } catch { /* silent */ }
    }
    setOpen(false);
    router.push(getUrl(n));
  };

  // ── Panel JSX (se renderizará en portal) ──
  const panel = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className="rounded-2xl border border-border bg-card overflow-hidden"
          style={{
            position:  'fixed',
            top:       panelPos.top,
            right:     panelPos.right,
            zIndex:    9999,            // por encima de absolutamente todo
            width:     360,
            maxWidth:  'calc(100vw - 1.5rem)',
            boxShadow: '0 12px 48px rgba(11,31,42,0.18), 0 4px 12px rgba(11,31,42,0.08)',
          }}
        >
          {/* Cabecera */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Notificaciones</h3>
              {unreadCount > 0 && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
                >
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Marcar todo leído
                </button>
              )}
              <button
                onClick={fetchNotifications}
                className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Actualizar"
              >
                <Icon name="refresh" size={12} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="max-h-[420px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <div
                  className="h-5 w-5 animate-spin rounded-full border-2 border-transparent"
                  style={{ borderTopColor: '#1E4F7A', borderRightColor: '#8FC4E820' }}
                />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-muted">
                  <Icon name="bell" size={18} className="text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-foreground">Todo al día</p>
                <p className="mt-0.5 text-xs text-muted-foreground">No tienes notificaciones nuevas</p>
              </div>
            ) : (
              <div>
                {notifications.map((n, i) => {
                  const iconName = ICON[n.type]  ?? 'bell';
                  const color    = COLOR[n.type] ?? '#1E4F7A';
                  const isUnread = !n.readAt;

                  return (
                    <button
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={[
                        'w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors',
                        'hover:bg-muted/50 active:bg-muted',
                        i < notifications.length - 1 ? 'border-b border-border/60' : '',
                        isUnread ? 'bg-capta-tint/30 dark:bg-capta-soft/5' : '',
                      ].join(' ')}
                    >
                      {/* Ícono del tipo */}
                      <div
                        className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl"
                        style={{ background: `${color}18`, color }}
                      >
                        <Icon name={iconName} size={14} />
                      </div>

                      {/* Contenido */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs leading-snug ${isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
                            {n.title}
                          </p>
                          {isUnread && (
                            <div
                              className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full"
                              style={{ background: color }}
                            />
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {n.body}
                        </p>
                        <p className="mt-1.5 tabular-nums text-[10px] text-muted-foreground/50">
                          {relativeTime(n.createdAt)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-border px-4 py-2.5">
              <button
                onClick={fetchNotifications}
                className="w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Actualizar notificaciones
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="relative">

      {/* Botón de campana */}
      <button
        ref={buttonRef}
        onClick={() => {
          if (!open && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setPanelPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
          }
          setOpen(o => !o);
        }}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground/60 transition-all hover:border-capta-deep/20 hover:bg-muted hover:text-foreground"
        aria-label="Notificaciones"
      >
        <Icon name="bell" size={14} />

        {/* Badge de no leídas */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Panel en portal — escapa todo stacking context (backdrop-blur, transform, etc.) */}
      {mounted && createPortal(panel, document.body)}
    </div>
  );
}
