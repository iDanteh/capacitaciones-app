'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeToggle } from '@/components/theme-toggle';
import { CaptaLogo, CaptaMark } from '@/components/capta-logo';
import { Icon, type IconName } from '@/components/capta-icon';
import { NotificationBell } from '@/components/notification-bell';
import { CommandPalette } from '@/components/command-palette';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantSlug: string;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

const NAV_PLATFORM = [
  { label: 'Inicio',     icon: 'home'      as IconName, href: '/dashboard',           roles: [] },
  { label: 'Cursos',     icon: 'book-open' as IconName, href: '/dashboard/courses',   roles: [] },
  { label: 'Equipos',    icon: 'users'     as IconName, href: '/dashboard/users',     roles: ['OWNER', 'ADMIN', 'MANAGER'] },
  { label: 'Analíticas', icon: 'chart-bar' as IconName, href: '/dashboard/analytics', roles: ['OWNER', 'ADMIN', 'MANAGER'] },
] as const;

const NAV_COMPANY = [
  { label: 'Configuración',    icon: 'gear'        as IconName, href: '/dashboard/settings',     roles: ['OWNER', 'ADMIN'] },
  { label: 'Plan y facturación', icon: 'credit-card' as IconName, href: '/dashboard/subscription', roles: ['OWNER'] },
] as const;

type PlatformItem = (typeof NAV_PLATFORM)[number];
type CompanyItem  = (typeof NAV_COMPANY)[number];
type AnyNavItem   = PlatformItem | CompanyItem;

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
          ? 'text-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
      style={active ? { background: softAccent ?? 'rgba(220,233,244,0.6)' } : undefined}
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

  const handleLogout = () => {
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

  const accent = accentColor ?? '#1E4F7A';

  return (
    <div className="flex h-full flex-col">

      {/* ── Logo ── */}
      <div className="flex h-[60px] flex-shrink-0 items-center border-b border-border px-5">
        <CaptaLogo markSize={26} showText />
      </div>

      {/* ── Tenant selector ── */}
      {user && (
        <div className="mx-3 mt-3 flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-3 py-2.5 cursor-default">
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
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold leading-tight text-foreground">{tenantLabel}</p>
            <p className="text-[10px] text-muted-foreground/60">{ROLE_LABELS[user.role] ?? user.role}</p>
          </div>
          <Icon name="chevron-down" size={12} className="flex-shrink-0 text-muted-foreground/30" />
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

      {/* Search bar — opens CommandPalette */}
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

    // Refrescar datos del tenant desde la API en segundo plano
    api.get<{ logoUrl?: string | null; primaryColor?: string | null; name?: string }>('/tenants/me')
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
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.04 }}
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
