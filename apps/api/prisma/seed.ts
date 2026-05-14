/**
 * Seed Script — Datos iniciales para la plataforma.
 *
 * Diseñado para ser IDEMPOTENTE: se puede ejecutar múltiples veces sin
 * duplicar datos. Usa `upsert` en todos los casos.
 *
 * Ejecución:
 *   npm run db:seed              (desde apps/api)
 *
 * En producción solo crea los planes. Los datos de desarrollo
 * se omiten automáticamente cuando NODE_ENV=production.
 */

import { PrismaClient, PlanType, UserRole, SubscriptionStatus } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Iniciando seed...\n');

  await seedPlans();

  if (process.env.NODE_ENV !== 'production') {
    await seedDevelopmentData();
  }

  console.log('\n✅ Seed completado.');
}

// ─── Planes ───────────────────────────────────────────────────────────────────

async function seedPlans() {
  console.log('  → Creando planes...');

  const plans = [
    {
      type:        PlanType.FREE,
      name:        'Free',
      description: 'Ideal para equipos pequeños que están empezando.',
      priceUsd:    0,
      // Límites
      maxEmployees: 15,
      maxCompanies: 1,
      maxStorageGb: 1,
      // Features
      hasEvaluations:  false,
      hasCertificates: false,
      hasAnalytics:    false,
      hasWhiteLabel:   false,
      hasApi:          false,
    },
    {
      type:        PlanType.BUSINESS,
      name:        'Business',
      description: 'Para empresas en crecimiento con equipos medianos.',
      priceUsd:    49,
      maxEmployees: 500,
      maxCompanies: 5,
      maxStorageGb: 20,
      hasEvaluations:  true,
      hasCertificates: true,
      hasAnalytics:    false,
      hasWhiteLabel:   false,
      hasApi:          false,
    },
    {
      type:        PlanType.ENTERPRISE,
      name:        'Enterprise',
      description: 'Sin límites, con white-label y acceso completo a la API.',
      priceUsd:    149,
      maxEmployees: -1, // ilimitado
      maxCompanies: -1,
      maxStorageGb: -1,
      hasEvaluations:  true,
      hasCertificates: true,
      hasAnalytics:    true,
      hasWhiteLabel:   true,
      hasApi:          true,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where:  { type: plan.type },
      update: plan,
      create: plan,
    });
  }

  console.log('     ✓ 3 planes creados (FREE, BUSINESS, ENTERPRISE)');
}

// ─── Datos de desarrollo ──────────────────────────────────────────────────────

async function seedDevelopmentData() {
  console.log('  → Creando datos de desarrollo...');

  // ── Tenant de prueba ────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where:  { slug: 'acme-corp' },
    update: {},
    create: { name: 'Acme Corp (Dev)', slug: 'acme-corp' },
  });

  // ── Suscripción Business activa ─────────────────────────────────────────────
  const businessPlan = await prisma.plan.findUniqueOrThrow({
    where: { type: PlanType.BUSINESS },
  });

  const now      = new Date();
  const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await prisma.subscription.upsert({
    where:  { tenantId: tenant.id },
    update: {},
    create: {
      tenantId:           tenant.id,
      planId:             businessPlan.id,
      status:             SubscriptionStatus.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd:   in30days,
    },
  });

  // ── Usuarios de prueba ──────────────────────────────────────────────────────
  const devUsers = [
    { email: 'owner@acme.dev',    role: UserRole.OWNER,    firstName: 'Owner',    lastName: 'Dev'     },
    { email: 'admin@acme.dev',    role: UserRole.ADMIN,    firstName: 'Admin',    lastName: 'Dev'     },
    { email: 'manager@acme.dev',  role: UserRole.MANAGER,  firstName: 'Manager',  lastName: 'Dev'     },
    { email: 'employee@acme.dev', role: UserRole.EMPLOYEE, firstName: 'Employee', lastName: 'Dev'     },
  ];

  // Misma password para todos en dev — fácil de recordar, no apta para producción
  const passwordHash = await hash('Dev123!', 12);

  for (const user of devUsers) {
    await prisma.user.upsert({
      where:  { tenantId_email: { tenantId: tenant.id, email: user.email } },
      update: {},
      create: {
        tenantId: tenant.id,
        passwordHash,
        ...user,
      },
    });
  }

  console.log('     ✓ Tenant "acme-corp" con plan Business');
  console.log('     ✓ 4 usuarios de prueba (password: Dev123!)');
  console.log('');
  console.log('     Usuarios disponibles:');
  devUsers.forEach(u => console.log(`       · ${u.email} (${u.role})`));
}

// ─────────────────────────────────────────────────────────────────────────────

main()
  .catch((error) => {
    console.error('\n❌ Error en seed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
