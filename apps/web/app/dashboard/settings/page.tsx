'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/capta-icon';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TenantData {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  isActive: boolean;
}

interface PlanInfo {
  type: string;
  hasWhiteLabel: boolean;
}

// ─── Palette de colores preestablecidos ───────────────────────────────────────

const COLOR_PALETTE = [
  { hex: '#1E4F7A', label: 'Capta Navy' },
  { hex: '#0B2840', label: 'Deep Navy' },
  { hex: '#1F5C4D', label: 'Capta Teal' },
  { hex: '#7FD1AE', label: 'Mint' },
  { hex: '#2563EB', label: 'Azul' },
  { hex: '#7C3AED', label: 'Violeta' },
  { hex: '#DC2626', label: 'Rojo' },
  { hex: '#D97706', label: 'Ámbar' },
  { hex: '#059669', label: 'Esmeralda' },
  { hex: '#0F172A', label: 'Slate' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidHex(v: string) {
  return /^#([0-9a-fA-F]{6})$/.test(v);
}

// ─── Section card ─────────────────────────────────────────────────────────────

function Section({ title, description, children }: {
  title: string; description?: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden"
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 4px 16px rgba(11,31,42,0.04)' }}>
      <div className="px-6 py-5 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ─── Logo upload zone ─────────────────────────────────────────────────────────

function LogoUpload({ currentUrl, tenantName, onUploaded, onError }: {
  currentUrl: string | null;
  tenantName: string;
  onUploaded: (url: string) => void;
  onError:    (msg: string) => void;
}) {
  const [uploading,     setUploading]     = useState(false);
  const [dragOver,      setDragOver]      = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      onError('Solo se permiten archivos de imagen (PNG, SVG, WebP, JPG)');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      onError('El archivo supera el tamaño máximo de 2 MB');
      return;
    }
    setUploading(true);
    try {
      // 1. Obtener URL firmada de MinIO
      const { data: presigned } = await api.post<{ uploadUrl: string; key: string; publicUrl: string }>('/storage/presigned-upload', {
        fileName:    file.name,
        folder:      'logos',
        contentType: file.type,
        isPublic:    true,
      });

      // 2. Subir directamente a MinIO con la URL firmada (timeout 20s)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);
      let uploadRes: Response;
      try {
        uploadRes = await fetch(presigned.uploadUrl, {
          method:  'PUT',
          body:    file,
          headers: { 'Content-Type': file.type },
          signal:  controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!uploadRes.ok) {
        throw new Error(`Error al subir el archivo (${uploadRes.status})`);
      }

      // 3. Notificar al padre con la URL pública
      onUploaded(presigned.publicUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al subir el logo';
      onError(msg);
    } finally {
      setUploading(false);
    }
  }, [onUploaded, onError]);

  const initials = tenantName
    ? tenantName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div className="flex items-start gap-6">
      {/* Preview */}
      <div className="relative flex-shrink-0">
        <div
          className="h-20 w-20 rounded-2xl overflow-hidden flex items-center justify-center border-2 border-border"
          style={{
            background: currentUrl ? 'transparent' : 'linear-gradient(135deg, #1E4F7A, #2D6FA0)',
          }}
        >
          {currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUrl} alt="Logo" className="h-full w-full object-contain" />
          ) : (
            <span className="text-xl font-bold text-white">{initials}</span>
          )}
        </div>
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40">
            <Icon name="refresh" size={20} className="text-white animate-spin" />
          </div>
        )}
      </div>

      {/* Upload zone */}
      <div className="flex-1">
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 transition-all ${
            dragOver
              ? 'border-capta-deep bg-capta-tint/30 dark:border-capta-soft dark:bg-capta-soft/5'
              : 'border-border hover:border-capta-deep/30 hover:bg-muted/30'
          }`}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
            <Icon name="upload" size={16} className="text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Arrastra tu logo aquí</p>
            <p className="text-xs text-muted-foreground">PNG, SVG, WebP — máx 2 MB</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>

        <AnimatePresence mode="wait">
          {currentUrl && !confirmRemove && (
            <motion.button
              key="remove-btn"
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmRemove(true)}
              className="mt-2 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Eliminar logo
            </motion.button>
          )}
          {confirmRemove && (
            <motion.div
              key="remove-confirm"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-2 flex items-center gap-2 text-xs"
            >
              <span className="text-muted-foreground">¿Eliminar el logo?</span>
              <button
                type="button"
                onClick={() => { onUploaded(''); setConfirmRemove(false); }}
                className="font-semibold text-destructive hover:underline"
              >
                Sí, eliminar
              </button>
              <span className="text-muted-foreground/30">·</span>
              <button
                type="button"
                onClick={() => setConfirmRemove(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Color picker ─────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const [custom, setCustom] = useState(value && !COLOR_PALETTE.some(c => c.hex === value) ? value : '');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {COLOR_PALETTE.map(c => (
          <button
            key={c.hex}
            type="button"
            title={c.label}
            onClick={() => { onChange(c.hex); setCustom(''); }}
            className="relative h-9 w-9 rounded-xl border-2 transition-all hover:scale-110"
            style={{
              background: c.hex,
              borderColor: value === c.hex ? '#fff' : 'transparent',
              boxShadow:   value === c.hex ? `0 0 0 2px ${c.hex}` : 'none',
            }}
          >
            {value === c.hex && (
              <Icon name="check" size={14} className="absolute inset-0 m-auto text-white drop-shadow" />
            )}
          </button>
        ))}
      </div>

      {/* Custom hex */}
      <div className="flex items-center gap-3">
        <div
          className="h-9 w-9 flex-shrink-0 rounded-xl border border-border"
          style={{ background: isValidHex(custom) ? custom : '#e5e7eb' }}
        />
        <input
          type="text"
          placeholder="#1E4F7A"
          value={custom}
          onChange={e => {
            const v = e.target.value;
            setCustom(v);
            if (isValidHex(v)) onChange(v);
          }}
          maxLength={7}
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-capta-deep/20 dark:focus:ring-capta-soft/20"
        />
        {isValidHex(custom) && custom !== value && (
          <button
            type="button"
            onClick={() => onChange(custom)}
            className="text-xs font-medium text-capta-deep dark:text-capta-soft"
          >
            Aplicar
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => { onChange(''); setCustom(''); }}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Usar color predeterminado (Capta)
      </button>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [tenant,  setTenant]  = useState<TenantData | null>(null);
  const [plan,    setPlan]    = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  // Form state
  const [name,         setName]         = useState('');
  const [logoUrl,      setLogoUrl]      = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [domain,       setDomain]       = useState('');

  const isDirty = tenant
    ? name         !== tenant.name
      || logoUrl      !== (tenant.logoUrl      ?? '')
      || primaryColor !== (tenant.primaryColor ?? '')
      || domain       !== (tenant.domain       ?? '')
    : false;

  useEffect(() => {
    Promise.all([
      api.get<TenantData>('/tenants/me'),
      api.get<{ plan: PlanInfo }>('/subscriptions/me').catch(() => ({ data: { plan: { type: 'FREE', hasWhiteLabel: false } } })),
    ])
      .then(([t, s]) => {
        const d = t.data;
        setTenant(d);
        setName(d.name);
        setLogoUrl(d.logoUrl ?? '');
        setPrimaryColor(d.primaryColor ?? '');
        setDomain(d.domain ?? '');
        setPlan(s.data.plan);
      })
      .catch(() => toastError('No se pudo cargar la configuración'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    if (!isDirty) return;
    setSaving(true);
    try {
      const { data } = await api.patch<TenantData>('/tenants/me', {
        name:         name.trim() || undefined,
        logoUrl:      logoUrl || undefined,
        primaryColor: primaryColor || undefined,
        domain:       domain || undefined,
      });
      setTenant(data);
      // Actualizar localStorage para que el layout refleje los cambios
      localStorage.setItem('tenant_logo',  data.logoUrl      ?? '');
      localStorage.setItem('tenant_color', data.primaryColor ?? '');
      localStorage.setItem('tenant_name',  data.name);
      toastSuccess('Configuración guardada');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Error al guardar';
      toastError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-6 animate-pulse space-y-4">
            <div className="h-4 w-40 bg-muted rounded" />
            <div className="h-20 bg-muted rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  const isEnterprise = plan?.type === 'ENTERPRISE';

  return (
    <div className="p-6 lg:p-8 max-w-2xl space-y-6">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="flex items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Configuración de empresa</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Personaliza la identidad visual de tu empresa en la plataforma.
          </p>
        </div>

        <AnimatePresence>
          {isDirty && (
            <motion.button
              key="save"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all hover:scale-[1.02] disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)', boxShadow: '0 2px 10px rgba(30,79,122,0.25)' }}
            >
              {saving
                ? <><Icon name="refresh" size={14} className="animate-spin" /> Guardando…</>
                : <><Icon name="save" size={14} /> Guardar cambios</>
              }
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.05 }}
      >
        <Section title="Logo de la empresa" description="Aparece en el sidebar y en los certificados generados.">
          <LogoUpload
            currentUrl={logoUrl || null}
            tenantName={name || tenant?.name || ''}
            onUploaded={setLogoUrl}
            onError={toastError}
          />
        </Section>
      </motion.div>

      {/* Color */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.1 }}
      >
        <Section
          title="Color de marca"
          description="Se usa en acentos visuales y elementos de navegación activa."
        >
          <ColorPicker value={primaryColor} onChange={setPrimaryColor} />

          {/* Preview live */}
          {primaryColor && isValidHex(primaryColor) && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: `${primaryColor}20` }}>
                <div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full"
                  style={{ background: primaryColor }} />
                <Icon name="book-open" size={14} style={{ color: primaryColor }} />
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">Vista previa del elemento activo</p>
                <p className="text-[11px] text-muted-foreground">Así se verá en el sidebar de navegación</p>
              </div>
              <div className="ml-auto flex h-6 items-center rounded-full px-2 text-[11px] font-semibold text-white"
                style={{ background: primaryColor }}>
                {primaryColor}
              </div>
            </div>
          )}
        </Section>
      </motion.div>

      {/* Datos de empresa */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.15 }}
      >
        <Section title="Datos de la empresa">
          <div className="space-y-4">
            {/* Nombre */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Nombre de la empresa
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={100}
                placeholder="Acme Corp"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-capta-deep/20 dark:focus:ring-capta-soft/20 transition-shadow"
              />
            </div>

            {/* Slug (readonly) */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Identificador URL <span className="normal-case font-normal">(inmutable)</span>
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2.5">
                <Icon name="globe" size={14} className="text-muted-foreground/50 flex-shrink-0" />
                <span className="text-sm text-muted-foreground font-mono">{tenant?.slug}</span>
                <Icon name="shield" size={12} className="ml-auto text-muted-foreground/30" />
              </div>
            </div>

            {/* Dominio */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Dominio personalizado
                {!isEnterprise && (
                  <div className="group relative inline-flex normal-case">
                    <span className="flex cursor-help items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:border-amber-800/30 dark:bg-amber-900/20 dark:text-amber-400">
                      <Icon name="shield" size={10} />
                      Enterprise
                    </span>
                    {/* Tooltip */}
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-52 -translate-x-1/2 rounded-xl border border-border bg-card px-3 py-2.5 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100">
                      <p className="mb-1.5 text-[11px] font-semibold text-foreground">Plan Enterprise incluye:</p>
                      <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                        <li>· Dominio personalizado</li>
                        <li>· White-label completo</li>
                        <li>· SSO / SAML</li>
                        <li>· Soporte prioritario</li>
                        <li>· Sub-empresas ilimitadas</li>
                      </ul>
                      <p className="mt-2 text-[10px] font-medium text-capta-deep dark:text-capta-soft">
                        Contacta a ventas para upgradar →
                      </p>
                      {/* Arrow */}
                      <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-border bg-card" />
                    </div>
                  </div>
                )}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={domain}
                  onChange={e => setDomain(e.target.value)}
                  maxLength={253}
                  placeholder="app.tuempresa.com"
                  disabled={!isEnterprise}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-capta-deep/20 dark:focus:ring-capta-soft/20 transition-shadow disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/40"
                />
                {!isEnterprise && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Icon name="shield" size={14} className="text-muted-foreground/30" />
                  </div>
                )}
              </div>
              {!isEnterprise && (
                <p className="mt-1 text-xs text-muted-foreground/60">
                  Disponible en el plan Enterprise. Permite usar tu propio dominio para la plataforma.
                </p>
              )}
            </div>
          </div>
        </Section>
      </motion.div>

      {/* Save bottom */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex justify-end pb-8"
      >
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-md active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)', boxShadow: isDirty ? '0 2px 10px rgba(30,79,122,0.25)' : 'none' }}
        >
          {saving
            ? <><Icon name="refresh" size={14} className="animate-spin" /> Guardando…</>
            : <><Icon name="save" size={14} /> Guardar cambios</>
          }
        </button>
      </motion.div>

    </div>
  );
}
