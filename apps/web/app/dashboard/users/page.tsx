'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, type IconName } from '@/components/capta-icon';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface EmployeeStat {
  id: string;
  name: string;
  email: string;
  role: string;
  lastLoginAt: string | null;
  enrolled: number;
  completed: number;
  inProgress: number;
  avgProgress: number;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Config visual ────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; bg: string; icon: IconName }> = {
  OWNER:    { label: 'Propietario', color: 'text-amber-600 dark:text-amber-400',      bg: 'bg-amber-50 dark:bg-amber-500/10',        icon: 'shield' },
  ADMIN:    { label: 'Admin',       color: 'text-capta-deep dark:text-capta-soft',    bg: 'bg-capta-tint dark:bg-capta-soft/10',     icon: 'shield' },
  MANAGER:  { label: 'Manager',     color: 'text-emerald-600 dark:text-emerald-400',  bg: 'bg-emerald-50 dark:bg-emerald-500/10',    icon: 'gear' },
  EMPLOYEE: { label: 'Empleado',    color: 'text-muted-foreground',                   bg: 'bg-muted',                                icon: 'user' },
};

const INVITABLE_ROLES: { value: UserRole; label: string }[] = [
  { value: 'ADMIN',    label: 'Administrador' },
  { value: 'MANAGER',  label: 'Manager' },
  { value: 'EMPLOYEE', label: 'Empleado' },
];

// ─── Auxiliares ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: UserRole }) {
  const cfg = ROLE_CONFIG[role];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      <Icon name={cfg.icon} size={11} />
      {cfg.label}
    </span>
  );
}

function Avatar({ firstName, lastName, avatarUrl, size = 'md' }: {
  firstName: string; lastName: string; avatarUrl?: string | null; size?: 'sm' | 'md' | 'lg';
}) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const dim = size === 'sm' ? 'h-8 w-8 text-[11px]' : size === 'lg' ? 'h-16 w-16 text-xl' : 'h-10 w-10 text-xs';
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt={`${firstName} ${lastName}`} className={`${dim} rounded-full object-cover`} />;
  }
  return (
    <div
      className={`${dim} flex flex-shrink-0 items-center justify-center rounded-full font-bold`}
      style={{
        background: 'linear-gradient(140deg, color-mix(in srgb, var(--tenant-primary) 14%, white), color-mix(in srgb, var(--tenant-primary) 6%, white))',
        color: 'var(--tenant-primary)',
        boxShadow: '0 0 0 1.5px color-mix(in srgb, var(--tenant-primary) 20%, transparent)',
      }}
    >
      {initials}
    </div>
  );
}

function MiniProgress({ value }: { value: number }) {
  const color = value === 100 ? '#16a34a' : value > 0 ? '#7FD1AE' : '#cbd5e1';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold text-foreground w-8 text-right">{value}%</span>
    </div>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return 'Nunca';
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

function formatDateRelative(iso: string | null): string {
  if (!iso) return 'Nunca';
  const d    = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff < 7)  return `Hace ${diff} días`;
  return formatDate(iso);
}

// ─── Bulk Import: tipos y parser ──────────────────────────────────────────────

type BulkRole = 'EMPLOYEE' | 'ADMIN' | 'MANAGER';

interface ParsedRow {
  rowNum:    number;
  email:     string;
  firstName: string;
  lastName:  string;
  role:      BulkRole;
  errors:    string[];
}

interface BulkResult {
  email:    string;
  status:   'sent' | 'duplicate' | 'error';
  message?: string;
}

const ROLE_MAP: Record<string, BulkRole> = {
  employee: 'EMPLOYEE', empleado: 'EMPLOYEE',
  admin: 'ADMIN', administrador: 'ADMIN',
  manager: 'MANAGER', gerente: 'MANAGER',
};

