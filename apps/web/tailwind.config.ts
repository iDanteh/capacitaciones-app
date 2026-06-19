import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        sans:    ['var(--font-geist)', 'system-ui', 'sans-serif'],
        display: ['var(--font-dm-serif)', 'Georgia', 'serif'],
      },
      colors: {
        border:     'hsl(var(--border))',
        input:      'hsl(var(--input))',
        ring:       'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        // ── Tokens de brand directos ───────────────────────────────────────
        brand: {
          dark:  '#1F5C4D',   // teal profundo (logo)
          mid:   '#7FD1AE',   // mint (logo)
          light: '#A8E6CF',   // mint claro (logo dark mode)
        },
        capta: {
          deep:  'var(--tenant-primary)', // navy UI accent — dinámico por tenant
          soft:  '#8FC4E8',               // azul suave UI
          tint:  '#DCE9F4',               // tint muy claro
          glow:  '#A8D4F0',               // glow
        },
        ink: {
          DEFAULT: '#0B1F2A',  // texto primario
          muted:   '#5E7481',  // texto secundario
          faint:   '#7D93A1',  // texto terciario
          cream:   '#F4F2EC',  // texto dark mode
        },
      },
      borderRadius: {
        lg:   'var(--radius)',
        md:   'calc(var(--radius) - 2px)',
        sm:   'calc(var(--radius) - 4px)',
        xl:   'calc(var(--radius) + 2px)',
        '2xl': 'calc(var(--radius) + 6px)',
      },
      boxShadow: {
        card:    '0 1px 0 rgba(255,255,255,0.6) inset, 0 12px 36px rgba(11,31,42,0.06)',
        'card-dark': '0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 60px rgba(0,0,0,0.35)',
        'card-lg': '0 1px 0 rgba(255,255,255,0.7) inset, 0 20px 60px rgba(11,31,42,0.09)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
