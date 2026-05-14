import Link from 'next/link';

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <header className="fixed top-0 z-50 w-full">
      <div className="mx-auto mt-3 max-w-6xl px-4">
        <div className="flex h-14 items-center justify-between rounded-2xl border border-navy/10 bg-white/80 px-5 shadow-sm shadow-navy/5 backdrop-blur-xl">
          {/* Logo placeholder */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky to-navy shadow-sm shadow-sky/30">
              <span className="text-xs font-bold text-white">L</span>
            </div>
            <span className="text-sm font-semibold text-navy tracking-tight">LMS</span>
          </div>

          {/* Nav links */}
          <nav className="hidden items-center gap-8 md:flex">
            {[
              { label: 'Características', href: '#caracteristicas' },
              { label: 'Precios', href: '#precios' },
            ].map(({ label, href }) => (
              <a key={label} href={href}
                className="text-sm text-muted-foreground transition-colors hover:text-navy">
                {label}
              </a>
            ))}
          </nav>

          {/* CTAs */}
          <div className="flex items-center gap-2">
            <Link href="/login"
              className="rounded-xl px-4 py-2 text-sm font-medium text-navy/70 transition-all hover:bg-secondary hover:text-navy">
              Iniciar sesión
            </Link>
            <Link href="/register"
              className="rounded-xl bg-gradient-to-r from-navy to-[#0E6FAD] px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-navy/20 transition-all hover:shadow-navy/40 hover:scale-105 active:scale-95">
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
    <section className="relative overflow-hidden bg-white px-6 pb-24 pt-36">
      {/* Gradiente suave de fondo */}
      <div aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% -5%, #5AC8FA18 0%, transparent 65%),' +
            'radial-gradient(ellipse 40% 30% at 85% 20%, #14B8A610 0%, transparent 60%),' +
            'radial-gradient(ellipse 30% 25% at 10% 30%, #0B5A8C08 0%, transparent 50%)',
        }}
      />
      {/* Dot grid decorativo */}
      <div aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.025]"
        style={{
          backgroundImage: 'radial-gradient(#0B5A8C 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="mx-auto max-w-5xl text-center">
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-sky/25 bg-sky/5 px-4 py-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky" />
          <span className="text-xs font-medium text-navy/80">Plataforma de capacitación empresarial</span>
        </div>

        {/* Headline */}
        <h1 className="mx-auto max-w-4xl text-5xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
          Capacita a tu equipo.{' '}
          <span className="bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(135deg, #0B5A8C 0%, #5AC8FA 55%, #14B8A6 100%)' }}>
            Escala tu empresa.
          </span>
        </h1>

        <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Una plataforma centralizada para crear cursos, asignar capacitaciones y medir
          el progreso de cada colaborador — sin importar el tamaño de tu organización.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/register"
            className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-navy to-[#0E6FAD] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-navy/20 transition-all hover:shadow-navy/40 hover:scale-105 active:scale-95 sm:w-auto">
            Comenzar gratis
          </Link>
          <Link href="/login"
            className="w-full rounded-2xl border border-border bg-white px-8 py-4 text-base font-semibold text-foreground transition-all hover:border-navy/25 hover:bg-secondary hover:text-navy sm:w-auto">
            Iniciar sesión
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground/60">Sin tarjeta de crédito · Plan gratuito disponible</p>
      </div>

      {/* Browser mockup */}
      <div className="mx-auto mt-20 max-w-5xl">
        <div className="relative">
          {/* Glow detrás */}
          <div aria-hidden="true"
            className="absolute -inset-3 -z-10 rounded-3xl opacity-40 blur-2xl"
            style={{ background: 'linear-gradient(135deg, #5AC8FA30, #0B5A8C20, #14B8A620)' }}
          />
          <div className="overflow-hidden rounded-2xl border border-navy/10 shadow-2xl shadow-navy/10">
            {/* Barra browser */}
            <div className="flex items-center gap-1.5 border-b border-navy/8 bg-frost px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
              <div className="ml-4 flex-1 rounded-lg border border-navy/8 bg-white/60 px-3 py-1 text-xs text-muted-foreground/60">
                app.tudominio.com/dashboard
              </div>
            </div>
            {/* Preview area */}
            <div className="flex min-h-[360px] items-center justify-center p-8 sm:min-h-[460px]"
              style={{ background: 'linear-gradient(180deg, #F4F8FB 0%, #FFFFFF 100%)' }}>
              <div className="w-full max-w-2xl space-y-3 opacity-30">
                <div className="grid grid-cols-3 gap-3">
                  {[`#5AC8FA`, `#14B8A6`, `#0B5A8C`].map((c, i) => (
                    <div key={i} className="h-16 rounded-xl border"
                      style={{ borderColor: `${c}30`, background: `${c}10` }} />
                  ))}
                </div>
                <div className="h-40 rounded-xl border border-navy/10 bg-white" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-24 rounded-xl border border-navy/10 bg-white" />
                  <div className="h-24 rounded-xl border border-navy/10 bg-white" />
                </div>
                <p className="pt-4 text-center text-xs text-muted-foreground/60">
                  Esta sección se actualizará con capturas reales del producto
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

const STATS = [
  { value: 'Multi', label: 'empresa desde el día 1' },
  { value: '3', label: 'planes disponibles' },
  { value: '∞', label: 'cursos en Enterprise' },
  { value: '100%', label: 'datos aislados por empresa' },
] as const;

function Stats() {
  return (
    <section className="border-y border-navy/8 bg-frost px-6 py-12">
      <div className="mx-auto max-w-6xl grid grid-cols-2 gap-8 sm:grid-cols-4">
        {STATS.map(({ value, label }) => (
          <div key={label} className="text-center">
            <div className="text-3xl font-bold sm:text-4xl bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg, #0B5A8C, #5AC8FA)' }}>
              {value}
            </div>
            <div className="mt-1.5 text-sm text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Features Bento Grid ──────────────────────────────────────────────────────

const BENTO_CARDS = [
  {
    span: 'sm:col-span-2',
    accentFrom: '#5AC8FA',
    accentTo: '#38BDF8',
    title: 'Gestión de cursos',
    desc: 'Crea y organiza cursos con videos, documentos y evaluaciones. Asigna capacitaciones a equipos o empleados específicos.',
    extra: true,
  },
  {
    span: '',
    accentFrom: '#14B8A6',
    accentTo: '#0D9488',
    title: 'Progreso en tiempo real',
    desc: 'Visualiza el avance de cada colaborador por curso y módulo. Reportes para managers y directivos.',
    extra: false,
  },
  {
    span: '',
    accentFrom: '#0B5A8C',
    accentTo: '#0E6FAD',
    title: 'Certificaciones',
    desc: 'Genera certificados automáticos al completar cursos. Personaliza el diseño con tu marca.',
    extra: false,
  },
  {
    span: 'sm:col-span-2',
    accentFrom: '#5AC8FA',
    accentTo: '#14B8A6',
    title: 'Multi-empresa nativo',
    desc: 'Row Level Security en PostgreSQL garantiza aislamiento de datos. Cada empresa ve solo lo suyo — a nivel de base de datos.',
    extra: true,
  },
] as const;

function Features() {
  return (
    <section id="caracteristicas" className="bg-white px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(90deg, #0B5A8C, #5AC8FA)' }}>
            Características
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Todo lo que necesita tu empresa
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
            Diseñado para crecer contigo, desde 5 hasta 500 colaboradores.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENTO_CARDS.map((card) => (
            <div key={card.title}
              className={`group relative overflow-hidden rounded-2xl border border-navy/8 bg-white p-7 transition-all hover:-translate-y-0.5 hover:border-navy/15 hover:shadow-xl hover:shadow-navy/8 ${card.span}`}>
              {/* Top accent line */}
              <div className="absolute inset-x-0 top-0 h-px"
                style={{ background: `linear-gradient(90deg, transparent, ${card.accentFrom}60, transparent)` }}
                aria-hidden="true" />
              {/* Glow al hover */}
              <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-15"
                style={{ background: card.accentFrom }} aria-hidden="true" />
              {/* Placeholder ícono */}
              <div className="mb-5 h-9 w-9 rounded-xl"
                style={{ background: `linear-gradient(135deg, ${card.accentFrom}25, ${card.accentTo}10)`, border: `1px solid ${card.accentFrom}20` }} />
              <h3 className="text-base font-semibold text-foreground">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.desc}</p>
              {card.extra && (
                <div className="mt-4 flex gap-2">
                  {['Empresa A', 'Empresa B', 'Empresa C'].map((e) => (
                    <span key={e} className="rounded-lg border border-navy/10 bg-frost px-2.5 py-1 text-xs text-muted-foreground">
                      {e}
                    </span>
                  ))}
                </div>
              )}
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
    desc: 'Para empresas en crecimiento.',
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
    <section id="precios" className="bg-frost px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(90deg, #0B5A8C, #5AC8FA)' }}>
            Precios
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Planes para cada etapa
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
            Empieza gratis. Amplía tu storage sin cambiar de plan cuando lo necesites.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div key={plan.name}
              className={`relative flex flex-col overflow-hidden rounded-2xl transition-all hover:-translate-y-1 ${
                plan.highlighted
                  ? 'shadow-2xl shadow-navy/20'
                  : 'border border-navy/10 bg-white shadow-sm hover:shadow-md hover:shadow-navy/8'
              }`}
              style={plan.highlighted ? {
                background: 'linear-gradient(160deg, #0B5A8C 0%, #071F30 100%)',
              } : {}}>
              {plan.highlighted && (
                <div className="absolute inset-x-0 top-0 h-px"
                  style={{ background: 'linear-gradient(90deg, transparent, #5AC8FA80, transparent)' }} />
              )}
              {plan.highlighted && (
                <div className="absolute right-5 top-5">
                  <span className="rounded-full px-3 py-1 text-xs font-bold"
                    style={{ background: 'linear-gradient(135deg, #5AC8FA, #38BDF8)', color: '#050E1A' }}>
                    Popular
                  </span>
                </div>
              )}

              <div className="p-7">
                <p className={`text-sm font-semibold ${plan.highlighted ? 'text-sky' : 'text-navy'}`}>
                  {plan.name}
                </p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className={`text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-foreground'}`}>
                    {plan.price}
                  </span>
                  <span className={`text-sm ${plan.highlighted ? 'text-white/40' : 'text-muted-foreground'}`}>
                    {plan.period}
                  </span>
                </div>
                <p className={`mt-1.5 text-sm ${plan.highlighted ? 'text-white/50' : 'text-muted-foreground'}`}>
                  {plan.desc}
                </p>

                <ul className="mt-7 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <span className={`flex-shrink-0 leading-none ${plan.highlighted ? 'text-sky' : 'text-navy'}`}>✓</span>
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
                  className="block w-full rounded-xl py-3.5 text-center text-sm font-semibold transition-all hover:scale-105 active:scale-95"
                  style={plan.highlighted
                    ? { background: 'linear-gradient(135deg, #5AC8FA, #38BDF8)', color: '#050E1A', boxShadow: '0 4px 20px #5AC8FA35' }
                    : { background: '#0B5A8C', color: '#fff' }}>
                  {plan.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Add-on callout */}
        <div className="mt-8 rounded-2xl border border-sky/20 bg-white p-6 text-center shadow-sm">
          <p className="text-sm">
            <span className="font-semibold text-navy">¿Necesitas más espacio?</span>{' '}
            <span className="text-muted-foreground">
              Amplía sin cambiar de plan —{' '}
              <span className="text-navy font-medium">+10 GB $5/mes</span>{' · '}
              <span className="text-navy font-medium">+50 GB $19/mes</span>{' · '}
              <span className="text-navy font-medium">+200 GB $59/mes</span>
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── CTA Banner ───────────────────────────────────────────────────────────────

function CtaBanner() {
  return (
    <section className="bg-white px-6 py-20">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl px-8 py-16 text-center"
        style={{
          background: 'linear-gradient(135deg, #0B5A8C 0%, #071F30 60%, #0B3D5A 100%)',
          boxShadow: '0 0 80px #0B5A8C20, inset 0 0 60px #5AC8FA05',
        }}>
        <div aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-15 blur-3xl"
          style={{ background: '#5AC8FA' }} />
        <div className="absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, #5AC8FA50, transparent)' }}
          aria-hidden="true" />
        <div className="relative z-10">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Listo para capacitar a tu equipo
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-white/50">
            Regístrate en minutos. Sin tarjeta de crédito. El plan gratuito no expira.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register"
              className="w-full rounded-2xl px-8 py-4 text-base font-semibold transition-all hover:scale-105 active:scale-95 sm:w-auto"
              style={{ background: 'linear-gradient(135deg, #5AC8FA, #38BDF8)', color: '#050E1A', boxShadow: '0 4px 24px #5AC8FA35' }}>
              Crear cuenta gratis
            </Link>
            <Link href="/login"
              className="w-full rounded-2xl border border-white/15 bg-white/8 px-8 py-4 text-base font-semibold text-white/70 backdrop-blur-sm transition-all hover:border-white/25 hover:bg-white/12 hover:text-white sm:w-auto">
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
    <footer className="border-t border-navy/8 bg-frost px-6 py-10">
      <div className="mx-auto max-w-6xl flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: 'linear-gradient(135deg, #5AC8FA, #0B5A8C)' }}>
            <span className="text-xs font-bold text-white">L</span>
          </div>
          <span className="text-sm font-semibold text-navy/60">LMS</span>
        </div>
        <p className="text-xs text-muted-foreground/60">
          © {new Date().getFullYear()} Plataforma LMS. Todos los derechos reservados.
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
        <Stats />
        <Features />
        <Pricing />
        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
