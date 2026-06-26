import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { CaptaLogo } from '@/components/capta-logo';
import { Icon } from '@/components/capta-icon';

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <header className="fixed top-0 z-50 w-full">
      <div className="mx-auto mt-4 max-w-6xl px-4">
        <div className="flex h-14 items-center justify-between rounded-2xl border border-border/60 bg-background/80 px-5 shadow-sm shadow-black/5 backdrop-blur-xl">
          <CaptaLogo markSize={26} showText />

          <nav className="hidden items-center gap-8 md:flex">
            {[
              { label: 'Producto', href: '#caracteristicas' },
              { label: 'Precios', href: '#precios' },
              { label: 'Clientes', href: '#clientes' },
            ].map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="relative text-sm font-medium text-muted-foreground transition-colors hover:text-foreground after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-0 after:bg-foreground after:transition-all hover:after:w-full"
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <div className="mx-2 h-4 w-px bg-border/60" aria-hidden />
            <Link
              href="/login"
              className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.03] hover:brightness-110 active:scale-[0.97]"
              style={{
                background:  'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)',
                boxShadow:   '0 2px 10px color-mix(in srgb, var(--tenant-primary) 30%, transparent)',
              }}
            >
              Comenzar gratis
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden bg-background px-6 pb-24 pt-36">

      {/* ── Fondos atmosféricos ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {/* Orb principal — firma única de la página */}
        <div
          className="absolute left-1/2 top-0 h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-[0.18] blur-[96px]"
          style={{ background: 'radial-gradient(circle, #8FC4E8 0%, #1E4F7A 50%, transparent 80%)' }}
        />
        {/* Orb secundario verde */}
        <div
          className="absolute right-0 top-20 h-[320px] w-[320px] translate-x-1/3 rounded-full opacity-[0.12] blur-[80px]"
          style={{ background: '#7FD1AE' }}
        />
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.035] dark:opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
            backgroundSize:  '28px 28px',
          }}
        />
        {/* Gradiente bottom fade */}
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="mx-auto max-w-5xl">

        {/* Badge */}
        <div className="mb-8 flex justify-center">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5"
            style={{
              borderColor: 'rgba(143,196,232,0.25)',
              background:  'rgba(143,196,232,0.05)',
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: '#7FD1AE',
                boxShadow:  '0 0 6px #7FD1AE',
              }}
            />
            <span className="text-xs font-semibold tracking-wide text-muted-foreground">
              Capacitación empresarial · Todo en uno
            </span>
          </div>
        </div>

        {/* Headline */}
        <h1 className="mx-auto max-w-4xl text-center font-display text-5xl font-normal leading-[1.08] tracking-tight text-foreground sm:text-6xl lg:text-[70px]">
          Capacita a tu equipo.{' '}
          <br className="hidden sm:block" />
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(135deg, #1E4F7A 0%, #8FC4E8 45%, #7FD1AE 100%)' }}
          >
            Escala tu empresa.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-center text-lg leading-relaxed text-muted-foreground">
          Crea cursos, asigna capacitaciones y mide el progreso de cada colaborador
          desde una sola plataforma.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/register"
            className="group relative w-full overflow-hidden rounded-2xl px-8 py-4 text-base font-semibold text-white transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] sm:w-auto"
            style={{
              background:  'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)',
              boxShadow:   '0 8px 32px color-mix(in srgb, var(--tenant-primary) 30%, transparent)',
            }}
          >
            {/* Shimmer */}
            <span className="absolute inset-0 -translate-x-full skew-x-12 bg-white/10 transition-transform duration-700 group-hover:translate-x-full" aria-hidden />
            <span className="relative">Comenzar gratis</span>
          </Link>
          
            <Link
              href="#caracteristicas"
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-border bg-background px-8 py-4 text-base font-semibold text-foreground transition-all hover:border-capta-soft/40 hover:bg-muted sm:w-auto"
            >
              <Icon name="play" size={13} className="text-capta-deep dark:text-capta-soft" />
              Ver demo · 2 min
            </Link>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground/40">
          Sin tarjeta de crédito · Plan gratuito disponible
        </p>

        {/* ── Browser mockup ── */}
        <div className="mx-auto mt-20 max-w-5xl">
          <div className="relative">
            {/* Glow detrás del mockup */}
            <div
              aria-hidden
              className="absolute -inset-6 -z-10 rounded-3xl opacity-30 blur-3xl"
              style={{
                background: 'linear-gradient(135deg, rgba(143,196,232,0.5), rgba(30,79,122,0.25), rgba(127,209,174,0.35))',
              }}
            />
            {/* Reflection sutil debajo */}
            <div
              aria-hidden
              className="absolute inset-x-8 -bottom-4 h-12 rounded-b-3xl opacity-20 blur-xl"
              style={{ background: 'linear-gradient(180deg, rgba(30,79,122,0.4), transparent)' }}
            />

            <div className="overflow-hidden rounded-2xl border border-border shadow-[0_32px_80px_rgba(11,31,42,0.18)] dark:shadow-[0_32px_80px_rgba(0,0,0,0.4)]">
              {/* Browser chrome */}
              <div className="flex items-center gap-1.5 border-b border-border bg-muted/50 px-4 py-3 backdrop-blur-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                <div className="ml-4 flex flex-1 items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-1.5">
                  <div className="h-2 w-2 rounded-full" style={{ background: 'linear-gradient(135deg, #1F5C4D, #7FD1AE)' }} />
                  <span className="text-xs text-muted-foreground/40">app.capta.io/dashboard</span>
                  <div className="ml-auto flex gap-1">
                    <div className="h-2 w-2 rounded-sm bg-muted-foreground/10" />
                    <div className="h-2 w-2 rounded-sm bg-muted-foreground/10" />
                  </div>
                </div>
              </div>

              {/* Dashboard preview */}
              <div className="flex min-h-[400px] bg-background sm:min-h-[460px]">
                {/* Sidebar */}
                <div className="hidden w-[190px] flex-shrink-0 border-r border-border bg-card/80 p-4 sm:block">
                  <div className="mb-6 flex items-center gap-2.5">
                    <div className="h-6 w-6 rounded-lg" style={{ background: 'linear-gradient(135deg, #1F5C4D, #7FD1AE)' }} />
                    <div className="h-2.5 w-14 rounded bg-muted" />
                  </div>
                  <p className="mb-2.5 text-[8px] font-bold uppercase tracking-[0.16em] text-muted-foreground/25">
                    Plataforma
                  </p>
                  <div className="space-y-0.5">
                    {[true, false, false, false, false].map((active, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${active ? 'bg-capta-tint/50' : ''}`}
                      >
                        <div
                          className="h-3.5 w-3.5 rounded-md flex-shrink-0"
                          style={{ background: active ? '#1E4F7A' : 'currentColor', opacity: active ? 0.5 : 0.12 }}
                        />
                        <div
                          className="h-2 flex-1 rounded"
                          style={{ background: active ? '#1E4F7A' : 'currentColor', opacity: active ? 0.2 : 0.08 }}
                        />
                      </div>
                    ))}
                  </div>
                  {/* Separator */}
                  <div className="my-4 h-px bg-border/60" />
                  <div className="space-y-0.5">
                    {[false, false, false].map((_, i) => (
                      <div key={i} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
                        <div className="h-3.5 w-3.5 rounded-md flex-shrink-0 bg-current opacity-[0.07]" />
                        <div className="h-2 flex-1 rounded bg-current opacity-[0.06]" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 space-y-4 p-5">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="h-3.5 w-40 rounded-full bg-foreground/10" />
                      <div className="mt-1.5 h-2 w-56 rounded-full bg-muted-foreground/8" />
                    </div>
                    <div
                      className="h-8 w-32 rounded-xl flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, rgba(30,79,122,0.12), rgba(143,196,232,0.08))' }}
                    />
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { color: '#1E4F7A', value: '24',  label: 'Cursos'     },
                      { color: '#7FD1AE', value: '78%', label: 'Completado' },
                      { color: '#8FC4E8', value: '312', label: 'Empleados'  },
                      { color: '#F59E0B', value: '89',  label: 'Activos'    },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="rounded-xl border border-border bg-card p-3"
                        style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset' }}
                      >
                        <div
                          className="mb-2 h-5 w-5 rounded-lg"
                          style={{ background: `${s.color}15`, border: `1px solid ${s.color}20` }}
                        />
                        <p className="text-sm font-bold text-foreground">{s.value}</p>
                        <div className="mt-1 h-1.5 w-14 rounded-full bg-muted-foreground/10" />
                      </div>
                    ))}
                  </div>

                  {/* Progress card */}
                  <div
                    className="rounded-xl border border-border bg-card p-4"
                    style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.5) inset' }}
                  >
                    <div className="mb-1 h-2.5 w-28 rounded-full bg-foreground/10" />
                    <div className="mb-4 h-1.5 w-44 rounded-full bg-muted-foreground/8" />
                    <div className="space-y-3">
                      {[
                        { w: '82%', c: '#1E4F7A', label: 'Lumen'   },
                        { w: '67%', c: '#7FD1AE', label: 'Stellar'  },
                        { w: '51%', c: '#8FC4E8', label: 'Nimbus'   },
                      ].map(t => (
                        <div key={t.label} className="flex items-center gap-3">
                          <span className="w-12 text-[10px] text-muted-foreground/50">{t.label}</span>
                          <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-muted/60">
                            <div
                              className="h-full rounded-full"
                              style={{ width: t.w, background: t.c, opacity: 0.65 }}
                            />
                          </div>
                          <span className="w-8 text-right text-[10px] font-semibold text-muted-foreground/50">
                            {t.w}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mini bento row */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { c: '#1E4F7A', h: 'h-2', w: '70%'  },
                      { c: '#7FD1AE', h: 'h-2', w: '45%'  },
                      { c: '#8FC4E8', h: 'h-2', w: '88%'  },
                    ].map((b, i) => (
                      <div key={i} className="rounded-xl border border-border bg-card p-3">
                        <div className="mb-3 h-1.5 w-full rounded-full bg-muted/60">
                          <div className="h-full rounded-full" style={{ width: b.w, background: b.c, opacity: 0.5 }} />
                        </div>
                        <div className="h-1.5 w-8 rounded-full bg-muted-foreground/10" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Social Proof ─────────────────────────────────────────────────────────────

function SocialProof() {
  const companies = ['Lumen', 'Stellar', 'Nimbus', 'Acuario', 'Pampa', 'Cobalto'];

  return (
    <section id="clientes" className="border-y border-border/40 bg-muted/20 px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <p className="mb-8 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/30">
          Empresas que capacitan con Capta
        </p>
        <div className="flex flex-wrap items-center justify-center gap-10">
          {companies.map(name => (
            <span
              key={name}
              className="text-sm font-bold tracking-wide text-muted-foreground/20 transition-all duration-300 hover:text-muted-foreground/60"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function Stats() {
  const stats = [
    { value: 'Multi',  label: 'empresa',         sub: 'desde el día 1',      color: '#1E4F7A' },
    { value: '3',      label: 'planes',           sub: 'para cada etapa',     color: '#7FD1AE' },
    { value: '∞',      label: 'cursos',           sub: 'en Enterprise',       color: '#8FC4E8' },
    { value: '100%',   label: 'datos aislados',   sub: 'Row Level Security',  color: '#1E4F7A' },
  ];

  return (
    <section className="bg-background px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {stats.map(({ value, label, sub, color }, i) => (
            <div key={label} className="flex flex-col items-center text-center sm:items-start sm:text-left">
              {/* Accent line */}
              <div
                className="mb-4 h-0.5 w-8 rounded-full"
                style={{ background: color }}
              />
              <p
                className="font-display text-4xl font-normal tracking-tight sm:text-5xl"
                style={{ color }}
              >
                {value}
              </p>
              <p className="mt-1.5 text-sm font-semibold text-foreground">{label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground/60">{sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

function Features() {
  return (
    <section id="caracteristicas" className="bg-muted/20 px-6 py-24">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="mb-16 max-w-xl">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">
            Características
          </p>
          <h2 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-4xl">
            Todo lo que necesita<br />tu empresa para crecer
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Diseñado para escalar contigo, desde 5 hasta 5,000 colaboradores.
          </p>
        </div>

        {/* Bento asimétrico */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:grid-rows-2">

          {/* ── Celda hero 2×2: Gestión de cursos ── */}
          <div
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 transition-all duration-300 hover:-translate-y-0.5 lg:col-span-2 lg:row-span-2"
            style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 32px rgba(11,31,42,0.06)' }}
          >
            {/* Glow hover */}
            <div
              className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-20"
              style={{ background: '#8FC4E8' }}
            />
            {/* Acento superior en hover */}
            <div
              className="absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{ background: 'linear-gradient(90deg, transparent, #8FC4E880, transparent)' }}
            />

            <div
              className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ background: '#8FC4E815', border: '1px solid #8FC4E822', color: '#8FC4E8' }}
            >
              <Icon name="grid" size={20} />
            </div>

            <div className="mb-3 flex items-start justify-between gap-3">
              <h3 className="text-xl font-semibold text-foreground">Gestión de cursos</h3>
              <span className="flex-shrink-0 rounded-full border border-border px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                Editor visual
              </span>
            </div>
            <p className="text-base leading-relaxed text-muted-foreground">
              Crea y organiza cursos con videos, documentos y evaluaciones.
              Asigna capacitaciones a equipos o empleados específicos con un clic.
            </p>

            {/* Mini preview visual */}
            <div className="mt-8 space-y-2.5">
              {[
                { label: 'Seguridad Industrial',  prog: '88%', c: '#8FC4E8' },
                { label: 'Atención al Cliente',   prog: '64%', c: '#7FD1AE' },
                { label: 'Compliance 2024',       prog: '42%', c: '#1E4F7A' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                  <div
                    className="h-6 w-6 flex-shrink-0 rounded-lg"
                    style={{ background: `${item.c}18`, border: `1px solid ${item.c}25` }}
                  />
                  <p className="flex-1 text-xs font-medium text-foreground">{item.label}</p>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: item.prog, background: item.c, opacity: 0.7 }}
                      />
                    </div>
                    <span className="w-8 text-right text-[10px] font-semibold text-muted-foreground">
                      {item.prog}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Celda: Progreso en tiempo real ── */}
          <div
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-0.5"
            style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
          >
            <div
              className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-20"
              style={{ background: '#7FD1AE' }}
            />
            <div
              className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: '#7FD1AE15', border: '1px solid #7FD1AE22', color: '#7FD1AE' }}
            >
              <Icon name="chart-line" size={18} />
            </div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-semibold text-foreground">Progreso en tiempo real</h3>
              <span className="flex-shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                Analytics
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Visualiza el avance de cada colaborador. Reportes automáticos para managers y directivos.
            </p>
          </div>

          {/* ── Celda: Seguridad multi-empresa ── */}
          <div
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-0.5"
            style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
          >
            <div
              className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-20"
              style={{ background: '#1E4F7A' }}
            />
            {/* RLS badge decorativo */}
            <div
              className="mb-5 inline-flex items-center gap-2 rounded-xl px-3 py-1.5"
              style={{ background: '#1E4F7A10', border: '1px solid #1E4F7A20' }}
            >
              <Icon name="shield" size={14} style={{ color: '#1E4F7A' } as React.CSSProperties} />
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#1E4F7A' }}>
                Row Level Security
              </span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-semibold text-foreground">Multi-empresa nativo</h3>
              <span className="flex-shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                Seguridad
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Aislamiento total a nivel de base de datos. Cada empresa ve solo lo suyo — sin configuración adicional.
            </p>
          </div>

        </div>

        {/* ── Fila inferior: Certificaciones + Quizzes ── */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            {
              iconName: 'certificate' as const,
              accent:   '#F59E0B',
              title:    'Certificaciones',
              desc:     'Genera certificados automáticos al completar cursos con tu marca y diseño personalizado.',
              tag:      'Disponible',
            },
            {
              iconName: 'clipboard' as const,
              accent:   '#8FC4E8',
              title:    'Evaluaciones y quizzes',
              desc:     'Crea evaluaciones con preguntas de opción múltiple. Calificación automática y reportes por empleado.',
              tag:      'Disponible',
            },
          ].map(card => (
            <div
              key={card.title}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-0.5"
              style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
            >
              <div
                className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-15"
                style={{ background: card.accent }}
              />
              <div className="absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ background: `linear-gradient(90deg, transparent, ${card.accent}60, transparent)` }} />

              <div
                className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: `${card.accent}15`, border: `1px solid ${card.accent}22`, color: card.accent }}
              >
                <Icon name={card.iconName} size={18} />
              </div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-foreground">{card.title}</h3>
                <span className="flex-shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {card.tag}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

const PLANS = [
  {
    name:        'Free',
    price:       '$0',
    period:      'para siempre',
    desc:        'Para empezar sin compromisos.',
    features:    ['1 empresa', '15 empleados', 'Cursos básicos', '2 GB storage'],
    addons:      false,
    cta:         'Comenzar gratis',
    href:        '/register',
    highlighted: false,
  },
  {
    name:        'Business',
    price:       '$49',
    period:      '/mes',
    desc:        'Para equipos en crecimiento.',
    features:    ['5 empresas', '500 empleados', 'Evaluaciones', 'Certificados', 'Analíticas', '20 GB storage'],
    addons:      true,
    cta:         'Elegir Business',
    href:        '/register?plan=business',
    highlighted: true,
  },
  {
    name:        'Enterprise',
    price:       '$149',
    period:      '/mes',
    desc:        'Sin límites, con tu marca.',
    features:    ['Ilimitado', 'White-label', 'API access', 'SSO', 'SLA dedicado', '200 GB storage'],
    addons:      true,
    cta:         'Contactar ventas',
    href:        '/register?plan=enterprise',
    highlighted: false,
  },
] as const;

function Pricing() {
  return (
    <section id="precios" className="bg-background px-6 py-24">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="mb-16 text-center">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">Precios</p>
          <h2 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-4xl">
            Planes para cada etapa
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base text-muted-foreground">
            Empieza gratis. Amplía cuando lo necesites, sin cambiar de plataforma.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map(plan => (
            <div
              key={plan.name}
              className={`relative flex flex-col overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 ${
                plan.highlighted ? '' : 'border border-border bg-card hover:border-capta-soft/30 hover:shadow-lg'
              }`}
              style={plan.highlighted
                ? {
                    background: 'linear-gradient(155deg, #1E4F7A 0%, #0B2035 100%)',
                    boxShadow:  '0 1px 0 rgba(143,196,232,0.15) inset, 0 24px 64px rgba(30,79,122,0.28)',
                  }
                : {
                    boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)',
                  }
              }
            >
              {plan.highlighted && (
                <>
                  {/* Acento top */}
                  <div
                    className="absolute inset-x-0 top-0 h-px"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(143,196,232,0.6), transparent)' }}
                  />
                  {/* Orb interior */}
                  <div
                    className="pointer-events-none absolute right-0 top-0 h-48 w-48 translate-x-1/3 -translate-y-1/3 rounded-full opacity-10 blur-3xl"
                    style={{ background: '#8FC4E8' }}
                  />
                  {/* Badge popular */}
                  <div className="absolute right-5 top-5">
                    <span
                      className="rounded-full px-3 py-1 text-[10px] font-bold"
                      style={{ background: 'linear-gradient(135deg, #7FD1AE, #A8E6CF)', color: '#0B1F2A' }}
                    >
                      Popular
                    </span>
                  </div>
                </>
              )}

              <div className="relative flex-1 p-7">
                <p className={`text-xs font-bold uppercase tracking-widest ${plan.highlighted ? 'text-white/50' : 'text-muted-foreground/60'}`}>
                  {plan.name}
                </p>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className={`font-display text-4xl font-normal tracking-tight ${plan.highlighted ? 'text-white' : 'text-foreground'}`}>
                    {plan.price}
                  </span>
                  <span className={`text-sm ${plan.highlighted ? 'text-white/40' : 'text-muted-foreground'}`}>
                    {plan.period}
                  </span>
                </div>
                <p className={`mt-1.5 text-sm ${plan.highlighted ? 'text-white/50' : 'text-muted-foreground'}`}>
                  {plan.desc}
                </p>

                {/* Divisor */}
                <div className={`my-6 h-px ${plan.highlighted ? 'bg-white/10' : 'bg-border/60'}`} />

                <ul className="space-y-2.5">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <div
                        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full ${
                          plan.highlighted ? 'bg-white/10' : ''
                        }`}
                        style={!plan.highlighted ? { background: 'color-mix(in srgb, var(--tenant-primary) 12%, transparent)' } : {}}
                      >
                        <Icon
                          name="check"
                          size={10}
                          className={plan.highlighted ? 'text-white/70' : 'text-capta-deep dark:text-capta-soft'}
                        />
                      </div>
                      <span className={plan.highlighted ? 'text-white/65' : 'text-muted-foreground'}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                {plan.addons && (
                  <p className={`mt-4 text-xs ${plan.highlighted ? 'text-white/25' : 'text-muted-foreground/40'}`}>
                    + Storage packs adicionales disponibles
                  </p>
                )}
              </div>

              <div className="relative p-7 pt-0">
                <Link
                  href={plan.href}
                  className="block w-full rounded-xl py-3.5 text-center text-sm font-semibold transition-all hover:scale-[1.02] hover:brightness-110 active:scale-[0.98]"
                  style={plan.highlighted
                    ? {
                        background: 'linear-gradient(135deg, #7FD1AE, #A8E6CF)',
                        color:      '#0B1F2A',
                        boxShadow:  '0 4px 20px rgba(127,209,174,0.3)',
                      }
                    : {
                        background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)',
                        color:      '#fff',
                        boxShadow:  '0 2px 12px color-mix(in srgb, var(--tenant-primary) 20%, transparent)',
                      }
                  }
                >
                  {plan.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Add-on callout */}
        <div
          className="mt-6 rounded-2xl border border-border bg-card px-6 py-4"
          style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 4px 16px rgba(11,31,42,0.04)' }}
        >
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                style={{ background: 'color-mix(in srgb, var(--tenant-primary) 10%, transparent)' }}
              >
                <Icon name="archive" size={13} style={{ color: 'var(--tenant-primary)' } as React.CSSProperties} />
              </div>
              <p className="text-sm font-semibold text-foreground">¿Necesitas más espacio?</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {['+10 GB · $5/mes', '+50 GB · $19/mes', '+200 GB · $59/mes'].map(pack => (
                <span
                  key={pack}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground/70"
                >
                  {pack}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── CTA Banner ───────────────────────────────────────────────────────────────

function CtaBanner() {
  return (
    <section className="bg-muted/20 px-6 py-20">
      <div
        className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl px-8 py-20 text-center"
        style={{
          background: 'linear-gradient(150deg, #1E4F7A 0%, #0A1F35 60%, #0D2840 100%)',
          boxShadow:  '0 1px 0 rgba(143,196,232,0.15) inset, 0 32px 80px rgba(30,79,122,0.25)',
        }}
      >
        {/* Acento top */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(143,196,232,0.5), transparent)' }}
        />

        {/* Orbs de fondo */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-8 blur-3xl"
          style={{ background: '#8FC4E8' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 bottom-0 h-48 w-48 rounded-full opacity-10 blur-3xl"
          style={{ background: '#7FD1AE' }}
        />

        {/* SVG partículas sutiles */}
        <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>

        <div className="relative z-10">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
            Sin compromisos
          </p>
          <h2 className="mx-auto max-w-lg font-display text-3xl font-normal tracking-tight text-white sm:text-4xl">
            Listo para capacitar a tu equipo
          </h2>
          <p className="mx-auto mt-4 max-w-sm text-base text-white/45">
            Regístrate en minutos. El plan gratuito no expira.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="group relative w-full overflow-hidden rounded-2xl px-8 py-4 text-base font-semibold transition-all hover:scale-[1.03] hover:shadow-xl active:scale-[0.97] sm:w-auto"
              style={{
                background: 'linear-gradient(135deg, #7FD1AE, #A8E6CF)',
                color:      '#0B1F2A',
                boxShadow:  '0 6px 28px rgba(127,209,174,0.35)',
              }}
            >
              <span className="absolute inset-0 -translate-x-full skew-x-12 bg-white/15 transition-transform duration-700 group-hover:translate-x-full" aria-hidden />
              <span className="relative">Crear cuenta gratis</span>
            </Link>
            <Link
              href="/login"
              className="w-full rounded-2xl border border-white/12 bg-white/5 px-8 py-4 text-base font-semibold text-white/60 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10 hover:text-white sm:w-auto"
            >
              Ya tengo cuenta
            </Link>
          </div>

          {/* Social proof inline */}
          <div className="mt-10 flex items-center justify-center gap-6">
            <div className="h-px w-16 bg-white/10" />
            <p className="text-xs text-white/25">Sin tarjeta de crédito · Cancela cuando quieras</p>
            <div className="h-px w-16 bg-white/10" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-border/40 bg-muted/10 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <CaptaLogo markSize={22} showText />
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8">
            <nav className="flex gap-6">
              {[
                { label: 'Producto', href: '#caracteristicas' },
                { label: 'Precios', href: '#precios' },
                { label: 'Clientes', href: '#clientes' },
              ].map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  className="text-xs text-muted-foreground/50 transition-colors hover:text-muted-foreground"
                >
                  {label}
                </Link>
              ))}
            </nav>
            <p className="text-xs text-muted-foreground/30">
              © {new Date().getFullYear()} Capta. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <SocialProof />
        <Stats />
        <Features />
        <Pricing />
        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}