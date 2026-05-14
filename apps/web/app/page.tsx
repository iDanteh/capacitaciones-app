import Link from 'next/link';

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        {/* Logo placeholder — se reemplaza cuando el logo esté definido */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy">
            <span className="text-xs font-bold text-white">L</span>
          </div>
          <span className="text-sm font-semibold text-foreground tracking-tight">LMS</span>
        </div>

        {/* Nav links — solo secciones que existirán en el producto */}
        <nav className="hidden items-center gap-6 md:flex">
          <a href="#caracteristicas" className="text-sm text-muted-foreground transition-colors hover:text-navy">
            Características
          </a>
          <a href="#precios" className="text-sm text-muted-foreground transition-colors hover:text-navy">
            Precios
          </a>
        </nav>

        {/* CTAs */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-navy transition-colors hover:bg-secondary"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-navy/90 active:scale-95"
          >
            Comenzar gratis
          </Link>
        </div>
      </div>
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden bg-frost px-6 pb-20 pt-24 sm:pt-32">
      {/* Gradiente decorativo de fondo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl"
      >
        <div
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-sky to-navy opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
          style={{ clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)' }}
        />
      </div>

      <div className="mx-auto max-w-4xl text-center">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center rounded-full border border-sky/30 bg-white px-3 py-1 text-xs font-medium text-navy shadow-sm">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-sky" />
          Plataforma de capacitación empresarial
        </div>

        {/* Headline */}
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
          Capacita a tu equipo.{' '}
          <span className="bg-gradient-to-r from-navy via-sky to-navy bg-clip-text text-transparent">
            Escala tu empresa.
          </span>
        </h1>

        {/* Subheadline */}
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
          Una plataforma centralizada para crear cursos, asignar capacitaciones y medir
          el progreso de cada empleado — sin importar el tamaño de tu organización.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/register"
            className="w-full rounded-xl bg-navy px-8 py-3.5 text-base font-semibold text-white shadow-md transition-all hover:bg-navy/90 hover:shadow-lg active:scale-95 sm:w-auto"
          >
            Comenzar gratis
          </Link>
          <Link
            href="/login"
            className="w-full rounded-xl border border-border bg-white px-8 py-3.5 text-base font-semibold text-foreground transition-all hover:border-navy/30 hover:bg-secondary sm:w-auto"
          >
            Iniciar sesión
          </Link>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Sin tarjeta de crédito · Plan gratuito disponible
        </p>
      </div>

      {/* Preview placeholder — reemplazar con captura real del dashboard */}
      <div className="mx-auto mt-16 max-w-5xl">
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-2xl shadow-navy/10 ring-1 ring-inset ring-white/10">
          {/* Barra de browser simulada */}
          <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
            <div className="ml-4 flex-1 rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground">
              app.tudominio.com/dashboard
            </div>
          </div>
          {/* Área de preview */}
          <div className="flex min-h-[360px] items-center justify-center bg-gradient-to-b from-frost to-white p-8 sm:min-h-[460px]">
            <div className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-gradient-to-br from-sky/30 to-navy/30" />
              <p className="text-sm font-medium text-muted-foreground">Preview del dashboard</p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Esta sección se actualizará con capturas reales del producto
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    title: 'Gestión de cursos',
    description:
      'Crea y organiza cursos con videos, documentos y evaluaciones desde un panel centralizado. Asigna capacitaciones a equipos o empleados específicos.',
  },
  {
    title: 'Progreso en tiempo real',
    description:
      'Visualiza el avance de cada empleado por curso, módulo y evaluación. Reportes detallados para managers y directivos.',
  },
  {
    title: 'Certificaciones',
    description:
      'Genera certificados automáticos al completar cursos. Personaliza el diseño con el logo de tu empresa (plan Business o superior).',
  },
] as const;

