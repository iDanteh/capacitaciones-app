import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { CaptaLogo } from '@/components/capta-logo';
import { Icon } from '@/components/capta-icon';

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <header className="fixed top-0 z-50 w-full">
      <div className="mx-auto mt-3 max-w-6xl px-4">
        <div className="flex h-14 items-center justify-between rounded-2xl border border-border/80 bg-background/88 px-5 shadow-sm shadow-black/4 backdrop-blur-xl">
          <CaptaLogo markSize={26} showText />

          <nav className="hidden items-center gap-7 md:flex">
            {[
              { label: 'Producto', href: '#caracteristicas' },
              { label: 'Precios',  href: '#precios' },
              { label: 'Clientes', href: '#clientes' },
            ].map(({ label, href }) => (
              <a key={label} href={href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <div className="mx-1 h-4 w-px bg-border" aria-hidden />
            <Link href="/login"
              className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground">
              Iniciar sesión
            </Link>
            <Link href="/register"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all hover:scale-[1.03] active:scale-[0.97]"
              style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)', boxShadow: '0 2px 8px color-mix(in srgb, var(--tenant-primary) 30%, transparent)' }}>
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
    <section className="relative overflow-hidden bg-background px-6 pb-20 pt-36">
      {/* Radial gradient fondo */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 55% at 50% -10%, rgba(143,196,232,0.16) 0%, transparent 60%),' +
              'radial-gradient(ellipse 50% 40% at 85% 10%, rgba(127,209,174,0.10) 0%, transparent 55%),' +
              'radial-gradient(ellipse 35% 30% at 10% 30%, rgba(30,79,122,0.08) 0%, transparent 50%),' +
              'radial-gradient(ellipse 40% 35% at 50% 100%, rgba(30,79,122,0.04) 0%, transparent 60%)',
          }}
        />
        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
      </div>

      <div className="mx-auto max-w-5xl text-center">
        {/* Badge */}
        <div className="mb-7 inline-flex animate-fade-up items-center gap-2 rounded-full border px-4 py-1.5"
          style={{ borderColor: 'rgba(143,196,232,0.3)', background: 'rgba(143,196,232,0.06)' }}>
          <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full" style={{ background: '#7FD1AE' }} />
          <span className="text-xs font-semibold tracking-wide text-muted-foreground">
            Capacitación empresarial · Todo en uno
          </span>
        </div>

        {/* Headline */}
        <h1 className="mx-auto max-w-4xl animate-fade-up delay-100 font-display text-5xl font-normal leading-[1.1] tracking-tight text-foreground sm:text-6xl lg:text-[68px]">
          Capacita a tu equipo.{' '}
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(135deg, #1E4F7A 0%, #8FC4E8 50%, #7FD1AE 100%)' }}
          >
            Escala tu empresa.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl animate-fade-up delay-200 text-lg leading-relaxed text-muted-foreground">
          Crea cursos, asigna capacitaciones y mide el progreso de cada colaborador
          desde una sola plataforma — sin importar el tamaño de tu organización.
        </p>

        {/* CTAs */}
        <div className="mt-9 flex animate-fade-up delay-300 flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/register"
            className="group relative w-full overflow-hidden rounded-2xl px-8 py-4 text-base font-semibold text-white transition-all hover:scale-[1.03] hover:shadow-lg active:scale-[0.97] sm:w-auto"
            style={{ background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)', boxShadow: '0 6px 28px color-mix(in srgb, var(--tenant-primary) 28%, transparent)' }}>
            <span className="relative z-10">Comenzar gratis</span>
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </Link>
          <a href="#caracteristicas"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background px-8 py-4 text-base font-semibold text-foreground transition-all hover:border-capta-soft/40 hover:bg-muted sm:w-auto">
            <Icon name="play" size={14} className="text-capta-deep dark:text-capta-soft" />
            Ver demo · 2 min
          </a>
        </div>
        <p className="mt-4 text-xs font-medium text-muted-foreground/50">
          Sin tarjeta de crédito · Plan gratuito disponible
        </p>
      </div>

      {/* Browser mockup */}
      <div className="mx-auto mt-16 max-w-5xl">
        <div className="relative">
          <div aria-hidden
            className="absolute -inset-4 -z-10 rounded-3xl opacity-25 blur-3xl"
            style={{ background: 'linear-gradient(135deg, rgba(143,196,232,0.4), rgba(30,79,122,0.2), rgba(127,209,174,0.3))' }}
          />
          <div className="overflow-hidden rounded-2xl border border-border shadow-card-lg">
            {/* Browser bar */}
            <div className="flex items-center gap-1.5 border-b border-border bg-muted/60 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
              <div className="ml-4 flex flex-1 items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-1">
                <div className="h-2 w-2 rounded-full opacity-50"
                  style={{ background: 'linear-gradient(135deg, #1F5C4D, #7FD1AE)' }} />
                <span className="text-xs text-muted-foreground/50">app.capta.io/dashboard</span>
              </div>
            </div>
            {/* Dashboard preview */}
            <div className="flex min-h-[380px] bg-background sm:min-h-[440px]">
              {/* Fake sidebar */}
              <div className="hidden w-[180px] flex-shrink-0 border-r border-border bg-card p-4 sm:block">
                <div className="mb-5 flex items-center gap-2">
                  <div className="h-5 w-5 rounded-md"
                    style={{ background: 'linear-gradient(135deg, #1F5C4D, #7FD1AE)' }} />
                  <div className="h-2.5 w-12 rounded bg-muted" />
                </div>
                <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30">Plataforma</p>
                <div className="space-y-1">
                  {[false, true, false, false, false].map((active, i) => (
                    <div key={i} className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${active ? 'bg-capta-tint/60' : ''}`}>
                      <div className={`h-3 w-3 rounded-sm ${active ? 'opacity-60' : 'opacity-20'}`}
                        style={{ background: active ? '#1E4F7A' : 'currentColor' }} />
                      <div className={`h-2 w-full rounded ${active ? 'opacity-30' : 'opacity-10'}`}
                        style={{ background: active ? '#1E4F7A' : 'currentColor' }} />
                    </div>
                  ))}
                </div>
              </div>
              {/* Content */}
              <div className="flex-1 space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-1.5">
                    <div className="h-3 w-36 rounded bg-foreground/12" />
                    <div className="h-2 w-52 rounded bg-muted-foreground/10" />
                  </div>
                  <div className="h-8 w-28 rounded-xl"
                    style={{ background: 'linear-gradient(135deg, rgba(30,79,122,0.15), rgba(143,196,232,0.10))' }} />
                </div>
                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { color: '#1E4F7A', v: '24' },
                    { color: '#7FD1AE', v: '78%' },
                    { color: '#8FC4E8', v: '312' },
                    { color: '#F59E0B', v: '89' },
                  ].map((s, i) => (
                    <div key={i} className="rounded-xl border border-border bg-card p-3">
                      <div className="mb-2 h-5 w-5 rounded-lg"
                        style={{ background: `${s.color}18`, border: `1px solid ${s.color}22` }} />
                      <div className="text-sm font-semibold text-foreground">{s.v}</div>
                      <div className="mt-0.5 h-2 w-16 rounded bg-muted-foreground/10" />
                    </div>
                  ))}
                </div>
                {/* Progress section */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="mb-3 h-2.5 w-32 rounded bg-foreground/10" />
                  <div className="space-y-2.5">
                    {[
                      { w: '82%', c: '#1E4F7A', label: 'Lumen' },
                      { w: '67%', c: '#7FD1AE', label: 'Stellar' },
                      { w: '51%', c: '#8FC4E8', label: 'Nimbus' },
                    ].map(t => (
                      <div key={t.label} className="flex items-center gap-3">
                        <span className="w-12 text-[10px] text-muted-foreground">{t.label}</span>
                        <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full" style={{ width: t.w, background: t.c, opacity: 0.7 }} />
                        </div>
                        <span className="w-8 text-right text-[10px] text-muted-foreground">{t.w}</span>
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

// ─── Social proof ─────────────────────────────────────────────────────────────

function SocialProof() {
  return (
    <section id="clientes" className="border-y border-border/60 bg-muted/40 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <p className="mb-7 text-center text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground/40">
          Empresas que capacitan con Capta
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8">
          {['Lumen', 'Stellar', 'Nimbus', 'Acuario', 'Pampa', 'Cobalto'].map(name => (
            <span key={name} className="text-sm font-semibold text-muted-foreground/30 transition-colors hover:text-muted-foreground/60">
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

const STATS = [
  { value: 'Multi',  label: 'empresa desde el día 1', color: '#1E4F7A' },
  { value: '3',      label: 'planes disponibles',     color: '#7FD1AE' },
  { value: '∞',      label: 'cursos en Enterprise',   color: '#8FC4E8' },
  { value: '100%',   label: 'datos aislados',         color: '#1E4F7A' },
] as const;

function Stats() {
  return (
    <section className="bg-background px-6 py-16">
      <div className="mx-auto max-w-5xl grid grid-cols-2 gap-8 sm:grid-cols-4">
        {STATS.map(({ value, label, color }) => (
          <div key={label} className="text-center">
            <div className="font-display text-4xl font-normal tracking-tight sm:text-5xl bg-clip-text text-transparent"
              style={{ backgroundImage: `linear-gradient(135deg, ${color}, ${color}BB)` }}>
              {value}
            </div>
            <div className="mt-2 text-sm font-medium text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    span: 'lg:col-span-2',
    iconName: 'grid' as const,
    accent: '#8FC4E8',
    title: 'Gestión de cursos',
    desc: 'Crea y organiza cursos con videos, documentos y evaluaciones. Asigna capacitaciones a equipos o empleados específicos con un clic.',
    tag: 'Editor visual',
  },
  {
    span: '',
    iconName: 'chart-line' as const,
    accent: '#7FD1AE',
    title: 'Progreso en tiempo real',
    desc: 'Visualiza el avance de cada colaborador. Reportes automáticos para managers y directivos.',
    tag: 'Analytics',
  },
  {
    span: '',
    iconName: 'certificate' as const,
    accent: '#F59E0B',
    title: 'Certificaciones',
    desc: 'Genera certificados automáticos al completar cursos con tu marca y diseño personalizado.',
    tag: 'Próximamente',
  },
  {
    span: 'lg:col-span-2',
    iconName: 'shield' as const,
    accent: '#1E4F7A',
    title: 'Multi-empresa nativo',
    desc: 'Row Level Security en PostgreSQL garantiza aislamiento total. Cada empresa ve solo lo suyo — a nivel de base de datos, sin configuración adicional.',
    tag: 'Seguridad',
  },
];

function Features() {
  return (
    <section id="caracteristicas" className="bg-muted/30 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground/40">Características</p>
          <h2 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-4xl">
            Todo lo que necesita tu empresa
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
            Diseñado para crecer contigo, desde 5 hasta 5,000 colaboradores.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {FEATURES.map(card => (
            <div key={card.title}
              className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-7 transition-all duration-200 hover:-translate-y-0.5 ${card.span}`}
              style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)' }}
            >
              {/* Top accent line */}
              <div className="absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ background: `linear-gradient(90deg, transparent, ${card.accent}80, transparent)` }} />
              {/* Glow */}
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-15"
                style={{ background: card.accent }} />

              <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: `${card.accent}15`, color: card.accent, border: `1px solid ${card.accent}22` }}>
                <Icon name={card.iconName} size={18} />
              </div>

              <div className="flex items-start justify-between gap-3">
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
    name: 'Free',
    price: '$0',
    period: 'para siempre',
    desc: 'Para empezar sin compromisos.',
    features: ['1 empresa', '15 empleados', 'Cursos básicos', '2 GB storage'],
    addons: false,
    cta: 'Comenzar gratis',
    href: '/register',
    highlighted: false,
  },
  {
    name: 'Business',
    price: '$49',
    period: '/mes',
    desc: 'Para equipos en crecimiento.',
    features: ['5 empresas', '500 empleados', 'Evaluaciones', 'Certificados', 'Analíticas', '20 GB storage'],
    addons: true,
    cta: 'Elegir Business',
    href: '/register?plan=business',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: '$149',
    period: '/mes',
    desc: 'Sin límites, con tu marca.',
    features: ['Ilimitado', 'White-label', 'API access', 'SSO', 'SLA dedicado', '200 GB storage'],
    addons: true,
    cta: 'Contactar ventas',
    href: '/register?plan=enterprise',
    highlighted: false,
  },
] as const;

