'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, type IconName } from '@/components/capta-icon';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CourseResult {
  id:           string;
  title:        string;
  status:       string;
  thumbnailUrl: string | null;
  totalLessons: number;
}

interface UserResult {
  id:        string;
  name:      string;
  email:     string;
  role:      string;
  avatarUrl: string | null;
}

interface CertResult {
  id:            string;
  publicUuid:    string;
  recipientName: string;
  courseTitle:   string;
  issuedAt:      string;
}

interface SearchResults {
  query:        string;
  courses:      CourseResult[];
  users:        UserResult[];
  certificates: CertResult[];
}

// Item aplanado para navegación con teclado
interface FlatItem {
  id:    string;
  href:  string;
  label: string;
  sub:   string;
}

// ─── Quick actions (estado vacío) ─────────────────────────────────────────────

const QUICK_ACTIONS_ADMIN: { label: string; sub: string; icon: IconName; href: string }[] = [
  { label: 'Inicio',        sub: 'Dashboard principal',     icon: 'home',        href: '/dashboard' },
  { label: 'Cursos',        sub: 'Gestión de cursos',       icon: 'book-open',   href: '/dashboard/courses' },
  { label: 'Equipos',       sub: 'Usuarios y empleados',    icon: 'users',       href: '/dashboard/users' },
  { label: 'Analíticas',    sub: 'Métricas y reportes',     icon: 'chart-bar',   href: '/dashboard/analytics' },
  { label: 'Configuración', sub: 'Ajustes de empresa',      icon: 'gear',        href: '/dashboard/settings' },
  { label: 'Mi perfil',     sub: 'Información personal',    icon: 'user',        href: '/dashboard/profile' },
];

const QUICK_ACTIONS_EMPLOYEE: { label: string; sub: string; icon: IconName; href: string }[] = [
  { label: 'Inicio',       sub: 'Mi dashboard',              icon: 'home',      href: '/dashboard' },
  { label: 'Cursos',       sub: 'Catálogo de capacitación',  icon: 'book-open', href: '/dashboard/courses' },
  { label: 'Mi perfil',    sub: 'Información personal',      icon: 'user',      href: '/dashboard/profile' },
];

// ─── Rol label ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  OWNER:    'Propietario',
  ADMIN:    'Admin',
  MANAGER:  'Manager',
  EMPLOYEE: 'Empleado',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PUBLISHED: { label: 'Publicado', color: '#059669' },
  DRAFT:     { label: 'Borrador',  color: '#D97706' },
  ARCHIVED:  { label: 'Archivado', color: '#6B7280' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
        {label}
      </span>
      <span className="text-[10px] text-muted-foreground/40">{count}</span>
    </div>
  );
}

function ResultItem({
  icon, accent, title, sub, badge, active, onClick,
}: {
  icon:    IconName;
  accent:  string;
  title:   string;
  sub:     string;
  badge?:  string;
  active:  boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
        active ? 'bg-muted' : 'hover:bg-muted/60'
      }`}
    >
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${accent}15`, color: accent }}
      >
        <Icon name={icon} size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground/70">{sub}</p>
      </div>
      {badge && (
        <span className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
          style={{ background: accent }}>
          {badge}
        </span>
      )}
      <Icon name="arrow-right" size={12} className="flex-shrink-0 text-muted-foreground/30" />
    </button>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
      <div className="h-8 w-8 rounded-lg bg-muted flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-muted rounded w-3/5" />
        <div className="h-2.5 bg-muted rounded w-2/5" />
      </div>
    </div>
  );
}

// ─── Command Palette ──────────────────────────────────────────────────────────

