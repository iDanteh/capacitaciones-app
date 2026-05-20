'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  BarChart2,
  CreditCard,
  Menu,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantSlug: string;
}

// ─── Navegación ───────────────────────────────────────────────────────────────

const NAV_ITEMS_ALL = [
  { label: 'Inicio',      icon: LayoutDashboard, href: '/dashboard',               roles: [] },
  { label: 'Cursos',      icon: BookOpen,         href: '/dashboard/courses',       roles: [] },
  { label: 'Usuarios',    icon: Users,            href: '/dashboard/users',         roles: ['OWNER', 'ADMIN', 'MANAGER'] },
  { label: 'Analíticas',  icon: BarChart2,        href: '/dashboard/analytics',     roles: ['OWNER', 'ADMIN', 'MANAGER'] },
  { label: 'Suscripción', icon: CreditCard,       href: '/dashboard/subscription',  roles: ['OWNER'] },
];

type NavItem = (typeof NAV_ITEMS_ALL)[number];

// ─── Nav Item ─────────────────────────────────────────────────────────────────

function NavItem({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
        active
          ? 'bg-navy/8 text-navy dark:bg-sky/[0.12] dark:text-sky'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <item.icon
        size={18}
        className={`flex-shrink-0 transition-colors ${
          active
            ? 'text-navy dark:text-sky'
            : 'text-muted-foreground group-hover:text-foreground group-hover:opacity-100'
        }`}
      />
      <span>{item.label}</span>
      {active && (
        <ChevronRight size={13} className="ml-auto text-navy/30 dark:text-sky/30" />
      )}
    </Link>
  );
}

// ─── Sidebar Content ──────────────────────────────────────────────────────────

/**
 * Contenido del sidebar — compartido entre desktop fijo y drawer mobile.
 * Se extrae para no duplicar JSX.
 */
function SidebarContent({
  user,
  pathname,
  onNavClick,
}: {
  user: UserData | null;
  pathname: string;
  onNavClick?: () => void;
}) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : '?';

  const roleLabel: Record<string, string> = {
    OWNER: 'Propietario',
    ADMIN: 'Administrador',
    MANAGER: 'Manager',
    EMPLOYEE: 'Empleado',
    SUPER_ADMIN: 'Super Admin',
  };

  return (
    <div className="flex h-full flex-col">
      {/* ── Logo ── */}
      <div className="flex h-16 flex-shrink-0 items-center gap-3 border-b border-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky to-navy shadow-sm shadow-sky/20">
          <span className="text-xs font-bold text-white">L</span>
        </div>
        <span className="text-sm font-semibold tracking-tight text-foreground">LMS</span>
      </div>

      {/* ── Nav ── */}

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        <p className="mb-2 px-3 pt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          Principal
        </p>
        {NAV_ITEMS_ALL.filter(item =>
          item.roles.length === 0 || (user?.role && item.roles.includes(user.role)),
        ).map((item) => (
          <NavItem
            key={item.href}
            item={item}
            active={item.href === '/dashboard' ? pathname === '/dashboard' : pathname === item.href || pathname.startsWith(item.href + '/')}
            onClick={onNavClick}
          />
        ))}
      </nav>

      {/* ── Bottom: usuario + acciones ── */}
      <div className="flex-shrink-0 border-t border-border p-3 space-y-1">
        {/* User info */}
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky/20 to-navy/20 text-[11px] font-bold text-navy dark:text-sky">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground leading-tight">
              {user ? `${user.firstName} ${user.lastName}` : '—'}
            </p>
            <p className="truncate text-xs font-medium text-muted-foreground">
              {user?.role ? (roleLabel[user.role] ?? user.role) : '—'}
            </p>
          </div>
        </div>

        {/* Acciones: theme toggle + logout */}
        <div className="flex items-center justify-between px-3 py-1">
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="Cerrar sesión"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Layout principal ─────────────────────────────────────────────────────────

/**
 * Layout autenticado del dashboard.
 *
 * Responsabilidades:
 *  1. Auth guard: verifica access_token en localStorage. Si no existe → /login.
 *  2. Sidebar fijo en desktop (240px) con glassmorphism.
 *  3. Drawer overlay en mobile con animación spring (Framer Motion).
 *  4. Dark mode toggle integrado en el sidebar.
 *  5. Page content con fade-up de entrada.
 *
 * Nota de seguridad: esta protección es solo UX (client-side).
 * La protección real está en el backend (JwtAuthGuard + RLS).
 * Agregar middleware.ts con cookie de sesión cuando se migre de localStorage.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();

  const [user,        setUser]        = useState<UserData | null>(null);
  const [isReady,     setIsReady]     = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token');

    if (!token) {
      router.replace('/login');
      return;
    }

    try {
      const raw = localStorage.getItem('user');
      if (raw) setUser(JSON.parse(raw) as UserData);
    } catch {
      // Datos corruptos — tokens siguen siendo válidos, continuamos sin nombre
    }

    setIsReady(true);
  }, [router]);

  // Cerrar drawer al cambiar de ruta en mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Pantalla de carga durante verificación de auth — evita flash del dashboard
  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Sidebar desktop (fijo) ── */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-shrink-0 lg:flex-col border-r border-border bg-card">
        <SidebarContent user={user} pathname={pathname} />
      </aside>

      {/* ── Sidebar mobile (drawer overlay) ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
              aria-hidden="true"
            />

            {/* Drawer */}
            <motion.aside
              key="drawer"
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 z-50 flex h-full w-60 flex-col border-r border-border bg-card lg:hidden"
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

      {/* ── Main area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Header mobile */}
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Abrir menú"
          >
            <Menu size={18} />
          </button>

          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-sky to-navy">
              <span className="text-[10px] font-bold text-white">L</span>
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">LMS</span>
          </div>

          <ThemeToggle />
        </header>

        {/* Contenido de la página */}
        <main className="flex-1 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.05 }}
          >
            {children}
          </motion.div>
        </main>

      </div>
    </div>
  );
}