function Pricing() {
  return (
    <section id="precios" className="bg-background px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground/40">Precios</p>
          <h2 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-4xl">
            Planes para cada etapa
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
            Empieza gratis. Amplía sin cambiar de plan cuando lo necesites.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map(plan => (
            <div key={plan.name}
              className={`relative flex flex-col overflow-hidden rounded-2xl transition-all duration-200 hover:-translate-y-1 ${
                plan.highlighted
                  ? ''
                  : 'border border-border bg-card hover:border-capta-soft/30 hover:shadow-md'
              }`}
              style={plan.highlighted ? {
                background: 'linear-gradient(155deg, #1E4F7A 0%, #0A1F35 100%)',
                boxShadow: '0 1px 0 rgba(143,196,232,0.15) inset, 0 20px 60px rgba(30,79,122,0.3)',
              } : {
                boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(11,31,42,0.05)',
              }}
            >
              {plan.highlighted && (
                <>
                  <div className="absolute inset-x-0 top-0 h-px"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(143,196,232,0.6), transparent)' }} />
                  <div className="absolute right-5 top-5">
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                      style={{ background: 'linear-gradient(135deg, #7FD1AE, #A8E6CF)', color: '#0B1F2A' }}>
                      Popular
                    </span>
                  </div>
                </>
              )}

              <div className="p-7">
                <p className={`text-sm font-bold tracking-wide ${plan.highlighted ? 'text-capta-soft' : 'text-capta-deep dark:text-capta-soft'}`}>
                  {plan.name}
                </p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className={`font-display text-4xl font-normal tracking-tight ${plan.highlighted ? 'text-white' : 'text-foreground'}`}>
                    {plan.price}
                  </span>
                  <span className={`text-sm font-medium ${plan.highlighted ? 'text-white/40' : 'text-muted-foreground'}`}>
                    {plan.period}
                  </span>
                </div>
                <p className={`mt-1.5 text-sm ${plan.highlighted ? 'text-white/50' : 'text-muted-foreground'}`}>
                  {plan.desc}
                </p>

                <ul className="mt-7 space-y-2.5">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <Icon
                        name="check"
                        size={14}
                        className={plan.highlighted ? 'text-brand-mid flex-shrink-0' : 'flex-shrink-0 text-capta-deep dark:text-capta-soft'}
                      />
                      <span className={plan.highlighted ? 'text-white/65' : 'text-muted-foreground'}>{f}</span>
                    </li>
                  ))}
                </ul>
                {plan.addons && (
                  <p className={`mt-3 text-xs ${plan.highlighted ? 'text-white/30' : 'text-muted-foreground/50'}`}>
                    + Storage packs adicionales disponibles
                  </p>
                )}
              </div>

              <div className="mt-auto p-7 pt-0">
                <Link href={plan.href}
                  className="block w-full rounded-xl py-3.5 text-center text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={plan.highlighted
                    ? { background: 'linear-gradient(135deg, #7FD1AE, #A8E6CF)', color: '#0B1F2A', boxShadow: '0 4px 20px rgba(127,209,174,0.3)' }
                    : { background: 'linear-gradient(135deg, var(--tenant-primary) 0%, color-mix(in srgb, var(--tenant-primary) 72%, white) 100%)', color: '#fff', boxShadow: '0 2px 12px color-mix(in srgb, var(--tenant-primary) 20%, transparent)' }}>
                  {plan.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Add-on callout */}
        <div className="mt-8 rounded-2xl border border-border bg-card p-5 text-center"
          style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 4px 16px rgba(11,31,42,0.04)' }}>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-capta-deep dark:text-capta-soft">¿Necesitas más espacio?</span>{' '}
            Amplía sin cambiar de plan —{' '}
            <span className="font-medium text-capta-deep dark:text-capta-soft">+10 GB $5/mes</span>{' · '}
            <span className="font-medium text-capta-deep dark:text-capta-soft">+50 GB $19/mes</span>{' · '}
            <span className="font-medium text-capta-deep dark:text-capta-soft">+200 GB $59/mes</span>
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── CTA Banner ───────────────────────────────────────────────────────────────

