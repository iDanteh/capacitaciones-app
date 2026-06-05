'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/capta-icon';
import { CaptaMark } from '@/components/capta-logo';
import { api } from '@/lib/api';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface VerifyResult {
  publicUuid:    string;
  recipientName: string;
  courseTitle:   string;
  tenantName:    string;
  issuedAt:      string;
  isValid:       boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(iso));
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function VerifyCertificatePage() {
  const { uuid } = useParams<{ uuid: string }>();

  const [result,      setResult]      = useState<VerifyResult | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [copied,      setCopied]      = useState(false);

  useEffect(() => {
    api.get<VerifyResult>(`/certificates/verify/${uuid}`)
      .then(res => setResult(res.data))
      .catch(() => setResult({ publicUuid: uuid, recipientName: '', courseTitle: '',
        tenantName: '', issuedAt: '', isValid: false }))
      .finally(() => setLoading(false));
  }, [uuid]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Certificado – ${result?.courseTitle ?? ''}`,
          text:  `Verifica el certificado de ${result?.recipientName ?? ''} en el curso "${result?.courseTitle ?? ''}"`,
          url,
        });
      } catch { /* usuario canceló */ }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await api.get(`/certificates/verify/${uuid}/download`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `certificado-${uuid}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally { setDownloading(false); }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'linear-gradient(135deg, #0A1419 0%, #1E4F7A 60%, #0B2840 100%)' }}
    >
      {/* Logo */}
      <Link href="/" className="mb-10 flex items-center gap-2.5">
        <CaptaMark size={32} />
        <span className="text-xl font-bold text-white tracking-tight">Capta</span>
      </Link>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3"
          >
            <Icon name="refresh" size={28} className="animate-spin text-white/60" />
            <p className="text-white/60 text-sm">Verificando certificado…</p>
          </motion.div>
        ) : result?.isValid ? (
          /* ── Certificado VÁLIDO ── */
          <motion.div
            key="valid"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-full max-w-lg"
          >
            {/* Card del certificado */}
            <div
              className="rounded-3xl p-8 text-center"
              style={{
                background:  'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(24px)',
                border:      '1px solid rgba(255,255,255,0.15)',
                boxShadow:   '0 24px 64px rgba(0,0,0,0.4)',
              }}
            >
              {/* Sello de verificado */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 400, damping: 20 }}
                className="flex h-16 w-16 items-center justify-center rounded-full mx-auto mb-5"
                style={{
                  background:  'linear-gradient(135deg, #16a34a, #15803d)',
                  boxShadow:   '0 8px 24px rgba(22,163,74,0.45)',
                }}
              >
                <Icon name="check-circle" size={32} className="text-white" />
              </motion.div>

              <p
                className="text-xs font-bold uppercase tracking-[0.2em] mb-4"
                style={{ color: '#7FD1AE' }}
              >
                Certificado Verificado
              </p>

              <h1 className="text-2xl font-bold text-white mb-1">{result.recipientName}</h1>

              <p className="text-white/60 text-sm mb-5">ha completado satisfactoriamente</p>

              <div
                className="rounded-2xl px-6 py-4 mb-5"
                style={{ background: 'rgba(30,79,122,0.35)', border: '1px solid rgba(143,196,232,0.15)' }}
              >
                <p className="text-lg font-semibold text-white leading-snug">
                  &ldquo;{result.courseTitle}&rdquo;
                </p>
                <p className="text-sm text-white/50 mt-1">{result.tenantName}</p>
              </div>

              {/* Fecha */}
              <p className="text-sm text-white/60 mb-6">
                Emitido el <span className="text-white/90 font-medium">{formatDate(result.issuedAt)}</span>
              </p>

              {/* UUID */}
              <div
                className="rounded-xl px-4 py-2.5 mb-6"
                style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">ID de verificación</p>
                <p className="text-xs font-mono text-white/70 break-all">{result.publicUuid}</p>
              </div>

              {/* Acciones: descargar + compartir */}
              <div className="flex gap-2.5">
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                    boxShadow:  '0 4px 16px rgba(245,158,11,0.35)',
                  }}
                >
                  {downloading ? (
                    <Icon name="refresh" size={15} className="animate-spin" />
                  ) : (
                    <Icon name="download" size={15} />
                  )}
                  {downloading ? 'Generando…' : 'Descargar PDF'}
                </button>

                <button
                  onClick={handleShare}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-white/15 active:scale-[0.97]"
                  title="Compartir certificado"
                >
                  {copied ? (
                    <><Icon name="check" size={15} className="text-emerald-400" /> Copiado</>
                  ) : (
                    <><Icon name="external" size={15} /> Compartir</>
                  )}
                </button>
              </div>
            </div>

            <p className="text-center text-xs text-white/30 mt-6">
              Este certificado fue emitido por la plataforma Capta y su autenticidad está garantizada.
            </p>
          </motion.div>
        ) : (
          /* ── Certificado INVÁLIDO / no encontrado ── */
          <motion.div
            key="invalid"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-full max-w-md text-center"
          >
            <div
              className="rounded-3xl p-8"
              style={{
                background:  'rgba(255,255,255,0.06)',
                backdropFilter: 'blur(24px)',
                border:      '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full mx-auto mb-4"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                <Icon name="x-circle" size={28} className="text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Certificado no encontrado</h2>
              <p className="text-sm text-white/50 leading-relaxed">
                No pudimos verificar este certificado. Es posible que el enlace sea incorrecto
                o que el certificado haya sido emitido en una plataforma diferente.
              </p>
              <p className="mt-4 text-xs font-mono text-white/30 break-all">{uuid}</p>
            </div>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors"
            >
              <Icon name="arrow-left" size={14} /> Volver al inicio
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