function Features() {
  return (
    <section id="caracteristicas" className="bg-white px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Todo lo que necesita tu empresa
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
            Diseñado para empresas medianas que quieren resultados sin complejidad de implementación.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-border/60 bg-frost p-8 transition-all hover:border-sky/40 hover:shadow-md hover:shadow-sky/10"
            >
              {/* Placeholder de ícono — se definirá cuando el ícono sea funcional */}
              <div className="mb-4 h-10 w-10 rounded-xl bg-gradient-to-br from-sky/30 to-navy/30" />
              <h3 className="mb-2 text-base font-semibold text-foreground">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
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
    description: 'Para equipos pequeños que quieren empezar.',
    addons: false,
    features: ['1 empresa', 'Hasta 15 empleados', 'Cursos básicos', '2 GB de almacenamiento'],
    cta: 'Comenzar gratis',
    href: '/register',
    highlighted: false,
  },
  {
    name: 'Business',
    price: '$49',
    period: 'por mes',
    description: 'Para empresas en crecimiento que necesitan más control.',
    addons: true,
    features: [
      'Hasta 5 empresas',
      '500 empleados',
      'Evaluaciones y certificados',
      'Analíticas de progreso',
      '20 GB de almacenamiento',
      'Storage packs disponibles',
    ],
    cta: 'Elegir Business',
    href: '/register?plan=business',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: '$149',
    period: 'por mes',
    description: 'Sin límites, con tu marca y acceso a la API.',
    addons: true,
    features: [
      'Empresas ilimitadas',
      'Empleados ilimitados',
      'White-label completo',
      'Acceso a API',
      '200 GB de almacenamiento',
      'Storage packs disponibles',
    ],
    cta: 'Elegir Enterprise',
    href: '/register?plan=enterprise',
    highlighted: false,
  },
] as const;

function Pricing() {
  return (
    <section id="precios" className="bg-frost px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Planes para cada etapa
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
            Empieza gratis. Crece cuando lo necesites. Amplía tu almacenamiento sin cambiar de plan.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={[
                'relative flex flex-col rounded-2xl border p-8 transition-shadow',
                plan.highlighted
                  ? 'border-navy bg-navy text-white shadow-xl shadow-navy/25'
                  : 'border-border/60 bg-white hover:shadow-md',
              ].join(' ')}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-sky px-3 py-1 text-xs font-semibold text-navy shadow-sm">
                    Más popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <p className={`text-sm font-semibold ${plan.highlighted ? 'text-sky' : 'text-navy'}`}>
                  {plan.name}
                </p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                  <span className={`text-sm ${plan.highlighted ? 'text-white/60' : 'text-muted-foreground'}`}>
                    /{plan.period}
                  </span>
                </div>
                <p className={`mt-2 text-sm ${plan.highlighted ? 'text-white/70' : 'text-muted-foreground'}`}>
                  {plan.description}
                </p>
              </div>

              <ul className="mb-8 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <span className={`mt-0.5 flex-shrink-0 text-base leading-none ${plan.highlighted ? 'text-sky' : 'text-navy'}`}>
                      ✓
                    </span>
                    <span className={plan.highlighted ? 'text-white/85' : 'text-muted-foreground'}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {plan.addons && (
                <p className={`mb-4 text-xs ${plan.highlighted ? 'text-white/50' : 'text-muted-foreground/60'}`}>
                  + Packs de almacenamiento adicional disponibles
                </p>
              )}

              <Link
                href={plan.href}
                className={[
                  'block w-full rounded-xl py-3 text-center text-sm font-semibold transition-all active:scale-95',
                  plan.highlighted
                    ? 'bg-sky text-navy hover:bg-sky/90 shadow-sm'
                    : 'bg-navy text-white hover:bg-navy/90',
                ].join(' ')}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Storage add-on callout */}
        <div className="mt-10 rounded-2xl border border-sky/20 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-foreground">
            <span className="font-semibold text-navy">¿Necesitas más espacio?</span>{' '}
            <span className="text-muted-foreground">
              Amplía tu almacenamiento sin cambiar de plan:
              +10 GB por $5/mes · +50 GB por $19/mes · +200 GB por $59/mes
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-border/60 bg-white px-6 py-12">
      <div className="mx-auto max-w-6xl flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        {/* Logo placeholder */}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy">
            <span className="text-xs font-bold text-white">L</span>
          </div>
          <span className="text-sm font-semibold text-foreground">LMS</span>
        </div>
        <p className="text-xs text-muted-foreground">
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
        <Features />
        <Pricing />
      </main>
      <Footer />
    </>
  );
}
