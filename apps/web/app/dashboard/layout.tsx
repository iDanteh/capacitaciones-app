'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeToggle } from '@/components/theme-toggle';
import { CaptaLogo, CaptaMark } from '@/components/capta-logo';
import { Icon, type IconName } from '@/components/capta-icon';
import { NotificationBell } from '@/components/notification-bell';
import { CommandPalette } from '@/components/command-palette';
import { api } from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantSlug: string;
}

interface SubcompanyItem {
  id:       string;
  name:     string;
  slug:     string;
  isActive: boolean;
}

interface AuthSwitchResponse {
  accessToken:  string;
  refreshToken: string;
  user: {
    id:         string;
    email:      string;
    firstName:  string;
    lastName:   string;
    role:       string;
    tenantId:   string;
    tenantSlug: string;
  };
}

// ─── Navigation ───────────────────────────────────────────────────────────────

const NAV_PLATFORM = [
  { label: 'Inicio',     icon: 'home'      as IconName, href: '/dashboard',           roles: [] },
  { label: 'Cursos',     icon: 'book-open' as IconName, href: '/dashboard/courses',   roles: [] },
  { label: 'Equipos',    icon: 'users'     as IconName, href: '/dashboard/users',     roles: ['OWNER', 'ADMIN', 'MANAGER'] },
  { label: 'Analíticas', icon: 'chart-bar' as IconName, href: '/dashboard/analytics', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
] as const;

const NAV_COMPANY = [
  { label: 'Empresas',          icon: 'building'    as IconName, href: '/dashboard/companies',    roles: ['OWNER'] },
  { label: 'Configuración',     icon: 'gear'        as IconName, href: '/dashboard/settings',     roles: ['OWNER', 'ADMIN'] },
  { label: 'Plan y facturación', icon: 'credit-card' as IconName, href: '/dashboard/subscription', roles: ['OWNER'] },
] as const;

const NAV_SYSTEM = [
  { label: 'Panel Admin', icon: 'shield' as IconName, href: '/dashboard/super-admin', roles: ['SUPER_ADMIN'] },
] as const;

type PlatformItem = (typeof NAV_PLATFORM)[number];
type CompanyItem  = (typeof NAV_COMPANY)[number];
type SystemItem   = (typeof NAV_SYSTEM)[number];
type AnyNavItem   = PlatformItem | CompanyItem | SystemItem;

// ─── Role labels ──────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  OWNER:       'Propietario',
  ADMIN:       'Administrador',
  MANAGER:     'Manager',
  EMPLOYEE:    'Empleado',
  SUPER_ADMIN: 'Super Admin',
};

// ─── Nav item ─────────────────────────────────────────────────────────────────

function NavItem({ item, active, onClick, accentColor }: {
  item: AnyNavItem; active: boolean; onClick?: () => void; accentColor?: string;
}) {
  const accent = accentColor ?? '#1E4F7A';
  const softAccent = accentColor ? `${accentColor}18` : undefined;

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
        active
          ? 'text-foreground bg-[rgba(220,233,244,0.65)] dark:bg-white/[0.08]'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
      style={active && accentColor ? { background: `${accentColor}28` } : undefined}
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full"
          style={{ background: `linear-gradient(180deg, ${accent}, ${accent}88)` }}
        />
      )}
      <Icon
        name={item.icon}
        size={16}
        className={active ? '' : 'text-muted-foreground/60 group-hover:text-foreground'}
        style={active ? { color: accent } : undefined}
      />
      <span style={active ? { color: accent } : undefined}>{item.label}</span>
    </Link>
  );
}

// ─── Sidebar content ──────────────────────────────────────────────────────────