const VALID_ROLES: BulkRole[] = ['EMPLOYEE', 'ADMIN', 'MANAGER'];

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const sep     = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/["']/g, ''));

  const idx = {
    email:     headers.findIndex(h => ['email', 'correo'].includes(h)),
    firstName: headers.findIndex(h => ['firstname', 'nombre', 'first_name', 'name'].includes(h)),
    lastName:  headers.findIndex(h => ['lastname', 'apellido', 'last_name', 'surname'].includes(h)),
    role:      headers.findIndex(h => ['role', 'rol', 'puesto'].includes(h)),
  };

  if (idx.email === -1 || idx.firstName === -1 || idx.lastName === -1) {
    throw new Error('Columnas requeridas no encontradas. Usa: email, firstName (o nombre), lastName (o apellido)');
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return lines.slice(1).map((line, i) => {
    const cells     = line.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''));
    const email     = cells[idx.email]     ?? '';
    const firstName = cells[idx.firstName] ?? '';
    const lastName  = cells[idx.lastName]  ?? '';
    const rawRole   = idx.role !== -1 ? (cells[idx.role] ?? '') : 'EMPLOYEE';
    const role      = (ROLE_MAP[rawRole.toLowerCase()] ?? rawRole.toUpperCase()) as BulkRole;

    const errors: string[] = [];
    if (!EMAIL_RE.test(email))       errors.push('Email inválido');
    if (!firstName.trim())           errors.push('Nombre requerido');
    if (!lastName.trim())            errors.push('Apellido requerido');
    if (!VALID_ROLES.includes(role)) errors.push('Rol inválido (EMPLOYEE, ADMIN, MANAGER)');

    return { rowNum: i + 2, email, firstName, lastName, role, errors };
  });
}

