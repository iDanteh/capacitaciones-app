import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { PlanType, UserRole, SubscriptionStatus } from '@prisma/client';
import { hash } from 'bcryptjs';

/**
 * SeederService — ejecuta la seed de datos de desarrollo automáticamente
 * cada vez que la aplicación arranca, SOLO en NODE_ENV=development.
 *
 * La seed es 100% idempotente: usa upsert/findFirst en todos los casos,
 * por lo que puede correr múltiples veces sin duplicar datos.
 *
 * ¿Por qué OnApplicationBootstrap y no OnModuleInit?
 * OnApplicationBootstrap se ejecuta después de que TODOS los módulos
 * están inicializados, garantizando que PrismaService ya tiene conexión.
 */
@Injectable()
export class SeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<string>('nodeEnv') !== 'development') return;

    this.logger.log('🌱 Ejecutando seed de desarrollo...');

    try {
      await this.seedPlans();
      await this.seedStoragePacks();
      await this.seedDevelopmentData();
      this.logger.log('✅ Seed completado.');
    } catch (error) {
      this.logger.error('❌ Error en seed:', error);
    }
  }

  // ── Planes ──────────────────────────────────────────────────────────────────

  private async seedPlans(): Promise<void> {
    const plans = [
      {
        type: PlanType.FREE,
        name: 'Free',
        description: 'Ideal para equipos pequeños que están empezando.',
        priceUsd: 0,
        maxEmployees: 15,
        maxCompanies: 1,
        maxStorageGb: 1,
        hasEvaluations: false,
        hasCertificates: false,
        hasAnalytics: false,
        hasWhiteLabel: false,
        hasApi: false,
      },
      {
        type: PlanType.BUSINESS,
        name: 'Business',
        description: 'Para empresas en crecimiento con equipos medianos.',
        priceUsd: 49,
        maxEmployees: 500,
        maxCompanies: 5,
        maxStorageGb: 20,
        hasEvaluations: true,
        hasCertificates: true,
        hasAnalytics: false,
        hasWhiteLabel: false,
        hasApi: false,
      },
      {
        type: PlanType.ENTERPRISE,
        name: 'Enterprise',
        description: 'Sin límites, con white-label y acceso completo a la API.',
        priceUsd: 149,
        maxEmployees: -1,
        maxCompanies: -1,
        maxStorageGb: -1,
        hasEvaluations: true,
        hasCertificates: true,
        hasAnalytics: true,
        hasWhiteLabel: true,
        hasApi: true,
      },
    ];

    for (const plan of plans) {
      await this.prisma.plan.upsert({
        where:  { type: plan.type },
        update: plan,
        create: plan,
      });
    }

    this.logger.debug('  ✓ Planes (FREE, BUSINESS, ENTERPRISE)');
  }

  // ── Storage Packs ────────────────────────────────────────────────────────────

  private async seedStoragePacks(): Promise<void> {
    const packs = [
      { name: 'Pack S', storageGb: 10,  priceUsd: 5  },
      { name: 'Pack M', storageGb: 50,  priceUsd: 19 },
      { name: 'Pack L', storageGb: 200, priceUsd: 59 },
    ];

    for (const pack of packs) {
      const existing = await this.prisma.storagePack.findFirst({ where: { name: pack.name } });
      if (existing) {
        await this.prisma.storagePack.update({ where: { id: existing.id }, data: pack });
      } else {
        await this.prisma.storagePack.create({ data: { ...pack, isActive: true } });
      }
    }

    this.logger.debug('  ✓ Storage packs (S, M, L)');
  }

  // ── Datos de desarrollo ────────────────────────────────────────────────────

  private async seedDevelopmentData(): Promise<void> {
    // ── Tenant interno de la plataforma (para SUPER_ADMIN) ──────────────────
    // El SUPER_ADMIN necesita un tenantId válido en la BD aunque conceptualmente
    // no "pertenece" a ninguna empresa cliente. Se usa un tenant especial marcado
    // como plataforma interna — nunca visible en el panel de clientes.
    const platformTenant = await this.prisma.tenant.upsert({
      where:  { slug: 'capta-platform' },
      update: {},
      create: { name: 'Capta Platform (Internal)', slug: 'capta-platform' },
    });

    const superAdminHash = await hash('SuperAdmin123!', 12);
    await this.prisma.user.upsert({
      where:  { tenantId_email: { tenantId: platformTenant.id, email: 'superadmin@capta.dev' } },
      update: { passwordHash: superAdminHash, isActive: true, deletedAt: null },
      create: {
        tenantId:     platformTenant.id,
        email:        'superadmin@capta.dev',
        passwordHash: superAdminHash,
        firstName:    'Super',
        lastName:     'Admin',
        role:         UserRole.SUPER_ADMIN,
      },
    });

    this.logger.debug('  ✓ Tenant "capta-platform" + superadmin@capta.dev (SuperAdmin123!)');

    // ── Tenant de prueba para clientes ──────────────────────────────────────
    const tenant = await this.prisma.tenant.upsert({
      where:  { slug: 'acme-corp' },
      update: {},
      create: { name: 'Acme Corp (Dev)', slug: 'acme-corp' },
    });

    // Suscripción Business activa
    const businessPlan = await this.prisma.plan.findUniqueOrThrow({
      where: { type: PlanType.BUSINESS },
    });

    const now      = new Date();
    const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await this.prisma.subscription.upsert({
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

    // Usuarios de prueba (password: Dev123!)
    const passwordHash = await hash('Dev123!', 12);

    const devUsers = [
      { email: 'owner@acme.dev',    role: UserRole.OWNER,    firstName: 'Owner',    lastName: 'Dev' },
      { email: 'admin@acme.dev',    role: UserRole.ADMIN,    firstName: 'Admin',    lastName: 'Dev' },
      { email: 'manager@acme.dev',  role: UserRole.MANAGER,  firstName: 'Manager',  lastName: 'Dev' },
      { email: 'employee@acme.dev', role: UserRole.EMPLOYEE, firstName: 'Employee', lastName: 'Dev' },
    ];

    for (const user of devUsers) {
      await this.prisma.user.upsert({
        where:  { tenantId_email: { tenantId: tenant.id, email: user.email } },
        update: { passwordHash, isActive: true, deletedAt: null },
        create: { tenantId: tenant.id, passwordHash, ...user },
      });
    }

    this.logger.debug('  ✓ Tenant "acme-corp" + 4 usuarios (Dev123!)');
  }
}
