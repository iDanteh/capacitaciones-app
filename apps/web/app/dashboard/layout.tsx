'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeToggle } from '@/components/theme-toggle';
import { CaptaLogo, CaptaMark } from '@/components/capta-logo';
import { Icon, type IconName } from '@/components/capta-icon';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantSlug: string;
}

// ─── Navigation config ────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'Inicio',      icon: 'home'        as IconName, href: '/dashboard',              roles: [] },
  { label: 'Cursos',      icon: 'book-open'   as IconName, href: '/dashboard/courses',      roles: [] },
  { label: 'Usuarios',    icon: 'users'       as IconName, href: '/dashboard/users',        roles: ['OWNER', 'ADMIN', 'MANAGER'] },
  { label: 'Analíticas',  icon: 'chart-bar'   as IconName, href: '/dashboard/analytics',   roles: ['OWNER', 'ADMIN', 'MANAGER'] },
  { label: 'Suscripción', icon: 'credit-card' as IconName, href: '/dashboard/subscription', roles: ['OWNER'] },
] as const;

type NavItem = (typeof NAV_ITEMS)[number];

// ─── Role labels ──────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  OWNER:       'Propietario',
  ADMIN:       'Administrador',
  MANAGER:     'Manager',
  EMPLOYEE:    'Empleado',
  SUPER_ADMIN: 'Super Admin',
};

// ─── Nav item ─────────────────────────────────────────────────────────────────

function NavItem({ item, active, onClick }: {
  item: NavItem; active: boolean; onClick?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
        active
          ? 'bg-capta-tint/60 text-capta-deep dark:bg-capta-soft/10 dark:text-capta-soft'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {/* Indicador lateral activo */}
      {active && (
        <span
          className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full"
          style={{ background: 'linear-gradient(180deg, #1E4F7A, #8FC4E8)' }}
        />
      )}
      <Icon
        name={item.icon}
        size={16}
        className={active
          ? 'text-capta-deep dark:text-capta-soft'
          : 'text-muted-foreground/60 group-hover:text-foreground'}
      />
      <span>{item.label}</span>
    </Link>
  );
}

// ─── Sidebar content ──────────────────────────────────────────────────────────

function SidebarContent({ user, pathname, onNavClick }: {
  user: UserData | null; pathname: string; onNavClick?: () => void;
}) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : '?';

  const visibleItems = NAV_ITEMS.filter(item =>
    item.roles.length === 0 || (user?.role && item.roles.includes(user.role as never)),
  );

  return (
    <div className="flex h-full flex-col">

      {/* ── Logo ── */}
      <div className="flex h-[60px] flex-shrink-0 items-center border-b border-border px-5">
        <CaptaLogo markSize={26} showText />
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/40">
          Plataforma
        </p>
        <div className="space-y-0.5">
          {visibleItems.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              active={
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname === item.href || pathname.startsWith(item.href + '/')
              }
              onClick={onNavClick}
            />
          ))}
        </div>
      </nav>

      {/* ── Bottom: usuario + acciones ── */}
      <div className="flex-shrink-0 border-t border-border p-3 space-y-1">
        {/* User */}
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
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
            <p className="truncate text-[11px] text-muted-foreground/70">
              {user?.role ? (ROLE_LABELS[user.role] ?? user.role) : '—'}
            </p>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-between px-3 py-1">
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/50 transition-all hover:bg-destructive/10 hover:text-destructive"
            aria-label="Cerrar sesión"
          >
            <Icon name="logout" size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();

  const [user,        setUser]        = useState<UserData | null>(null);
  const [isReady,     setIsReady]     = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) { router.replace('/login'); return; }
    try {
      const raw = localStorage.getItem('user');
      if (raw) setUser(JSON.parse(raw) as UserData);
    } catch { /* datos corruptos — continuar */ }
    setIsReady(true);
  }, [router]);

  // Cerrar drawer al navegar
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

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
        <SidebarContent user={user} pathname={pathname} />
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
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main ── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Header mobile */}
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
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.04 }}
          >
            {children}
          </motion.div>
        </main>

      </div>
    </div>
  );
}
