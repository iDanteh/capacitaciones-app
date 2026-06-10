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

// ─── Paleta ───────────────────────────────────────────────────────────────────

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

function isValidHex(v: string) {
  return /^#([0-9a-fA-F]{6})$/.test(v);
}

// ─── Bento card wrapper ───────────────────────────────────────────────────────

function BentoCard({
  icon,
  title,
  description,
  children,
  className = '',
  bodyClassName = '',
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={`flex flex-col rounded-[20px] border border-border bg-card overflow-hidden h-full ${className}`}
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 4px 20px rgba(11,31,42,0.05)' }}
    >
      <div className="flex items-center gap-2.5 px-[18px] py-[14px] border-b border-border flex-shrink-0">
        <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[8px] bg-capta-tint/70 dark:bg-capta-deep/20">
          {icon}
        </div>
        <div>
          <h2 className="text-[12.5px] font-semibold text-foreground leading-tight">{title}</h2>
          {description && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <div className={`p-[18px] flex-1 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

// ─── Save button ──────────────────────────────────────────────────────────────

function SaveButton({
  saving,
  disabled,
  onClick,
}: {
  saving: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 rounded-[12px] px-[18px] py-[9px] text-[13px] font-semibold text-white
        transition-all duration-150
        hover:-translate-y-px hover:scale-[1.01]
        active:scale-[0.97]
        disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:scale-100"
      style={{
        background: 'linear-gradient(140deg, #1E4F7A 0%, #2D6FA0 100%)',
        boxShadow: disabled
          ? 'none'
          : '0 2px 10px rgba(30,79,122,0.28), 0 1px 0 rgba(255,255,255,0.15) inset',
      }}
    >
      {saving ? (
        <>
          <Icon name="refresh" size={14} className="animate-spin" />
          Guardando…
        </>
      ) : (
        <>
          <Icon name="save" size={14} />
          Guardar cambios
        </>
      )}
    </button>
  );
}

// ─── Logo upload ──────────────────────────────────────────────────────────────

function LogoUpload({
  currentUrl,
  tenantName,
  onUploaded,
  onError,
}: {
  currentUrl: string | null;
  tenantName: string;
  onUploaded: (url: string) => void;
  onError: (msg: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
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
        const { data: presigned } = await api.post<{
          uploadUrl: string;
          key: string;
          publicUrl: string;
        }>('/storage/presigned-upload', {
          fileName: file.name,
          folder: 'logos',
          contentType: file.type,
          isPublic: true,
        });
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20_000);
        let uploadRes: Response;
        try {
          uploadRes = await fetch(presigned.uploadUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }
        if (!uploadRes.ok) throw new Error(`Error al subir el archivo (${uploadRes.status})`);
        onUploaded(presigned.publicUrl);
      } catch (err: unknown) {
        onError(err instanceof Error ? err.message : 'Error al subir el logo');
      } finally {
        setUploading(false);
      }
    },
    [onUploaded, onError],
  );

  const initials = tenantName
    ? tenantName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Preview avatar + drop zone en fila */}
      <div className="flex items-stretch gap-3 flex-1">
        {/* Preview */}
        <div className="relative flex-shrink-0">
          <div
            className="h-full min-h-[64px] w-[64px] rounded-[16px] overflow-hidden flex items-center justify-center border border-border"
            style={{
              background: currentUrl ? 'transparent' : 'linear-gradient(135deg, #1E4F7A, #2D6FA0)',
            }}
          >
            {currentUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentUrl} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <span className="text-lg font-bold text-white tracking-tight">{initials}</span>
            )}
          </div>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-[16px] bg-black/40">
              <Icon name="refresh" size={16} className="text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Drop zone — ocupa todo el alto disponible */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[12px] border-[1.5px] border-dashed px-4 py-4 transition-all ${
            dragOver
              ? 'border-capta-deep bg-capta-tint/30 dark:border-capta-soft dark:bg-capta-deep/10'
              : 'border-border hover:border-capta-deep/30 hover:bg-muted/40'
          }`}
        >
          <div className="flex h-[28px] w-[28px] items-center justify-center rounded-[8px] bg-muted">
            <Icon name="upload" size={13} className="text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-[12px] font-medium text-foreground">Arrastra tu logo aquí</p>
            <p className="text-[10.5px] text-muted-foreground">PNG, SVG, WebP · máx 2 MB</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      </div>

      {/* Remove link debajo */}
      <AnimatePresence mode="wait">
        {currentUrl && !confirmRemove && (
          <motion.button
            key="remove-btn"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmRemove(true)}
            className="self-start text-[11px] text-muted-foreground hover:text-destructive transition-colors"
          >
            Eliminar logo
          </motion.button>
        )}
        {confirmRemove && (
          <motion.div
            key="remove-confirm"
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            className="flex items-center gap-1.5 text-[11px]"
          >
            <span className="text-muted-foreground">¿Eliminar el logo?</span>
            <button
              type="button"
              onClick={() => { onUploaded(''); setConfirmRemove(false); }}
              className="font-semibold text-destructive hover:underline"
            >
              Sí
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
  );
}

// ─── Color picker ─────────────────────────────────────────────────────────────

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const [custom, setCustom] = useState(
    value && !COLOR_PALETTE.some((c) => c.hex === value) ? value : '',
  );

  return (
    <div className="space-y-3">
      {/* Swatches */}
      <div className="flex flex-wrap gap-[7px]">
        {COLOR_PALETTE.map((c) => (
          <button
            key={c.hex}
            type="button"
            title={c.label}
            onClick={() => { onChange(c.hex); setCustom(''); }}
            className="relative h-8 w-8 rounded-[8px] border-2 transition-all duration-150 hover:scale-110 focus:outline-none"
            style={{
              background: c.hex,
              borderColor: value === c.hex ? '#fff' : 'transparent',
              boxShadow: value === c.hex ? `0 0 0 2.5px ${c.hex}` : 'none',
            }}
          >
            {value === c.hex && (
              <Icon
                name="check"
                size={11}
                strokeWidth={2.5}
                className="absolute inset-0 m-auto text-white drop-shadow"
              />
            )}
          </button>
        ))}
      </div>

      {/* Custom hex input */}
      <div className="flex items-center gap-2">
        <div
          className="h-8 w-8 flex-shrink-0 rounded-[8px] border border-border transition-colors"
          style={{ background: isValidHex(custom) ? custom : 'hsl(var(--muted))' }}
        />
        <input
          type="text"
          placeholder="#1E4F7A"
          value={custom}
          onChange={(e) => {
            const v = e.target.value;
            setCustom(v);
            if (isValidHex(v)) onChange(v);
          }}
          maxLength={7}
          className="flex-1 rounded-[8px] border border-border bg-muted/60 px-2.5 py-1.5 text-[12px] font-mono text-foreground
            placeholder:text-muted-foreground/40
            focus:outline-none focus:ring-2 focus:ring-capta-deep/20 focus:border-capta-deep/30
            dark:focus:ring-capta-soft/20 dark:focus:border-capta-soft/30
            transition-shadow"
        />
        {isValidHex(custom) && custom !== value && (
          <button
            type="button"
            onClick={() => onChange(custom)}
            className="text-[11.5px] font-semibold text-capta-deep dark:text-capta-soft whitespace-nowrap hover:opacity-70 transition-opacity"
          >
            Aplicar
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => { onChange(''); setCustom(''); }}
        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        Usar color predeterminado (Capta)
      </button>

      {/* Live preview bar */}
      <AnimatePresence>
        {value && isValidHex(value) && (
          <motion.div
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 3 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2.5 rounded-[12px] border border-border bg-muted/30 px-3 py-2.5"
          >
            <div
              className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[8px]"
              style={{ background: `${value}20` }}
            >
              <div
                className="absolute left-0 top-1/2 h-3.5 w-[3px] -translate-y-1/2 rounded-r-sm"
                style={{ background: value }}
              />
              <Icon name="book-open" size={13} style={{ color: value }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11.5px] font-medium text-foreground">Elemento activo</p>
              <p className="text-[10.5px] text-muted-foreground">Sidebar de navegación</p>
            </div>
            <div
              className="flex-shrink-0 flex h-[20px] items-center rounded-full px-2 text-[10.5px] font-semibold text-white tracking-wide"
              style={{ background: value }}
            >
              {value}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Enterprise tooltip ───────────────────────────────────────────────────────

function EnterpriseBadge() {
  return (
    <div className="group relative inline-flex normal-case ml-1.5">
      <span className="flex cursor-help items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9.5px] font-semibold text-amber-700 dark:border-amber-800/30 dark:bg-amber-900/20 dark:text-amber-400 tracking-normal whitespace-nowrap">
        <Icon name="shield" size={8} strokeWidth={2} />
        Enterprise
      </span>
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-[190px] -translate-x-1/2 translate-y-1 rounded-[12px] border border-border bg-card px-3 py-2.5 opacity-0 shadow-xl transition-all duration-150 group-hover:opacity-100 group-hover:translate-y-0">
        <p className="mb-1.5 text-[11px] font-semibold text-foreground">Plan Enterprise incluye:</p>
        <ul className="text-[10.5px] text-muted-foreground leading-[1.9]">
          <li>· Dominio personalizado</li>
          <li>· White-label completo</li>
          <li>· SSO / SAML</li>
          <li>· Soporte prioritario</li>
          <li>· Sub-empresas ilimitadas</li>
        </ul>
        <p className="mt-2 text-[10px] font-semibold text-capta-deep dark:text-capta-soft">
          Contacta a ventas para upgradar →
        </p>
        <div className="absolute -bottom-[5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b border-r border-border bg-card" />
      </div>
    </div>
  );
}

// ─── Field label ──────────────────────────────────────────────────────────────

function FieldLabel({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 flex items-center text-[10px] font-semibold uppercase tracking-[0.5px] text-muted-foreground"
    >
      {children}
    </label>
  );
}

// ─── Input base styles (shared string) ───────────────────────────────────────

const INPUT_CLS = `
  w-full rounded-[12px] border border-border bg-muted/40 px-3 py-2.5 text-[13px] text-foreground
  placeholder:text-muted-foreground/40
  focus:outline-none focus:ring-2 focus:ring-capta-deep/10 focus:border-capta-deep/30
  dark:focus:ring-capta-soft/20 dark:focus:border-capta-soft/30
  transition-shadow
`.trim();

// ─── Página ───────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [domain, setDomain] = useState('');

  const isDirty = tenant
    ? name !== tenant.name ||
      logoUrl !== (tenant.logoUrl ?? '') ||
      primaryColor !== (tenant.primaryColor ?? '') ||
      domain !== (tenant.domain ?? '')
    : false;

  useEffect(() => {
    Promise.all([
      api.get<TenantData>('/tenants/me'),
      api
        .get<{ plan: PlanInfo }>('/subscriptions/me')
        .catch(() => ({ data: { plan: { type: 'FREE', hasWhiteLabel: false } } })),
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
        name: name.trim() || undefined,
        logoUrl: logoUrl || undefined,
        primaryColor: primaryColor || undefined,
        domain: domain || undefined,
      });
      setTenant(data);
      localStorage.setItem('tenant_logo', data.logoUrl ?? '');
      localStorage.setItem('tenant_color', data.primaryColor ?? '');
      localStorage.setItem('tenant_name', data.name);
      toastSuccess('Configuración guardada');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Error al guardar';
      toastError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Skeleton ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        {/* Topbar skeleton */}
        <div className="flex items-center justify-between mb-5">
          <div className="space-y-2">
            <div className="h-4 w-52 bg-muted animate-pulse rounded-full" />
            <div className="h-3 w-36 bg-muted animate-pulse rounded-full" />
          </div>
          <div className="h-9 w-36 bg-muted animate-pulse rounded-[12px]" />
        </div>
        {/* Bento skeleton */}
        <div className="grid grid-cols-2 gap-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="rounded-[20px] border border-border bg-card p-[18px] animate-pulse space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="h-[30px] w-[30px] rounded-[8px] bg-muted" />
                <div className="h-3 w-28 bg-muted rounded-full" />
              </div>
              <div className="h-24 bg-muted rounded-[12px]" />
            </div>
          ))}
          <div className="col-span-2 rounded-[20px] border border-border bg-card p-[18px] animate-pulse space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-[30px] w-[30px] rounded-[8px] bg-muted" />
              <div className="h-3 w-32 bg-muted rounded-full" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="h-14 bg-muted rounded-[12px]" />
              <div className="h-14 bg-muted rounded-[12px]" />
              <div className="h-14 bg-muted rounded-[12px]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isEnterprise = plan?.type === 'ENTERPRISE';

  return (
    <div className="p-6 lg:p-8">

      {/* ── Topbar sticky ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="sticky top-0 z-10 -mx-6 -mt-6 mb-5 flex items-center justify-between gap-4
          bg-background/80 backdrop-blur-md px-6 py-4 lg:-mx-8 lg:px-8
          border-b border-border/50"
      >
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight text-foreground leading-tight">
            Configuración de empresa
          </h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Personaliza la identidad visual de tu empresa en la plataforma.
          </p>
        </div>

        {/* El botón siempre está visible; disabled cuando no hay cambios */}
        <SaveButton saving={saving} disabled={saving || !isDirty} onClick={handleSave} />
      </motion.div>

      {/* ── Bento grid ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">

        {/* Logo — col 1 */}
        <motion.div
          className="h-full"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.04 }}
        >
          <BentoCard
            icon={<Icon name="grid" size={14} className="text-capta-deep dark:text-capta-soft" />}
            title="Logo"
            description="Sidebar y certificados"
            bodyClassName="flex flex-col"
          >
            <LogoUpload
              currentUrl={logoUrl || null}
              tenantName={name || tenant?.name || ''}
              onUploaded={setLogoUrl}
              onError={toastError}
            />
          </BentoCard>
        </motion.div>

        {/* Color — col 2 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.07 }}
        >
          <BentoCard
            icon={<Icon name="sun" size={14} className="text-capta-deep dark:text-capta-soft" />}
            title="Color de marca"
            description="Acentos y navegación activa"
          >
            <ColorPicker value={primaryColor} onChange={setPrimaryColor} />
          </BentoCard>
        </motion.div>

        {/* Datos empresa — full width */}
        <motion.div
          className="col-span-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.1 }}
        >
          <BentoCard
            icon={<Icon name="building" size={14} className="text-capta-deep dark:text-capta-soft" />}
            title="Datos de la empresa"
          >
            {/* 3 columnas en una sola fila: nombre · slug · dominio */}
            <div className="grid grid-cols-3 gap-4">

              {/* Nombre */}
              <div>
                <FieldLabel htmlFor="company-name">Nombre</FieldLabel>
                <input
                  id="company-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  placeholder="Acme Corp"
                  className={INPUT_CLS}
                />
              </div>

              {/* Slug */}
              <div>
                <FieldLabel>
                  Identificador URL{' '}
                  <span className="normal-case font-normal tracking-normal ml-0.5">(inmutable)</span>
                </FieldLabel>
                <div className="flex items-center gap-2 rounded-[12px] border border-border bg-muted/40 px-3 py-2.5">
                  <Icon name="globe" size={12} className="text-muted-foreground/50 flex-shrink-0" />
                  <span className="text-[12.5px] text-muted-foreground font-mono flex-1 truncate">
                    {tenant?.slug}
                  </span>
                  <Icon name="shield" size={10} className="text-muted-foreground/30 flex-shrink-0" />
                </div>
              </div>

              {/* Dominio */}
              <div>
                <FieldLabel>
                  Dominio personalizado
                  {!isEnterprise && <EnterpriseBadge />}
                </FieldLabel>
                <div className="relative">
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    maxLength={253}
                    placeholder="app.tuempresa.com"
                    disabled={!isEnterprise}
                    className={`${INPUT_CLS} pr-9 disabled:cursor-not-allowed disabled:opacity-45`}
                  />
                  {!isEnterprise && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Icon name="shield" size={12} className="text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                {!isEnterprise && (
                  <p className="mt-1.5 text-[10.5px] text-muted-foreground/60 leading-relaxed">
                    Disponible en Enterprise. Usa tu propio dominio.
                  </p>
                )}
              </div>

            </div>
          </BentoCard>
        </motion.div>

      </div>
    </div>
  );
}