function CtaBanner() {
  return (
    <section className="bg-muted/30 px-6 py-20">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl px-8 py-16 text-center"
        style={{ background: 'linear-gradient(150deg, #1E4F7A 0%, #0A1F35 60%, #102840 100%)' }}>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(143,196,232,0.5), transparent)' }} />
        <div aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10 blur-3xl"
          style={{ background: '#8FC4E8' }} />

        <div className="relative z-10">
          <h2 className="text-3xl font-semibold text-white sm:text-4xl">
            Listo para capacitar a tu equipo
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-white/50">
            Regístrate en minutos. Sin tarjeta de crédito. El plan gratuito no expira.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register"
              className="w-full rounded-2xl px-8 py-4 text-base font-semibold transition-all hover:scale-[1.03] active:scale-[0.97] sm:w-auto"
              style={{ background: 'linear-gradient(135deg, #7FD1AE, #A8E6CF)', color: '#0B1F2A', boxShadow: '0 4px 24px rgba(127,209,174,0.3)' }}>
              Crear cuenta gratis
            </Link>
            <Link href="/login"
              className="w-full rounded-2xl border border-white/15 bg-white/5 px-8 py-4 text-base font-semibold text-white/70 backdrop-blur-sm transition-all hover:border-white/25 hover:bg-white/10 hover:text-white sm:w-auto">
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30 px-6 py-10">
      <div className="mx-auto max-w-6xl flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <CaptaLogo markSize={22} showText />
        <p className="text-xs text-muted-foreground/50">
          © {new Date().getFullYear()} Capta. Todos los derechos reservados.
        </p>
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
