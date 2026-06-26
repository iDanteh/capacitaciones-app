'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { CaptaLogo } from '@/components/capta-logo';
import { Icon } from '@/components/capta-icon';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VerifyResponse {
  publicUuid:    string;
  recipientName: string;
  courseTitle:   string;
  tenantName:    string;
  issuedAt:      string;
  isValid:       boolean;
  type:          'COURSE' | 'QUIZ';
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(iso));
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex justify-center">
        <div className="h-20 w-20 rounded-3xl bg-muted" />
      </div>
      <div className="space-y-2 text-center">
        <div className="mx-auto h-5 w-40 rounded bg-muted" />
        <div className="mx-auto h-4 w-56 rounded bg-muted" />
      </div>
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-border p-4">
            <div className="h-8 w-8 rounded-lg bg-muted" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3 w-20 rounded bg-muted" />
              <div className="h-4 w-40 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Detail row ───────────────────────────────────────────────────────────────

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon name={icon as never} size={15} className="text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VerifyPage() {
  const params  = useParams<{ uuid: string }>();
  const uuid    = params.uuid;

  const [data,    setData]    = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uuid) return;
    fetch(`${API_BASE}/certificates/verify/${uuid}`)
      .then(r => r.json())
      .then((r: VerifyResponse) => setData(r))
      .catch(() => setData({ publicUuid: uuid, recipientName: '', courseTitle: '', tenantName: '', issuedAt: new Date().toISOString(), isValid: false, type: 'COURSE' }))
      .finally(() => setLoading(false));
  }, [uuid]);

  const downloadHref = `${API_BASE}/certificates/verify/${uuid}/download`;

  return (
    <div className="min-h-screen bg-background">

      {/* Nav bar */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/" aria-label="Ir al inicio">
            <CaptaLogo markSize={24} />
          </Link>
          <span className="text-xs text-muted-foreground">Verificación de certificado</span>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-lg px-4 py-16">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LoadingSkeleton />
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="space-y-8"
            >
              {/* Status hero */}
              <div className="text-center space-y-4">
                <motion.div
                  initial={{ scale: 0, rotate: -15 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 16, delay: 0.1 }}
                  className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl"
                  style={{
                    background: data?.isValid
                      ? 'linear-gradient(135deg, #10b981, #059669)'
                      : 'linear-gradient(135deg, #ef4444, #dc2626)',
                    boxShadow: data?.isValid
                      ? '0 16px 48px rgba(16,185,129,0.35)'
                      : '0 16px 48px rgba(239,68,68,0.35)',
                  }}
                >
                  <Icon name={data?.isValid ? 'check' : 'close'} size={38} className="text-white" />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <p className={`font-display text-2xl font-normal ${data?.isValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                    {data?.isValid ? 'Certificado válido' : 'Certificado no encontrado'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {data?.isValid
                      ? `${data.type === 'QUIZ' ? 'Certificado de evaluación' : 'Certificado de finalización'} verificado por Capta`
                      : 'El UUID no corresponde a ningún certificado emitido por esta plataforma'}
                  </p>
                </motion.div>
              </div>

              {/* Certificate details */}
              {data?.isValid && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="space-y-2.5"
                >
                  <DetailRow
                    icon="user"
                    label="Participante"
                    value={data.recipientName}
                  />
                  <DetailRow
                    icon={data.type === 'QUIZ' ? 'clipboard' : 'book-open'}
                    label={data.type === 'QUIZ' ? 'Evaluación' : 'Curso'}
                    value={data.courseTitle}
                  />
                  <DetailRow
                    icon="building"
                    label="Organización"
                    value={data.tenantName}
                  />
                  <DetailRow
                    icon="calendar"
                    label="Fecha de emisión"
                    value={formatDate(data.issuedAt)}
                  />
                </motion.div>
              )}

              {/* UUID */}
              {data?.isValid && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="rounded-xl border border-border bg-muted/30 px-4 py-3"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">ID del certificado</p>
                  <p className="font-mono text-xs text-muted-foreground break-all">{uuid}</p>
                </motion.div>
              )}

              {/* Download button */}
              {data?.isValid && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.46 }}
                >
                  <a
                    href={downloadHref}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"
                    style={{ background: 'linear-gradient(135deg, #1E4F7A, #2D6FA0)' }}
                  >
                    <Icon name="download" size={18} />
                    Descargar PDF
                  </a>
                </motion.div>
              )}

              {/* Footer note */}
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 0.52 }}
                className="text-center text-[11px] text-muted-foreground"
              >
                Verificación provista por{' '}
                <Link href="/" className="font-medium hover:underline" style={{ color: 'var(--tenant-primary, #1E4F7A)' }}>
                  Capta
                </Link>
                {' '}· Plataforma de Capacitación Empresarial
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
