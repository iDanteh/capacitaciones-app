'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/capta-icon';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Certificate {
  id:            string;
  publicUuid:    string;
  recipientName: string;
  courseTitle:   string;
  tenantName:    string;
  issuedAt:      string;
  verifyUrl:     string;
  type:          'COURSE' | 'QUIZ';
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-MX', {
    day:   'numeric',
    month: 'long',
    year:  'numeric',
  }).format(new Date(iso));
}

function downloadUrl(uuid: string) {
  return `${API_BASE}/certificates/verify/${uuid}/download`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CertCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="h-11 w-11 rounded-xl bg-muted" />
        <div className="h-5 w-14 rounded-full bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
      </div>
      <div className="h-3 w-1/3 rounded bg-muted" />
      <div className="flex gap-2">
        <div className="h-9 flex-1 rounded-xl bg-muted" />
        <div className="h-9 w-24 rounded-xl bg-muted" />
      </div>
    </div>
  );
}

// ─── Certificate card ─────────────────────────────────────────────────────────

function CertCard({ cert, index }: { cert: Certificate; index: number }) {
  const isQuiz = cert.type === 'QUIZ';

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="group relative flex flex-col rounded-2xl border border-border bg-card p-6 gap-4 overflow-hidden transition-shadow duration-200 hover:shadow-md"
    >
      {/* Ambient gradient — subtle brand touch */}
      <div
        className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full opacity-[0.06] blur-2xl transition-opacity duration-300 group-hover:opacity-[0.1]"
        style={{ background: 'var(--tenant-primary)' }}
      />

      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'color-mix(in srgb, var(--tenant-primary) 12%, transparent)' }}
        >
          <Icon
            name={isQuiz ? 'clipboard' : 'book-open'}
            size={20}
            style={{ color: 'var(--tenant-primary)' }}
          />
        </div>

        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
          style={{
            background: 'color-mix(in srgb, var(--tenant-primary) 10%, transparent)',
            color:      'var(--tenant-primary)',
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: 'var(--tenant-primary)' }}
          />
          {isQuiz ? 'Evaluación' : 'Curso'}
        </span>
      </div>

      {/* Course / quiz title */}
      <div className="flex-1 space-y-1">
        <h3 className="font-display text-base font-normal leading-snug text-foreground line-clamp-2">
          {cert.courseTitle}
        </h3>
        <p className="text-xs text-muted-foreground">{cert.tenantName}</p>
      </div>

      {/* Date */}
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon name="calendar" size={12} className="flex-shrink-0" />
        Emitido el {formatDate(cert.issuedAt)}
      </p>

      {/* Actions */}
      <div className="flex gap-2">
        <a
          href={downloadUrl(cert.publicUuid)}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, var(--tenant-primary), color-mix(in srgb, var(--tenant-primary) 72%, #000))' }}
        >
          <Icon name="download" size={14} />
          Descargar
        </a>

        <a
          href={cert.verifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:border-foreground/20 hover:text-foreground"
        >
          <Icon name="external-link" size={14} />
          Verificar
        </a>
      </div>
    </motion.article>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="flex flex-col items-center justify-center py-24 px-4 text-center"
    >
      <div
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl"
        style={{ background: 'color-mix(in srgb, var(--tenant-primary) 10%, transparent)' }}
      >
        <Icon name="award" size={36} style={{ color: 'var(--tenant-primary)' }} />
      </div>
      <h3 className="font-display text-xl font-normal text-foreground">Sin certificados aún</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Completa cursos o aprueba evaluaciones para obtener tus primeros certificados descargables.
      </p>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CertificatesPage() {
  const [certs,   setCerts]   = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Certificate[]>('/certificates/my')
      .then(r => setCerts(r.data))
      .catch(() => setCerts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-full p-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-1"
        >
          <h1 className="font-display text-3xl font-normal text-foreground">Mis Certificados</h1>
          <p className="text-sm text-muted-foreground">
            Tus logros de cursos y evaluaciones completadas
          </p>
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {[...Array(3)].map((_, i) => <CertCardSkeleton key={i} />)}
            </motion.div>
          ) : certs.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState />
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {certs.map((cert, i) => (
                <CertCard key={cert.id} cert={cert} index={i} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