function SidebarContent({ user, pathname, onNavClick, tenantLogo, tenantName, accentColor }: {
  user: UserData | null;
  pathname: string;
  onNavClick?: () => void;
  tenantLogo?: string;
  tenantName?: string;
  accentColor?: string;
}) {
  const router = useRouter();

  // ── Tenant dropdown ───────────────────────────────────────────────────────
  const [tenantOpen,      setTenantOpen]      = useState(false);
  const [subcompanies,    setSubcompanies]    = useState<SubcompanyItem[]>([]);
  const [switching,       setSwitching]       = useState(false);
  const [isInSubcompany,  setIsInSubcompany]  = useState(false);
  const [parentName,      setParentName]      = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Detect if currently inside a sub-company context + load cached sub-companies
  useEffect(() => {
    const parentSess = localStorage.getItem('parent_session');
    setIsInSubcompany(!!parentSess);
    if (parentSess) {
      try {
        const sess = JSON.parse(parentSess) as Record<string, string | null>;
        const parentUserRaw = sess.user;
        if (sess.tenantName) {
          setParentName(sess.tenantName);
        } else if (parentUserRaw) {
          const parentUser = JSON.parse(parentUserRaw) as { tenantSlug?: string };
          setParentName(
            parentUser.tenantSlug
              ? parentUser.tenantSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
              : 'Empresa principal',
          );
        }
      } catch { /* corrupted */ }
      // Load cached sub-companies for display
      const cached = localStorage.getItem('tenant_subcompanies');
      if (cached) {
        try { setSubcompanies(JSON.parse(cached) as SubcompanyItem[]); } catch { /* */ }
      }
    }
  }, [pathname]);

  // Fetch sub-companies (only for OWNER at parent level)
  useEffect(() => {
    if (user?.role !== 'OWNER' || isInSubcompany) return;
    api.get<SubcompanyItem[]>('/tenants/children')
      .then(r => {
        const active = r.data.filter(c => c.isActive);
        setSubcompanies(active);
        // Cache so the list is available when viewing from inside a sub-company
        localStorage.setItem('tenant_subcompanies', JSON.stringify(active));
      })
      .catch(() => {});
  }, [user, isInSubcompany]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!tenantOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setTenantOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [tenantOpen]);

  const handleSwitchTenant = async (childId: string) => {
    if (switching) return;
    setSwitching(true);
    setTenantOpen(false);

    let tokenToRestore: string | null = null;

    try {
      if (isInSubcompany) {
        // We're already in a sub-company — use parent's token for the switch call
        // so the API resolves the correct parent → child relationship.
        const parentSess = JSON.parse(localStorage.getItem('parent_session') ?? '{}') as Record<string, string | null>;
        tokenToRestore = localStorage.getItem('access_token');
        if (parentSess.accessToken) {
          localStorage.setItem('access_token', parentSess.accessToken);
        }
        // parent_session stays unchanged (still pointing to the real parent)
      } else {
        // At parent level — save current session as parent before switching
        localStorage.setItem('parent_session', JSON.stringify({
          accessToken:  localStorage.getItem('access_token'),
          refreshToken: localStorage.getItem('refresh_token'),
          user:         localStorage.getItem('user'),
          tenantLogo:   localStorage.getItem('tenant_logo'),
          tenantName:   localStorage.getItem('tenant_name'),
          tenantColor:  localStorage.getItem('tenant_color'),
        }));
      }

      const res = await api.post<AuthSwitchResponse>('/auth/switch-tenant', { childTenantId: childId });
      const { accessToken, refreshToken, user: newUser } = res.data;

      localStorage.setItem('access_token',  accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('user',          JSON.stringify(newUser));
      localStorage.removeItem('tenant_logo');
      localStorage.removeItem('tenant_name');
      localStorage.removeItem('tenant_color');

      window.location.replace('/dashboard');
    } catch {
      // Rollback
      if (tokenToRestore) localStorage.setItem('access_token', tokenToRestore);
      if (!isInSubcompany)  localStorage.removeItem('parent_session');
      setSwitching(false);
    }
  };

  const handleRestoreParent = () => {
    try {
      const raw = localStorage.getItem('parent_session');
      if (!raw) return;
      const sess = JSON.parse(raw) as Record<string, string | null>;
      if (sess.accessToken)  localStorage.setItem('access_token',  sess.accessToken);
      if (sess.refreshToken) localStorage.setItem('refresh_token', sess.refreshToken);
      if (sess.user)         localStorage.setItem('user',          sess.user);
      localStorage.setItem('tenant_logo',  sess.tenantLogo  ?? '');
      localStorage.setItem('tenant_name',  sess.tenantName  ?? '');
      localStorage.setItem('tenant_color', sess.tenantColor ?? '');
      localStorage.removeItem('parent_session');
    } catch { /* corrupted */ }
    window.location.replace('/dashboard');
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const handleLogout = () => {
    disconnectSocket();
    localStorage.clear();
    router.push('/login');
  };

  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : '?';

  const tenantLabel = tenantName
    || (user?.tenantSlug
      ? user.tenantSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      : '—');

  const tenantInitial = tenantLabel.charAt(0).toUpperCase();

  const visiblePlatform = NAV_PLATFORM.filter(item =>
    item.roles.length === 0 || (user?.role && item.roles.includes(user.role as never)),
  );
  const visibleCompany = NAV_COMPANY.filter(item =>
    user?.role && item.roles.includes(user.role as never),
  );
  const visibleSystem = NAV_SYSTEM.filter(item =>
    user?.role && item.roles.includes(user.role as never),
  );

  const accent = accentColor ?? '#1E4F7A';
  const isOwner = user?.role === 'OWNER';
  const hasDropdown = isOwner && (subcompanies.length > 0 || isInSubcompany);
  // ID of the currently active sub-company (null if at parent level)
  const currentChildId = isInSubcompany
    ? (() => {
        try {
          const u = JSON.parse(localStorage.getItem('user') ?? '{}') as { tenantId?: string };
          return u.tenantId ?? null;
        } catch { return null; }
      })()
    : null;

  return (
    <div className="flex h-full flex-col">

      {/* ── Logo ── */}
      <div className="flex h-[60px] flex-shrink-0 items-center border-b border-border px-5">
        <CaptaLogo markSize={26} showText />
      </div>

      {/* ── Tenant selector ── */}
      {user && (
        <div className="mx-3 mt-3 relative" ref={dropdownRef}>
          <button
            onClick={() => hasDropdown && setTenantOpen(o => !o)}
            className={`w-full flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-3 py-2.5 transition-colors ${hasDropdown ? 'hover:bg-muted/70 cursor-pointer' : 'cursor-default'}`}
          >
            <div
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg overflow-hidden text-[10px] font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
            >
              {tenantLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tenantLogo} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                tenantInitial
              )}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-xs font-semibold leading-tight text-foreground">{tenantLabel}</p>
              <p className="text-[10px] text-muted-foreground/60">
                {isInSubcompany ? 'Sub-empresa · ' : ''}{ROLE_LABELS[user.role] ?? user.role}
              </p>
            </div>
            {switching ? (
              <Icon name="refresh" size={12} className="flex-shrink-0 text-muted-foreground/30 animate-spin" />
            ) : hasDropdown ? (
              <Icon
                name="chevron-down"
                size={12}
                className={`flex-shrink-0 text-muted-foreground/40 transition-transform duration-200 ${tenantOpen ? 'rotate-180' : ''}`}
              />
            ) : null}
          </button>

          {/* Dropdown */}
          <AnimatePresence>
            {tenantOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border bg-card shadow-xl"
              >
                {/* Empresa principal (volver) */}
                {isInSubcompany && (
                  <button
                    onClick={handleRestoreParent}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-muted transition-colors group"
                  >
                    <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-muted text-[9px] font-bold text-foreground">
                      {(parentName || 'P').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {parentName || 'Empresa principal'}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60">Empresa principal</p>
                    </div>
                    <Icon name="arrow-left" size={11} className="flex-shrink-0 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                  </button>
                )}

                {/* Sub-company list */}
                {subcompanies.length > 0 && (
                  <div className={isInSubcompany ? 'border-t border-border' : ''}>
                    <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/40">
                      Sub-empresas
                    </p>
                    {subcompanies.map(c => {
                      const isActive = c.id === currentChildId;
                      return (
                        <button
                          key={c.id}
                          onClick={() => !isActive && void handleSwitchTenant(c.id)}
                          disabled={isActive || switching}
                          className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors disabled:cursor-default ${
                            isActive ? 'bg-muted/60' : 'hover:bg-muted'
                          }`}
                        >
                          <div
                            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md text-[9px] font-bold text-white"
                            style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' }}
                          >
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <span className={`flex-1 truncate text-xs font-medium ${isActive ? 'text-foreground' : 'text-foreground/80'}`}>
                            {c.name}
                          </span>
                          {isActive ? (
                            <span className="flex-shrink-0 h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
                          ) : (
                            <Icon name="external" size={10} className="flex-shrink-0 text-muted-foreground/30" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* At parent level with no sub-companies */}
                {subcompanies.length === 0 && !isInSubcompany && (
                  <div className="flex flex-col items-center gap-1.5 px-3 py-4 text-center">
                    <p className="text-[11px] text-muted-foreground/60">Sin sub-empresas activas</p>
                    <Link
                      href="/dashboard/companies"
                      onClick={() => setTenantOpen(false)}
                      className="text-[11px] font-medium text-capta-deep/70 hover:text-capta-deep transition-colors"
                    >
                      Crear sub-empresa →
                    </Link>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-5">

        {/* PLATAFORMA */}
        <div>
          <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/40">
            Plataforma
          </p>
          <div className="space-y-0.5">
            {visiblePlatform.map((navItem) => (
              <NavItem
                key={navItem.href}
                item={navItem}
                active={
                  navItem.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname === navItem.href || pathname.startsWith(navItem.href + '/')
                }
                onClick={onNavClick}
                accentColor={accent}
              />
            ))}
          </div>
        </div>

        {/* EMPRESA */}
        {visibleCompany.length > 0 && (
          <div>
            <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/40">
              Empresa
            </p>
            <div className="space-y-0.5">
              {visibleCompany.map((navItem) => (
                <NavItem
                  key={navItem.href}
                  item={navItem}
                  active={pathname === navItem.href || pathname.startsWith(navItem.href + '/')}
                  onClick={onNavClick}
                  accentColor={accent}
                />
              ))}
            </div>
          </div>
        )}

        {/* SISTEMA (solo SUPER_ADMIN) */}
        {visibleSystem.length > 0 && (
          <div>
            <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-violet-500/60">
              Sistema
            </p>
            <div className="space-y-0.5">
              {visibleSystem.map((navItem) => (
                <NavItem
                  key={navItem.href}
                  item={navItem}
                  active={pathname === navItem.href || pathname.startsWith(navItem.href + '/')}
                  onClick={onNavClick}
                  accentColor="#7C3AED"
                />
              ))}
            </div>
          </div>
        )}

      </nav>

      {/* ── Bottom: usuario ── */}
      <div className="flex-shrink-0 border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/50 transition-colors">
          <Link href="/dashboard/profile" className="flex flex-1 items-center gap-3 min-w-0">
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
              style={{ background: 'linear-gradient(135deg, #DCE9F4, #8FC4E830)', color: '#1E4F7A' }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight text-foreground">
                {user ? `${user.firstName} ${user.lastName}` : '—'}
              </p>
              <p className="truncate text-[11px] text-muted-foreground/60">
                {user?.role ? (ROLE_LABELS[user.role] ?? user.role) : '—'}
              </p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground/40 transition-all hover:bg-destructive/10 hover:text-destructive"
            aria-label="Cerrar sesión"
          >
            <Icon name="logout" size={14} />
          </button>
        </div>
      </div>

    </div>
  );
}

// ─── Desktop header ───────────────────────────────────────────────────────────

function DesktopHeader({ user, onSearchOpen }: { user: UserData | null; onSearchOpen: () => void }) {
  const isAdmin = user ? ['OWNER', 'ADMIN', 'MANAGER'].includes(user.role) : false;

  return (
    <header className="hidden lg:flex h-[60px] flex-shrink-0 items-center gap-3 border-b border-border bg-card/80 backdrop-blur-md px-6">

      {/* Search bar */}
      <button
        type="button"
        onClick={onSearchOpen}
        className="flex flex-1 max-w-sm items-center gap-2.5 rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-muted-foreground/60 hover:border-capta-deep/20 transition-colors cursor-text select-none"
      >
        <Icon name="search" size={13} className="flex-shrink-0" />
        <span className="flex-1 text-left text-[13px]">Buscar cursos, personas, certificados...</span>
        <kbd className="hidden sm:flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/50 font-mono">⌘K</kbd>
      </button>

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-2">

        <NotificationBell />

        <ThemeToggle className="border border-border bg-background hover:border-capta-deep/20 rounded-lg" />

        {isAdmin && (
          <Link
            href="/dashboard/courses/new"
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-md active:scale-[0.97]"
            style={{
              background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)',
              boxShadow: '0 2px 10px rgba(30,79,122,0.25)',
            }}
          >
            <Icon name="plus" size={14} />
            Nuevo curso
          </Link>
        )}

      </div>
    </header>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();

  const [user,         setUser]         = useState<UserData | null>(null);
  const [isReady,      setIsReady]      = useState(false);
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [commandOpen,  setCommandOpen]  = useState(false);
  const [tenantLogo,   setTenantLogo]   = useState('');
  const [tenantName,   setTenantName]   = useState('');
  const [accentColor,  setAccentColor]  = useState('');

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) { router.replace('/login'); return; }
    try {
      const raw = localStorage.getItem('user');
      if (raw) setUser(JSON.parse(raw) as UserData);
    } catch { /* datos corruptos — continuar */ }

    // Cargar datos del tenant para logo y color personalizado
    setTenantLogo(localStorage.getItem('tenant_logo')  ?? '');
    setTenantName(localStorage.getItem('tenant_name')  ?? '');
    setAccentColor(localStorage.getItem('tenant_color') ?? '');

    setIsReady(true);

    // Conectar WebSocket (funciona en mobile y desktop desde el layout)
    connectSocket();

    // Refrescar datos del tenant desde la API en segundo plano (timeout 5s — evita spinner infinito)
    api.get<{ logoUrl?: string | null; primaryColor?: string | null; name?: string }>('/tenants/me', { timeout: 5_000 })
      .then(r => {
        const logo  = r.data.logoUrl      ?? '';
        const color = r.data.primaryColor ?? '';
        const name  = r.data.name         ?? '';
        setTenantLogo(logo);
        setAccentColor(color);
        setTenantName(name);
        // Cachear en localStorage
        localStorage.setItem('tenant_logo',  logo);
        localStorage.setItem('tenant_color', color);
        localStorage.setItem('tenant_name',  name);
      })
      .catch(() => { /* sin auth todavía o error — usar valores de localStorage */ });
  }, [router]);

  // ⌘K / Ctrl+K — abrir command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Re-sincronizar cuando la ruta cambia (puede haber actualizado logo/color en settings)
  useEffect(() => {
    setSidebarOpen(false);
    const logo  = localStorage.getItem('tenant_logo')  ?? '';
    const color = localStorage.getItem('tenant_color') ?? '';
    const name  = localStorage.getItem('tenant_name')  ?? '';
    setTenantLogo(logo);
    setAccentColor(color);
    setTenantName(name);
    // También actualizar datos del usuario (puede haber cambiado nombre en perfil)
    try {
      const raw = localStorage.getItem('user');
      if (raw) setUser(JSON.parse(raw) as UserData);
    } catch { /* skip */ }
  }, [pathname]);

  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-transparent"
          style={{ borderTopColor: '#1E4F7A', borderRightColor: '#8FC4E820' }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Sidebar desktop ── */}
      <aside className="hidden lg:flex lg:w-[220px] lg:flex-shrink-0 lg:flex-col border-r border-border bg-card">
        <SidebarContent
          user={user}
          pathname={pathname}
          tenantLogo={tenantLogo}
          tenantName={tenantName}
          accentColor={accentColor}
        />
      </aside>

      {/* ── Sidebar mobile (drawer) ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
              aria-hidden
            />
            <motion.aside
              key="drawer"
              initial={{ x: -220 }}
              animate={{ x: 0 }}
              exit={{ x: -220 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed left-0 top-0 z-50 flex h-full w-[220px] flex-col border-r border-border bg-card lg:hidden"
            >
              <SidebarContent
                user={user}
                pathname={pathname}
                onNavClick={() => setSidebarOpen(false)}
                tenantLogo={tenantLogo}
                tenantName={tenantName}
                accentColor={accentColor}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main ── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Desktop header (lg+) */}
        <DesktopHeader user={user} onSearchOpen={() => setCommandOpen(true)} />

        {/* Mobile header */}
        <header className="flex h-[52px] flex-shrink-0 items-center justify-between border-b border-border bg-card/80 backdrop-blur-md px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(s => !s)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Abrir menú"
          >
            <Icon name={sidebarOpen ? 'close' : 'menu'} size={16} />
          </button>
          <CaptaMark size={24} />
          <ThemeToggle />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-hidden">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.04 }}
            className="h-full overflow-y-auto scrollbar-thin"
          >
            {children}
          </motion.div>
        </main>

      </div>

      {/* ── Command Palette (⌘K) ── */}
      <CommandPalette
        isOpen={commandOpen}
        onClose={() => setCommandOpen(false)}
        userRole={user?.role ?? 'EMPLOYEE'}
      />

    </div>
  );
}