export function CommandPalette({
  isOpen,
  onClose,
  userRole,
}: {
  isOpen:   boolean;
  onClose:  () => void;
  userRole: string;
}) {
  const router   = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState<SearchResults | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const isAdmin = ['OWNER', 'ADMIN', 'MANAGER'].includes(userRole);
  const quickActions = isAdmin ? QUICK_ACTIONS_ADMIN : QUICK_ACTIONS_EMPLOYEE;

  // Reset + focus al abrir
  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setResults(null);
    setLoading(false);
    setActiveIndex(-1);
    const id = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [isOpen]);

  // Debounced search: 300ms tras dejar de escribir
  useEffect(() => {
    if (query.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get<SearchResults>('/search', { params: { q: query } });
        setResults(data);
        setActiveIndex(-1);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Flatten results for keyboard nav
  const flatItems: FlatItem[] = results
    ? [
        ...results.courses.map(r => ({
          id:    r.id,
          href:  isAdmin ? `/dashboard/courses/${r.id}` : `/dashboard/courses/${r.id}/learn`,
          label: r.title,
          sub:   r.status,
        })),
        ...results.users.map(r => ({
          id:    r.id,
          href:  '/dashboard/users',
          label: r.name,
          sub:   r.email,
        })),
        ...results.certificates.map(r => ({
          id:    r.id,
          href:  `/certificates/verify/${r.publicUuid}`,
          label: r.recipientName,
          sub:   r.courseTitle,
        })),
      ]
    : [];

  const navigate = useCallback((href: string) => {
    router.push(href);
    onClose();
  }, [router, onClose]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const maxIdx = (results ? flatItems.length : quickActions.length) - 1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => (i < maxIdx ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => (i > 0 ? i - 1 : maxIdx));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results) {
        if (activeIndex >= 0 && flatItems[activeIndex]) {
          navigate(flatItems[activeIndex].href);
        }
      } else {
        if (activeIndex >= 0 && quickActions[activeIndex]) {
          navigate(quickActions[activeIndex].href);
        }
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const totalResults = results
    ? results.courses.length + results.users.length + results.certificates.length
    : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />

          {/* Panel — wrapper handles positioning, motion.div handles animation only */}
          <div className="fixed left-1/2 top-[12%] z-50 w-full max-w-xl -translate-x-1/2 px-4 sm:px-0">
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.97, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -12 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <div
              className="overflow-hidden rounded-2xl border border-border bg-card"
              style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.6) inset' }}
            >

              {/* ── Input ── */}
              <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
                <Icon
                  name={loading ? 'refresh' : 'search'}
                  size={16}
                  className={`flex-shrink-0 text-muted-foreground/60 ${loading ? 'animate-spin' : ''}`}
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Buscar cursos, personas, certificados..."
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                />
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {query && (
                    <button
                      type="button"
                      onClick={() => { setQuery(''); setResults(null); inputRef.current?.focus(); }}
                      className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 hover:text-foreground transition-colors"
                    >
                      <Icon name="close" size={12} />
                    </button>
                  )}
                  <kbd className="flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/50">
                    ESC
                  </kbd>
                </div>
              </div>

              {/* ── Body ── */}
              <div className="max-h-[60vh] overflow-y-auto py-2">

                {/* Loading skeletons */}
                {loading && (
                  <div>
                    {[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}
                  </div>
                )}

                {/* Results */}
                {!loading && results && (
                  <>
                    {totalResults === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <Icon name="search" size={28} className="text-muted-foreground/20 mb-2" />
                        <p className="text-sm font-medium text-muted-foreground">
                          Sin resultados para &quot;{results.query}&quot;
                        </p>
                        <p className="text-xs text-muted-foreground/50 mt-1">
                          Intenta con otra palabra o revisa la ortografía.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Cursos */}
                        {results.courses.length > 0 && (
                          <div>
                            <SectionLabel label="Cursos" count={results.courses.length} />
                            {results.courses.map((c, i) => {
                              const globalIdx = i;
                              const st = STATUS_LABELS[c.status] ?? { label: c.status, color: '#6B7280' };
                              return (
                                <ResultItem
                                  key={c.id}
                                  icon="book-open"
                                  accent="#1E4F7A"
                                  title={c.title}
                                  sub={`${c.totalLessons} lecciones`}
                                  badge={st.label}
                                  active={activeIndex === globalIdx}
                                  onClick={() => navigate(
                                    isAdmin
                                      ? `/dashboard/courses/${c.id}`
                                      : `/dashboard/courses/${c.id}/learn`
                                  )}
                                />
                              );
                            })}
                          </div>
                        )}

                        {/* Usuarios (solo admin) */}
                        {results.users.length > 0 && (
                          <div className={results.courses.length > 0 ? 'mt-1 border-t border-border pt-1' : ''}>
                            <SectionLabel label="Personas" count={results.users.length} />
                            {results.users.map((u, i) => {
                              const globalIdx = results.courses.length + i;
                              const initials  = u.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                              return (
                                <ResultItem
                                  key={u.id}
                                  icon="user"
                                  accent="#7C3AED"
                                  title={u.name}
                                  sub={u.email}
                                  badge={ROLE_LABELS[u.role] ?? u.role}
                                  active={activeIndex === globalIdx}
                                  onClick={() => navigate('/dashboard/users')}
                                />
                              );
                            })}
                          </div>
                        )}

                        {/* Certificados */}
                        {results.certificates.length > 0 && (
                          <div className={(results.courses.length + results.users.length) > 0 ? 'mt-1 border-t border-border pt-1' : ''}>
                            <SectionLabel label="Certificados" count={results.certificates.length} />
                            {results.certificates.map((c, i) => {
                              const globalIdx = results.courses.length + results.users.length + i;
                              const date      = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(c.issuedAt));
                              return (
                                <ResultItem
                                  key={c.id}
                                  icon="certificate"
                                  accent="#F59E0B"
                                  title={c.recipientName}
                                  sub={c.courseTitle}
                                  badge={date}
                                  active={activeIndex === globalIdx}
                                  onClick={() => navigate(`/certificates/verify/${c.publicUuid}`)}
                                />
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

                {/* Quick actions (query vacío o < 2 chars) */}
                {!loading && !results && (
                  <div>
                    <SectionLabel label="Accesos rápidos" count={0} />
                    {quickActions.map((action, i) => (
                      <ResultItem
                        key={action.href}
                        icon={action.icon}
                        accent="#1E4F7A"
                        title={action.label}
                        sub={action.sub}
                        active={activeIndex === i}
                        onClick={() => navigate(action.href)}
                      />
                    ))}
                  </div>
                )}

              </div>

              {/* ── Footer ── */}
              <div className="flex items-center justify-between border-t border-border px-4 py-2">
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground/40">
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">↑↓</kbd>
                    Navegar
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">↵</kbd>
                    Abrir
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">ESC</kbd>
                    Cerrar
                  </span>
                </div>
                {results && totalResults > 0 && (
                  <span className="text-[10px] text-muted-foreground/40">
                    {totalResults} resultado{totalResults !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
