---
name: Project LMS
description: Contexto del proyecto — plataforma de capacitación empresarial multi-tenant
type: project
---

Plataforma LMS corporativa multi-empresa (nombre pendiente).

**Target:** Empresas medianas (50–500 empleados), mercado Latinoamérica.

**Plataformas:** Web (navegador), responsiva para móvil. No mobile nativo en MVP.

**Modelo de negocio (3 planes):**
- Free: 1 empresa, hasta 15 empleados, 1 GB storage, sin evaluaciones
- Business (~$49/mes): hasta 3 empresas, 500 empleados, evaluaciones, certificados
- Enterprise (~$149/mes): ilimitado, white-label, API

**Stack acordado:**
- Frontend: Next.js 15 + TypeScript + TailwindCSS + shadcn/ui
- Backend: NestJS 10 + TypeScript + Prisma ORM
- DB: PostgreSQL 16 con RLS para multi-tenancy + Redis 7
- Storage: Cloudflare R2 (sin egress fees)
- Video: Mux.com
- Pagos: Stripe
- Infra MVP: Vercel (FE, gratis) + Hetzner CX22 VPS ~€4.49/mes (BE+DB+Redis)
- CDN/DNS: Cloudflare

**Multi-tenancy:** Shared database + Row Level Security. tenant_id en todas las tablas.

**Estructura del proyecto:** Turborepo monorepo
- apps/web — Next.js frontend
- apps/api — NestJS backend
- packages/types — tipos compartidos (@capacitaciones/types)
- packages/tsconfig — configs TypeScript compartidas (@capacitaciones/tsconfig)

**CI/CD:**
- GitHub Actions
- CI: lint + type-check + tests en cada PR/push (con PostgreSQL y Redis reales)
- Deploy API: build Docker → push ghcr.io → SSH deploy al VPS → prisma migrate deploy
- Deploy Web: Vercel integración automática con GitHub

**Fases planificadas:**
1. Fundamentos: auth, multi-tenancy, Stripe (Fase 2)
2. Core: cursos, contenido, progreso (Fase 3)
3. Premium: evaluaciones, certificados, analíticas (Fase 4)
4. Polish y lanzamiento (Fase 5)

**Fase actual: 1 — Proyecto base configurado con CI/CD**

**Why:** MVP debe lanzar con modelo de pagos completo desde el inicio.
**How to apply:** Priorizar Stripe y arquitectura multi-tenant antes de features de contenido.