function downloadTemplate(): void {
  const csv = [
    'email,firstName,lastName,role',
    'juan.perez@empresa.com,Juan,Pérez,EMPLOYEE',
    'ana.garcia@empresa.com,Ana,García,MANAGER',
    'luis.torres@empresa.com,Luis,Torres,ADMIN',
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'plantilla-usuarios.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ─── Modal: Importar CSV ──────────────────────────────────────────────────────

type BulkStep = 'upload' | 'preview' | 'submitting' | 'results';

function BulkImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (count: number) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step,       setStep]       = useState<BulkStep>('upload');
  const [rows,       setRows]       = useState<ParsedRow[]>([]);
  const [results,    setResults]    = useState<BulkResult[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [progress,   setProgress]   = useState(0);

  const validRows   = rows.filter(r => r.errors.length === 0);
  const invalidRows = rows.filter(r => r.errors.length > 0);

  const handleFile = (file: File) => {
    setParseError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseCSV(e.target?.result as string);
        if (parsed.length === 0) { setParseError('El archivo está vacío o no tiene filas de datos.'); return; }
        if (parsed.length > 100) { setParseError(`El archivo tiene ${parsed.length} filas. El máximo es 100 por importación.`); return; }
        setRows(parsed);
        setStep('preview');
      } catch (err: unknown) {
        setParseError(err instanceof Error ? err.message : 'Error al leer el archivo.');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSubmit = async () => {
    if (validRows.length === 0) return;
    setStep('submitting');
    setProgress(0);

    const BATCH = 20;
    const allResults: BulkResult[] = [];

    for (let i = 0; i < validRows.length; i += BATCH) {
      const batch = validRows.slice(i, i + BATCH);
      try {
        const res = await api.post<BulkResult[]>('/users/invite-bulk', {
          users: batch.map(r => ({ email: r.email, firstName: r.firstName, lastName: r.lastName, role: r.role })),
        });
        allResults.push(...res.data);
      } catch {
        batch.forEach(r => allResults.push({ email: r.email, status: 'error', message: 'Error de red' }));
      }
      setProgress(Math.min(i + BATCH, validRows.length));
    }

    setResults(allResults);
    setStep('results');
    const sent = allResults.filter(r => r.status === 'sent').length;
    if (sent > 0) onSuccess(sent);
  };

  const STATUS_CFG = {
    sent:      { label: 'Enviada',   color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: 'check-circle' as IconName },
    duplicate: { label: 'Duplicado', color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/20',     icon: 'alert-circle' as IconName },
    error:     { label: 'Error',     color: 'text-red-600 dark:text-red-400',          bg: 'bg-red-50 dark:bg-red-900/20',         icon: 'x-circle'     as IconName },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={step === 'submitting' ? undefined : onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-capta-tint dark:bg-capta-soft/10">
              <Icon name="users" size={16} className="text-capta-deep dark:text-capta-soft" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Importar usuarios desde CSV</h2>
              <p className="text-xs text-muted-foreground">
                {step === 'upload'     && 'Sube un archivo CSV con los datos de tus empleados'}
                {step === 'preview'    && `${rows.length} fila${rows.length !== 1 ? 's' : ''} detectadas — ${validRows.length} válida${validRows.length !== 1 ? 's' : ''}`}
                {step === 'submitting' && `Enviando ${progress} de ${validRows.length} invitaciones…`}
                {step === 'results'    && 'Importación completada'}
              </p>
            </div>
          </div>
          {step !== 'submitting' && (
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
              <Icon name="close" size={16} />
            </button>
          )}
        </div>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="p-6 space-y-4">
            <div onDrop={handleDrop} onDragOver={e => e.preventDefault()} onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-muted/30 py-12 text-center cursor-pointer transition-colors hover:border-capta-soft/50 hover:bg-muted/50">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                <Icon name="upload" size={22} className="text-muted-foreground/60" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Arrastra tu CSV aquí</p>
                <p className="text-xs text-muted-foreground mt-0.5">o haz clic para seleccionar</p>
              </div>
              <p className="text-[11px] text-muted-foreground/60">CSV · Máximo 100 usuarios · UTF-8 o Excel (;)</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

            {parseError && (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5">
                <Icon name="alert-circle" size={15} className="mt-0.5 flex-shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{parseError}</p>
              </div>
            )}

            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2.5">
              <p className="text-xs font-semibold text-foreground">Formato esperado:</p>
              <div className="overflow-x-auto rounded-lg border border-border bg-background">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      {['email', 'firstName', 'lastName', 'role'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-mono font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-3 py-2 text-foreground/70 font-mono">juan@empresa.com</td>
                      <td className="px-3 py-2 text-foreground/70 font-mono">Juan</td>
                      <td className="px-3 py-2 text-foreground/70 font-mono">Pérez</td>
                      <td className="px-3 py-2 text-foreground/70 font-mono">EMPLOYEE</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground/70">
                Roles válidos: <code className="font-mono bg-muted px-1 rounded">EMPLOYEE</code> · <code className="font-mono bg-muted px-1 rounded">ADMIN</code> · <code className="font-mono bg-muted px-1 rounded">MANAGER</code>
                {' '}(también acepta español: empleado, administrador, manager)
              </p>
              <button onClick={downloadTemplate}
                className="flex items-center gap-1.5 text-xs font-medium text-capta-deep dark:text-capta-soft hover:underline">
                <Icon name="download" size={12} /> Descargar plantilla CSV
              </button>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div className="flex flex-col">
            <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-muted/20">
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <Icon name="check-circle" size={13} /> {validRows.length} válidas
              </span>
              {invalidRows.length > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                  <Icon name="alert-circle" size={13} /> {invalidRows.length} con errores (se omitirán)
                </span>
              )}
            </div>
            <div className="max-h-[340px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card border-b border-border">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">#</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Email</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden sm:table-cell">Nombre</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Rol</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.rowNum} className={`border-b border-border last:border-0 ${row.errors.length > 0 ? 'bg-destructive/5' : ''}`}>
                      <td className="px-4 py-2.5 tabular-nums text-muted-foreground/60">{row.rowNum}</td>
                      <td className="px-4 py-2.5 font-mono text-foreground max-w-[180px] truncate">{row.email}</td>
                      <td className="px-4 py-2.5 text-foreground hidden sm:table-cell">{row.firstName} {row.lastName}</td>
                      <td className="px-4 py-2.5">
                        <span className="rounded-full bg-muted px-2 py-0.5 font-mono">{row.role}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        {row.errors.length === 0 ? (
                          <Icon name="check-circle" size={14} className="text-emerald-500" />
                        ) : (
                          <div className="flex items-center gap-1 text-destructive">
                            <Icon name="alert-circle" size={13} />
                            <span className="text-[11px]">{row.errors.join(', ')}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
              <button onClick={() => { setRows([]); setStep('upload'); }}
                className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                <Icon name="arrow-left" size={14} /> Cambiar archivo
              </button>
              <button disabled={validRows.length === 0} onClick={handleSubmit}
                className="flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)', boxShadow: '0 2px 10px color-mix(in srgb, var(--tenant-primary) 25%, transparent)' }}>
                <Icon name="mail" size={14} />
                Enviar {validRows.length} invitación{validRows.length !== 1 ? 'es' : ''}
              </button>
            </div>
          </div>
        )}

        {/* Step: Submitting */}
        {step === 'submitting' && (
          <div className="flex flex-col items-center justify-center gap-5 px-6 py-14">
            <Icon name="refresh" size={32} className="animate-spin text-capta-deep dark:text-capta-soft" />
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">Enviando invitaciones…</p>
              <p className="mt-1 text-xs text-muted-foreground">{progress} de {validRows.length} enviadas</p>
            </div>
            <div className="w-full max-w-xs">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${(progress / validRows.length) * 100}%`, background: 'linear-gradient(90deg, #1E4F7A, #7FD1AE)' }} />
              </div>
            </div>
          </div>
        )}

        {/* Step: Results */}
        {step === 'results' && (
          <div className="flex flex-col">
            <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
              {(['sent', 'duplicate', 'error'] as const).map(s => {
                const cfg   = STATUS_CFG[s];
                const count = results.filter(r => r.status === s).length;
                return (
                  <div key={s} className="flex flex-col items-center justify-center py-4 gap-0.5">
                    <p className={`text-2xl font-bold ${cfg.color}`}>{count}</p>
                    <p className="text-xs text-muted-foreground">{cfg.label}{count !== 1 ? 's' : ''}</p>
                  </div>
                );
              })}
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {results.map((r, i) => {
                const cfg = STATUS_CFG[r.status];
                return (
                  <div key={i} className={`flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 ${cfg.bg}`}>
                    <Icon name={cfg.icon} size={14} className={cfg.color} />
                    <span className="flex-1 min-w-0 font-mono text-xs text-foreground truncate">{r.email}</span>
                    <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                    {r.message && <span className="text-[11px] text-muted-foreground truncate max-w-[160px]">{r.message}</span>}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end border-t border-border px-6 py-4">
              <button onClick={onClose} className="rounded-xl px-5 py-2 text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)' }}>
                Cerrar
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Modal: Invitar usuario ───────────────────────────────────────────────────

interface InviteForm {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

function InviteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm]     = useState<InviteForm>({ email: '', firstName: '', lastName: '', role: 'EMPLOYEE' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
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
            <Icon name="close" size={16} />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5">
            <Icon name="alert-circle" size={15} className="mt-0.5 flex-shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">Email</label>
            <input type="email" required placeholder="usuario@empresa.com" value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-capta-soft/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Nombre</label>
              <input required placeholder="Juan" value={form.firstName}
                onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-capta-soft/50" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Apellido</label>
              <input required placeholder="Pérez" value={form.lastName}
                onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-capta-soft/50" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">Rol</label>
            <div className="relative">
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as UserRole }))}
                className="w-full appearance-none rounded-xl border border-border bg-background px-4 py-2.5 pr-10 text-sm text-foreground outline-none transition-all focus:border-capta-soft/50 cursor-pointer">
                {INVITABLE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50">
                <Icon name="chevron-down" size={14} />
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)', boxShadow: '0 2px 10px color-mix(in srgb, var(--tenant-primary) 25%, transparent)' }}>
              {loading ? <Icon name="refresh" size={15} className="animate-spin" /> : <Icon name="mail" size={15} />}
              {loading ? 'Enviando…' : 'Enviar invitación'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── UserRow ──────────────────────────────────────────────────────────────────

function UserRow({ user, onUpdate, onDelete, onOpen, currentUserId }: {
  user:          UserItem;
  onUpdate:      (id: string, data: Partial<UserItem>) => void;
  onDelete:      (id: string) => void;
  onOpen:        (user: UserItem) => void;
  currentUserId: string;
}) {
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const isMe    = user.id === currentUserId;
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
    setLoading(true);
    setDeleteConfirm(false);
    try {
      await api.delete(`/users/${user.id}`);
      onDelete(user.id);
    } finally {
      setLoading(false);
      setMenuOpen(false);
    }
  };

  return (
    <div
      onClick={() => onOpen(user)}
      className={`group flex cursor-pointer items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 transition-all duration-150 hover:-translate-y-px hover:border-capta-soft/40 hover:bg-muted/30 ${!user.isActive ? 'opacity-60' : ''}`}
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset, 0 1px 4px rgba(11,31,42,0.04)' }}
    >
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
            <span className="rounded-full bg-capta-tint dark:bg-capta-soft/10 px-2 py-0.5 text-xs font-medium text-capta-deep dark:text-capta-soft">Tú</span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</p>
      </div>

      <div className="hidden text-right md:block">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">Último acceso</p>
        <p className="text-xs font-medium text-foreground mt-0.5">{formatDateRelative(user.lastLoginAt)}</p>
      </div>

      {/* Acción rápida — stopPropagation para no disparar el drawer */}
      <div className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
        {loading ? (
          <Icon name="refresh" size={16} className="animate-spin text-muted-foreground" />
        ) : (
          <button
            disabled={isMe || isOwner}
            onClick={() => setMenuOpen(p => !p)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
            title="Acciones"
          >
            <Icon name="more-horizontal" size={16} />
          </button>
        )}

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.1 }}
              className="absolute right-0 top-9 z-30 min-w-[180px] rounded-xl border border-border bg-card p-1 shadow-xl"
            >
              {!deleteConfirm && (
                <button onClick={handleToggleActive}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted">
                  {user.isActive
                    ? <><Icon name="user-minus" size={14} className="text-muted-foreground" /> Desactivar</>
                    : <><Icon name="check-circle" size={14} className="text-emerald-500" /> Activar</>
                  }
                </button>
              )}
              <AnimatePresence mode="wait">
                {deleteConfirm ? (
                  <motion.div key="confirm"
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden">
                    <div className="px-3 py-2 rounded-lg bg-destructive/5 border border-destructive/20 m-0.5 space-y-2">
                      <p className="text-xs font-semibold text-destructive leading-snug">¿Eliminar a {user.firstName}?</p>
                      <p className="text-[11px] text-muted-foreground">Esta acción no se puede deshacer.</p>
                      <div className="flex gap-1.5 pt-0.5">
                        <button onClick={() => setDeleteConfirm(false)}
                          className="flex-1 rounded-lg py-1 text-xs text-muted-foreground hover:bg-muted transition-colors">
                          Cancelar
                        </button>
                        <button onClick={handleDelete}
                          className="flex-1 rounded-lg py-1 text-xs font-semibold text-white bg-destructive hover:bg-destructive/90 transition-colors">
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="my-1 h-px bg-border" />
                    <button onClick={() => setDeleteConfirm(true)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/8">
                      <Icon name="trash" size={14} />
                      Eliminar usuario
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── UserDrawer ───────────────────────────────────────────────────────────────

function UserDrawer({ user, stats, statsLoading, onClose, onUpdate, onDelete, currentUserId }: {
  user:          UserItem;
  stats:         EmployeeStat | null;
  statsLoading:  boolean;
  onClose:       () => void;
  onUpdate:      (id: string, data: Partial<UserItem>) => void;
  onDelete:      (id: string) => void;
  currentUserId: string;
}) {
  const [actionLoading,  setActionLoading]  = useState(false);
  const [deleteConfirm,  setDeleteConfirm]  = useState(false);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const isMe    = user.id === currentUserId;
  const isOwner = user.role === 'OWNER';
  const canEdit = !isMe && !isOwner;

  const handleToggleActive = async () => {
    setActionLoading(true);
    try {
      const updated = await api.patch<UserItem>(`/users/${user.id}`, { isActive: !user.isActive });
      onUpdate(user.id, { isActive: updated.data.isActive });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await api.delete(`/users/${user.id}`);
      onDelete(user.id);
      onClose();
    } finally {
      setActionLoading(false);
      setDeleteConfirm(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-black"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed right-0 top-0 bottom-0 z-50 flex w-80 flex-col bg-card border-l border-border shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <p className="text-sm font-semibold text-foreground">Perfil del usuario</p>
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto">

          {/* Identity block */}
          <div className="flex flex-col items-center gap-3 px-5 py-6 border-b border-border">
            <Avatar firstName={user.firstName} lastName={user.lastName} avatarUrl={user.avatarUrl} size="lg" />
            <div className="text-center">
              <p className="text-base font-semibold text-foreground">{user.firstName} {user.lastName}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{user.email}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <RoleBadge role={user.role} />
              {user.isActive ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <Icon name="check-circle" size={10} /> Activo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Inactivo
                </span>
              )}
              {isMe && (
                <span className="rounded-full bg-capta-tint dark:bg-capta-soft/10 px-2 py-0.5 text-xs font-medium text-capta-deep dark:text-capta-soft">Tú</span>
              )}
            </div>
          </div>

          {/* Access info */}
          <div className="px-5 py-4 border-b border-border space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Acceso</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <Icon name="clock" size={12} /> Último acceso
                </span>
                <span className="text-xs font-medium text-foreground">{formatDateRelative(user.lastLoginAt)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <Icon name="calendar" size={12} /> Miembro desde
                </span>
                <span className="text-xs font-medium text-foreground">{formatDate(user.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Stats / Progress */}
          <div className="px-5 py-4 border-b border-border space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Actividad de aprendizaje</p>
            {statsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-4 bg-muted rounded animate-pulse" style={{ width: `${[60, 80, 45][i]}%` }} />
                ))}
              </div>
            ) : !stats ? (
              <p className="text-xs text-muted-foreground">Sin datos de actividad disponibles.</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Inscritos',   value: stats.enrolled,   accent: '#8FC4E8' },
                    { label: 'En progreso', value: stats.inProgress, accent: '#7FD1AE' },
                    { label: 'Completados', value: stats.completed,  accent: '#F59E0B' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl border border-border bg-background p-2.5 text-center">
                      <p className="text-base font-bold text-foreground">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
                {stats.enrolled > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Progreso promedio</span>
                    </div>
                    <MiniProgress value={stats.avgProgress} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions — only for non-me, non-owner */}
          {canEdit && (
            <div className="px-5 py-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Acciones</p>

              <button
                onClick={handleToggleActive}
                disabled={actionLoading}
                className="flex w-full items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60"
              >
                {actionLoading ? (
                  <Icon name="refresh" size={14} className="animate-spin text-muted-foreground" />
                ) : user.isActive ? (
                  <Icon name="user-minus" size={14} className="text-muted-foreground" />
                ) : (
                  <Icon name="check-circle" size={14} className="text-emerald-500" />
                )}
                {user.isActive ? 'Desactivar cuenta' : 'Activar cuenta'}
              </button>

              <AnimatePresence mode="wait" initial={false}>
                {!deleteConfirm ? (
                  <motion.button key="del-btn"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={() => setDeleteConfirm(true)}
                    disabled={actionLoading}
                    className="flex w-full items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-60"
                  >
                    <Icon name="trash" size={14} />
                    Eliminar usuario
                  </motion.button>
                ) : (
                  <motion.div key="del-confirm"
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 space-y-2">
                    <p className="text-xs font-semibold text-destructive">¿Eliminar a {user.firstName}?</p>
                    <p className="text-[11px] text-muted-foreground">Esta acción es permanente y no se puede deshacer.</p>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setDeleteConfirm(false)}
                        className="flex-1 rounded-lg border border-border py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
                        Cancelar
                      </button>
                      <button onClick={handleDelete} disabled={actionLoading}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold text-white bg-destructive hover:bg-destructive/90 disabled:opacity-60 transition-all">
                        {actionLoading && <Icon name="refresh" size={10} className="animate-spin" />}
                        Eliminar
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function UsersPage() {
  const { success: toastSuccess } = useToast();

  const [data,        setData]        = useState<PaginatedUsers | null>(null);
  const [invites,     setInvites]     = useState<PendingInvite[]>([]);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [inviteModal, setInviteModal] = useState(false);
  const [bulkModal,   setBulkModal]   = useState(false);
  const [tab,         setTab]         = useState<'users' | 'invites'>('users');

  // Search + filter (client-side sobre la página actual)
  const [searchInput, setSearchInput]   = useState('');
  const search = useDebounce(searchInput, 300);
  const [roleFilter, setRoleFilter]     = useState<UserRole | 'ALL'>('ALL');

  // Drawer
  const [drawerUserId,   setDrawerUserId]   = useState<string | null>(null);
  const [drawerStats,    setDrawerStats]    = useState<EmployeeStat | null>(null);
  const [drawerLoading,  setDrawerLoading]  = useState(false);
  const statsCache = useRef<Map<string, EmployeeStat>>(new Map());

  const drawerUser = useMemo(
    () => data?.data.find(u => u.id === drawerUserId) ?? null,
    [data, drawerUserId]
  );

  const [currentUserId] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') ?? '{}').id ?? ''; } catch { return ''; }
  });

  // Filtered list (client-side sobre página actual)
  const filteredUsers = useMemo(() => {
    if (!data?.data) return [];
    return data.data.filter(u => {
      const q           = search.toLowerCase();
      const matchSearch = q === '' ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);
      const matchRole   = roleFilter === 'ALL' || u.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [data, search, roleFilter]);

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

  // Close drawer when drawerUser disappears (e.g. deleted)
  useEffect(() => {
    if (drawerUserId && !drawerUser) setDrawerUserId(null);
  }, [drawerUser, drawerUserId]);

  const openDrawer = useCallback(async (user: UserItem) => {
    setDrawerUserId(user.id);
    // Check cache
    if (statsCache.current.has(user.id)) {
      setDrawerStats(statsCache.current.get(user.id)!);
      return;
    }
    setDrawerLoading(true);
    setDrawerStats(null);
    try {
      const res = await api.get<EmployeeStat[]>('/analytics/employees');
      res.data.forEach(e => statsCache.current.set(e.id, e));
      setDrawerStats(statsCache.current.get(user.id) ?? null);
    } catch {
      setDrawerStats(null);
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  const handleUpdate = (id: string, patch: Partial<UserItem>) => {
    setData(prev => prev ? {
      ...prev, data: prev.data.map(u => u.id === id ? { ...u, ...patch } : u),
    } : prev);
    // Update cache
    if (statsCache.current.has(id)) {
      const cached = statsCache.current.get(id)!;
      statsCache.current.set(id, { ...cached });
    }
  };

  const handleDelete = (id: string) => {
    setData(prev => prev ? {
      ...prev,
      data:  prev.data.filter(u => u.id !== id),
      total: prev.total - 1,
    } : prev);
    if (drawerUserId === id) setDrawerUserId(null);
  };

  const handleInviteSuccess = () => {
    setInviteModal(false);
    toastSuccess('Invitación enviada correctamente');
    void fetchInvites();
  };

  const handleBulkSuccess = (count: number) => {
    toastSuccess(`${count} invitación${count !== 1 ? 'es' : ''} enviada${count !== 1 ? 's' : ''} correctamente`);
    void fetchInvites();
  };

  const handleCancelInvite = async (id: string) => {
    try {
      await api.delete(`/users/invites/${id}`);
      setInvites(prev => prev.filter(i => i.id !== id));
    } catch {
      // ignore
    }
  };

  const totalActive = data?.data.filter(u => u.isActive).length ?? 0;

  return (
    <div className="min-h-full p-6 lg:p-8">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="mb-8 flex flex-wrap items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Usuarios</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gestiona los miembros de tu empresa y sus permisos.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setBulkModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:border-capta-deep/20 hover:bg-muted hover:text-foreground">
            <Icon name="upload" size={15} /> Importar CSV
          </button>
          <button onClick={() => setInviteModal(true)}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)', boxShadow: '0 2px 10px color-mix(in srgb, var(--tenant-primary) 25%, transparent)' }}>
            <Icon name="user-plus" size={16} /> Invitar usuario
          </button>
        </div>
      </motion.div>

      {/* Stats */}
      {data && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[
            { label: 'Total usuarios', value: data.total,     icon: 'users'        as const, accent: 'var(--tenant-primary)' },
            { label: 'Activos',        value: totalActive,    icon: 'check-circle' as const, accent: '#7FD1AE' },
            { label: 'Invitaciones',   value: invites.length, icon: 'mail'         as const, accent: '#8FC4E8' },
          ].map((stat, i) => (
            <motion.div key={stat.label}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30, delay: i * 0.06 }}
              className="rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5"
              style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{stat.label}</p>
                <div className="h-7 w-7 flex items-center justify-center rounded-lg"
                  style={{ background: `${stat.accent}15`, border: `1px solid ${stat.accent}22` }}>
                  <Icon name={stat.icon} size={13} style={{ color: stat.accent }} />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-xl border border-border bg-muted p-1 w-fit">
        {(['users', 'invites'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
              tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {t === 'users' ? 'Miembros' : `Invitaciones${invites.length > 0 ? ` (${invites.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* Lista de usuarios */}
      {tab === 'users' && (
        <>
          {/* Search + role filter */}
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Icon name="search" size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por nombre o email…"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="w-full rounded-xl border border-border bg-background pl-9 pr-9 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-capta-soft/60 transition-all"
              />
              <AnimatePresence>
                {searchInput && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
                    onClick={() => setSearchInput('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    <Icon name="close" size={14} />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Role filter */}
            <div className="relative sm:w-44 flex-shrink-0">
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value as UserRole | 'ALL')}
                className="w-full appearance-none rounded-xl border border-border bg-background px-3 py-2.5 pr-8 text-sm text-foreground outline-none transition-all focus:border-capta-soft/50 cursor-pointer"
              >
                <option value="ALL">Todos los roles</option>
                {(['OWNER', 'ADMIN', 'MANAGER', 'EMPLOYEE'] as UserRole[]).map(r => (
                  <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50">
                <Icon name="chevron-down" size={14} />
              </div>
            </div>
          </div>

          {/* User list */}
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                  <div className="h-9 w-9 rounded-full bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="h-3.5 w-36 rounded bg-muted" />
                    <div className="h-3 w-48 rounded bg-muted/60" />
                  </div>
                  <div className="h-5 w-16 rounded-full bg-muted flex-shrink-0" />
                </div>
              ))}
            </div>
          ) :!data || filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center gap-3">
              <Icon name="users" size={32} className="text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {search || roleFilter !== 'ALL' ? 'Sin resultados' : 'Sin usuarios'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search || roleFilter !== 'ALL'
                    ? 'Ajusta los filtros para ver más resultados.'
                    : 'Invita miembros de tu equipo para comenzar.'}
                </p>
              </div>
              {(search || roleFilter !== 'ALL') && (
                <button onClick={() => { setSearchInput(''); setRoleFilter('ALL'); }}
                  className="text-xs font-semibold text-capta-deep dark:text-capta-soft hover:underline">
                  Limpiar filtros →
                </button>
              )}
            </div>
          ) : (
            <motion.div
              initial="hidden" animate="show"
              variants={{ show: { transition: { staggerChildren: 0.04 } } }}
              className="space-y-2"
            >
              {filteredUsers.map(user => (
                <motion.div key={user.id}
                  variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
                  <UserRow
                    user={user}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    onOpen={openDrawer}
                    currentUserId={currentUserId}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Página {data.page} de {data.totalPages} — {data.total} usuarios
              </p>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-all hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40">
                  <Icon name="chevron-left" size={15} />
                </button>
                <button disabled={page >= (data.totalPages ?? 1)} onClick={() => setPage(p => p + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-all hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40">
                  <Icon name="chevron-right" size={15} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Invitaciones pendientes */}
      {tab === 'invites' && (
        <div>
          {invites.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center gap-3">
              <Icon name="mail" size={32} className="text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium text-foreground">Sin invitaciones pendientes</p>
                <p className="mt-1 text-sm text-muted-foreground">Las invitaciones activas aparecerán aquí.</p>
              </div>
            </div>
          ) : (
            <motion.div initial="hidden" animate="show"
              variants={{ show: { transition: { staggerChildren: 0.04 } } }}
              className="space-y-2">
              {invites.map(inv => (
                <motion.div key={inv.id}
                  variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3"
                  style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset' }}
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{ background: '#DCE9F4', color: 'var(--tenant-primary)' }}>
                    {inv.firstName.charAt(0)}{inv.lastName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{inv.firstName} {inv.lastName}</span>
                      <RoleBadge role={inv.role} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {inv.email} · Invitado por {inv.invitedBy.firstName} {inv.invitedBy.lastName}
                    </p>
                  </div>
                  <div className="hidden text-right md:block">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Icon name="clock" size={11} /> Expira {formatDate(inv.expiresAt)}
                    </div>
                  </div>
                  <button onClick={() => handleCancelInvite(inv.id)}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    title="Cancelar invitación">
                    <Icon name="close" size={15} />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {inviteModal && (
          <InviteModal onClose={() => setInviteModal(false)} onSuccess={handleInviteSuccess} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {bulkModal && (
          <BulkImportModal onClose={() => setBulkModal(false)} onSuccess={handleBulkSuccess} />
        )}
      </AnimatePresence>

      {/* Drawer */}
      <AnimatePresence>
        {drawerUser && (
          <UserDrawer
            user={drawerUser}
            stats={drawerStats}
            statsLoading={drawerLoading}
            onClose={() => setDrawerUserId(null)}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            currentUserId={currentUserId}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
