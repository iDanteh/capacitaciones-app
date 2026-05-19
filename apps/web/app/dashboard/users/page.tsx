'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserPlus,
  Mail,
  MoreHorizontal,
  Shield,
  ShieldCheck,
  UserCog,
  UserMinus,
  X,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type UserRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

interface UserItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

interface PendingInvite {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  expiresAt: string;
  createdAt: string;
  invitedBy: { firstName: string; lastName: string };
}

interface PaginatedUsers {
  data: UserItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Config visual ────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; bg: string; icon: typeof Shield }> = {
  OWNER:      { label: 'Propietario', color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-500/10',   icon: ShieldCheck },
  ADMIN:      { label: 'Admin',       color: 'text-navy dark:text-sky',              bg: 'bg-navy/6 dark:bg-sky/10',           icon: Shield },
  MANAGER:    { label: 'Manager',     color: 'text-teal-600 dark:text-teal-400',     bg: 'bg-teal/8 dark:bg-teal/10',          icon: UserCog },
  EMPLOYEE:   { label: 'Empleado',    color: 'text-muted-foreground',               bg: 'bg-muted',                           icon: Users },
};

const INVITABLE_ROLES: { value: UserRole; label: string }[] = [
  { value: 'ADMIN',    label: 'Administrador' },
  { value: 'MANAGER',  label: 'Manager' },
  { value: 'EMPLOYEE', label: 'Empleado' },
];

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function RoleBadge({ role }: { role: UserRole }) {
  const cfg = ROLE_CONFIG[role];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

function Avatar({ firstName, lastName, avatarUrl, size = 'md' }: {
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md';
}) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const dim = size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-10 w-10 text-xs';
  if (avatarUrl) {
    return <img src={avatarUrl} alt={`${firstName} ${lastName}`} className={`${dim} rounded-full object-cover`} />;
  }
  return (
    <div className={`${dim} flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky/20 to-navy/20 font-bold text-navy dark:text-sky`}>
      {initials}
    </div>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return 'Nunca';
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

// ─── Modal: Invitar usuario ───────────────────────────────────────────────────

interface InviteForm {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

function InviteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState<InviteForm>({ email: '', firstName: '', lastName: '', role: 'EMPLOYEE' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/users/invite', form);
      onSuccess();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Error al enviar la invitación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Invitar usuario</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Se enviará un email con el enlace de activación.</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">Email</label>
            <input
              type="email"
              required
              placeholder="usuario@empresa.com"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-sky/50 focus:ring-2 focus:ring-sky/15"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Nombre</label>
              <input
                required
                placeholder="Juan"
                value={form.firstName}
                onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-sky/50 focus:ring-2 focus:ring-sky/15"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Apellido</label>
              <input
                required
                placeholder="Pérez"
                value={form.lastName}
                onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-sky/50 focus:ring-2 focus:ring-sky/15"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">Rol</label>
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as UserRole }))}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition-all focus:border-sky/50 focus:ring-2 focus:ring-sky/15"
            >
              {INVITABLE_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-navy shadow-md shadow-sky/20 transition-all hover:shadow-sky/35 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #5AC8FA, #38BDF8)' }}
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
              {loading ? 'Enviando…' : 'Enviar invitación'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Row / Card de usuario ────────────────────────────────────────────────────

function UserRow({
  user,
  onUpdate,
  onDelete,
  currentUserId,
}: {
  user: UserItem;
  onUpdate: (id: string, data: Partial<UserItem>) => void;
  onDelete: (id: string) => void;
  currentUserId: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isMe = user.id === currentUserId;
  const isOwner = user.role === 'OWNER';

  const handleToggleActive = async () => {
    setLoading(true);
    try {
      const updated = await api.patch<UserItem>(`/users/${user.id}`, { isActive: !user.isActive });
      onUpdate(user.id, { isActive: updated.data.isActive });
    } finally {
      setLoading(false);
      setMenuOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar a ${user.firstName} ${user.lastName}? Esta acción no se puede deshacer.`)) return;
    setLoading(true);
    try {
      await api.delete(`/users/${user.id}`);
      onDelete(user.id);
    } finally {
      setLoading(false);
      setMenuOpen(false);
    }
  };

  return (
    <div className={`flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-secondary/40 ${!user.isActive ? 'opacity-60' : ''}`}>
      <Avatar firstName={user.firstName} lastName={user.lastName} avatarUrl={user.avatarUrl} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground leading-tight">
            {user.firstName} {user.lastName}
          </span>
          <RoleBadge role={user.role} />
          {!user.isActive && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Inactivo</span>
          )}
          {isMe && (
            <span className="rounded-full bg-sky/10 px-2 py-0.5 text-xs font-medium text-sky">Tú</span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</p>
      </div>

      <div className="hidden text-right md:block">
        <p className="text-xs text-muted-foreground">Último acceso</p>
        <p className="text-xs font-medium text-foreground">{formatDate(user.lastLoginAt)}</p>
      </div>

      {/* Actions */}
      <div className="relative flex-shrink-0">
        {loading ? (
          <Loader2 size={16} className="animate-spin text-muted-foreground" />
        ) : (
          <button
            disabled={isMe || isOwner}
            onClick={() => setMenuOpen((p) => !p)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          >
            <MoreHorizontal size={16} />
          </button>
        )}

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.1 }}
              className="absolute right-0 top-9 z-30 min-w-[168px] rounded-xl border border-border bg-card p-1 shadow-xl"
            >
              <button
                onClick={handleToggleActive}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                {user.isActive
                  ? <><UserMinus size={14} className="text-muted-foreground" /> Desactivar</>
                  : <><CheckCircle2 size={14} className="text-emerald-500" /> Activar</>
                }
              </button>
              <div className="my-1 h-px bg-border" />
              <button
                onClick={handleDelete}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/8"
              >
                <X size={14} />
                Eliminar usuario
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function UsersPage() {
  const [data, setData]             = useState<PaginatedUsers | null>(null);
  const [invites, setInvites]       = useState<PendingInvite[]>([]);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [inviteModal, setInviteModal] = useState(false);
  const [successMsg, setSuccessMsg]   = useState<string | null>(null);
  const [tab, setTab]               = useState<'users' | 'invites'>('users');

  // Obtener el user ID del localStorage para marcar "Tú"
  const [currentUserId] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') ?? '{}').id ?? ''; } catch { return ''; }
  });

  const fetchUsers = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const res = await api.get<PaginatedUsers>(`/users?page=${p}&limit=20`);
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }, [page]);

  const fetchInvites = useCallback(async () => {
    try {
      const res = await api.get<PendingInvite[]>('/users/invites');
      setInvites(res.data);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void fetchUsers(page);
    void fetchInvites();
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpdate = (id: string, patch: Partial<UserItem>) => {
    setData((prev) => prev ? {
      ...prev,
      data: prev.data.map((u) => u.id === id ? { ...u, ...patch } : u),
    } : prev);
  };

  const handleDelete = (id: string) => {
    setData((prev) => prev ? {
      ...prev,
      data: prev.data.filter((u) => u.id !== id),
      total: prev.total - 1,
    } : prev);
  };

  const handleInviteSuccess = () => {
    setInviteModal(false);
    setSuccessMsg('Invitación enviada correctamente');
    void fetchInvites();
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleCancelInvite = async (id: string) => {
    try {
      await api.delete(`/users/invites/${id}`);
      setInvites((prev) => prev.filter((i) => i.id !== id));
    } catch {
      // ignore
    }
  };

  const totalActive  = data?.data.filter((u) => u.isActive).length ?? 0;

  return (
    <div className="min-h-full p-6 lg:p-8">

      {/* ── Encabezado ── */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="mb-8 flex flex-wrap items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Usuarios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestiona los miembros de tu empresa y sus permisos.
          </p>
        </div>

        <button
          onClick={() => setInviteModal(true)}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-navy shadow-md shadow-sky/20 transition-all hover:shadow-sky/35 hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #5AC8FA, #38BDF8)' }}
        >
          <UserPlus size={16} />
          Invitar usuario
        </button>
      </motion.div>

      {/* ── Toast de éxito ── */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
          >
            <CheckCircle2 size={15} />
            {successMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stats rápidas ── */}
      {data && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[
            { label: 'Total usuarios', value: data.total,    icon: Users,       color: 'text-foreground' },
            { label: 'Activos',        value: totalActive,   icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Invitaciones',   value: invites.length, icon: Mail,        color: 'text-navy dark:text-sky' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30, delay: i * 0.06 }}
              className="rounded-xl border border-border bg-card px-4 py-3"
            >
              <stat.icon size={14} className={`mb-1.5 ${stat.color}`} />
              <p className="text-xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="mb-4 flex gap-1 rounded-xl border border-border bg-muted p-1 w-fit">
        {(['users', 'invites'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
              tab === t
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'users' ? 'Miembros' : `Invitaciones${invites.length > 0 ? ` (${invites.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* ── Lista de usuarios ── */}
      {tab === 'users' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : !data || data.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
              <Users size={32} className="mb-3 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">Sin usuarios</p>
              <p className="mt-1 text-sm text-muted-foreground">Invita miembros de tu equipo para comenzar.</p>
            </div>
          ) : (
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.04 } } }}
              className="space-y-2"
            >
              {data.data.map((user) => (
                <motion.div
                  key={user.id}
                  variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                >
                  <UserRow
                    user={user}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    currentUserId={currentUserId}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Paginación */}
          {data && data.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Página {data.page} de {data.totalPages} — {data.total} usuarios
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-all hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  disabled={page >= (data.totalPages ?? 1)}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-all hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Invitaciones pendientes ── */}
      {tab === 'invites' && (
        <div>
          {invites.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
              <Mail size={32} className="mb-3 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">Sin invitaciones pendientes</p>
              <p className="mt-1 text-sm text-muted-foreground">Las invitaciones activas aparecerán aquí.</p>
            </div>
          ) : (
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.04 } } }}
              className="space-y-2"
            >
              {invites.map((inv) => (
                <motion.div
                  key={inv.id}
                  variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-sky/10 text-xs font-bold text-sky">
                    {inv.firstName.charAt(0)}{inv.lastName.charAt(0)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {inv.firstName} {inv.lastName}
                      </span>
                      <RoleBadge role={inv.role} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {inv.email} · Invitado por {inv.invitedBy.firstName} {inv.invitedBy.lastName}
                    </p>
                  </div>

                  <div className="hidden text-right md:block">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock size={11} />
                      Expira {formatDate(inv.expiresAt)}
                    </div>
                  </div>

                  <button
                    onClick={() => handleCancelInvite(inv.id)}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/8 hover:text-destructive"
                    title="Cancelar invitación"
                  >
                    <X size={15} />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      )}

      {/* ── Modal de invitación ── */}
      <AnimatePresence>
        {inviteModal && (
          <InviteModal
            onClose={() => setInviteModal(false)}
            onSuccess={handleInviteSuccess}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
