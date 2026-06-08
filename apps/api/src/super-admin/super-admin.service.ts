import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface TenantSummary {
  id:           string;
  name:         string;
  slug:         string;
  isActive:     boolean;
  createdAt:    Date;
  logoUrl:      string | null;
  primaryColor: string | null;
  userCount:    number;
  courseCount:  number;
  childCount:   number;
  subscription: {
    status:          string;
    planName:        string;
    planType:        string;
    currentPeriodEnd: Date;
  } | null;
}

export interface TenantDetail extends TenantSummary {
  domain: string | null;
  enrollmentCount: number;
  certificateCount: number;
  users: {
    id:          string;
    firstName:   string;
    lastName:    string;
    email:       string;
    role:        string;
    isActive:    boolean;
    lastLoginAt: Date | null;
    createdAt:   Date;
  }[];
}

export interface PlatformStats {
  totalTenants:       number;
  activeTenants:      number;
  totalUsers:         number;
  totalCourses:       number;
  totalEnrollments:   number;
  totalCertificates:  number;
  byPlan: { planType: string; planName: string; count: number }[];
}

/**
 * SuperAdminService — gestión transversal de toda la plataforma.
 *
 * IMPORTANTE: ninguna query aquí filtra por tenantId — tienen acceso
 * a todos los datos. Asegurarse de que solo SUPER_ADMIN llegue a este servicio
 * vía SuperAdminGuard + JwtAuthGuard.
 */
@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Estadísticas globales de la plataforma: tenants, usuarios,
   * cursos, inscripciones, certificados y distribución por plan.
   */
  async getPlatformStats(): Promise<PlatformStats> {
    const [
      totalTenants,
      activeTenants,
      totalUsers,
      totalCourses,
      totalEnrollments,
      totalCertificates,
      subscriptions,
    ] = await Promise.all([
      // Solo tenants raíz (no sub-empresas)
      this.prisma.tenant.count({ where: { deletedAt: null, parentTenantId: null } }),
      this.prisma.tenant.count({ where: { deletedAt: null, isActive: true, parentTenantId: null } }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.course.count({ where: { deletedAt: null } }),
      this.prisma.enrollment.count({ where: { status: { not: 'DROPPED' } } }),
      this.prisma.certificate.count(),
      // Distribución de suscripciones activas por plan
      this.prisma.subscription.findMany({
        where: { status: { in: ['ACTIVE', 'TRIALING'] } },
        select: { plan: { select: { type: true, name: true } } },
      }),
    ]);

    // Agrupar en memoria — el número de planes es fijo (3)
    const byPlanMap = new Map<string, { planType: string; planName: string; count: number }>();
    for (const sub of subscriptions) {
      const key = sub.plan.type;
      const existing = byPlanMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        byPlanMap.set(key, { planType: sub.plan.type, planName: sub.plan.name, count: 1 });
      }
    }

    return {
      totalTenants,
      activeTenants,
      totalUsers,
      totalCourses,
      totalEnrollments,
      totalCertificates,
      byPlan: Array.from(byPlanMap.values()).sort((a, b) => b.count - a.count),
    };
  }

  /**
   * Lista todos los tenants raíz con sus estadísticas principales.
   * Soporta búsqueda por nombre o slug.
   */
  async listTenants(search?: string): Promise<TenantSummary[]> {
    const searchFilter = search?.trim()
      ? {
          OR: [
            { name: { contains: search.trim(), mode: 'insensitive' as const } },
            { slug: { contains: search.trim(), mode: 'insensitive' as const } },
          ],
        }
      : {};

    const tenants = await this.prisma.tenant.findMany({
      where: { deletedAt: null, parentTenantId: null, ...searchFilter },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id:           true,
        name:         true,
        slug:         true,
        isActive:     true,
        createdAt:    true,
        logoUrl:      true,
        primaryColor: true,
        _count: {
          select: {
            users:    { where: { deletedAt: null } },
            courses:  { where: { deletedAt: null } },
            children: { where: { deletedAt: null } },
          },
        },
        subscription: {
          select: {
            status:          true,
            currentPeriodEnd: true,
            plan: { select: { name: true, type: true } },
          },
        },
      },
    });

    return tenants.map(t => ({
      id:           t.id,
      name:         t.name,
      slug:         t.slug,
      isActive:     t.isActive,
      createdAt:    t.createdAt,
      logoUrl:      t.logoUrl,
      primaryColor: t.primaryColor,
      userCount:    t._count.users,
      courseCount:  t._count.courses,
      childCount:   t._count.children,
      subscription: t.subscription
        ? {
            status:           t.subscription.status,
            planName:         t.subscription.plan.name,
            planType:         t.subscription.plan.type,
            currentPeriodEnd: t.subscription.currentPeriodEnd,
          }
        : null,
    }));
  }

  /**
   * Detalle completo de un tenant: stats + primeros 50 usuarios.
   *
   * Nota: Certificate no tiene relación directa en Tenant (solo tenantId como campo),
   * por lo que se cuenta en una query separada.
   */
  async getTenantDetail(tenantId: string): Promise<TenantDetail> {
    const [tenant, certificateCount] = await Promise.all([
      this.prisma.tenant.findFirst({
        where: { id: tenantId, deletedAt: null },
        select: {
          id:           true,
          name:         true,
          slug:         true,
          isActive:     true,
          createdAt:    true,
          logoUrl:      true,
          primaryColor: true,
          domain:       true,
          _count: {
            select: {
              users:       { where: { deletedAt: null } },
              courses:     { where: { deletedAt: null } },
              children:    { where: { deletedAt: null } },
              enrollments: true,
            },
          },
          subscription: {
            select: {
              status:           true,
              currentPeriodEnd: true,
              plan: { select: { name: true, type: true } },
            },
          },
          users: {
            where:   { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take:    50,
            select: {
              id:          true,
              firstName:   true,
              lastName:    true,
              email:       true,
              role:        true,
              isActive:    true,
              lastLoginAt: true,
              createdAt:   true,
            },
          },
        },
      }),
      this.prisma.certificate.count({ where: { tenantId } }),
    ]);

    if (!tenant) throw new NotFoundException('Tenant no encontrado.');

    return {
      id:               tenant.id,
      name:             tenant.name,
      slug:             tenant.slug,
      isActive:         tenant.isActive,
      createdAt:        tenant.createdAt,
      logoUrl:          tenant.logoUrl,
      primaryColor:     tenant.primaryColor,
      domain:           tenant.domain,
      userCount:        tenant._count.users,
      courseCount:      tenant._count.courses,
      childCount:       tenant._count.children,
      enrollmentCount:  tenant._count.enrollments,
      certificateCount,
      subscription: tenant.subscription
        ? {
            status:           tenant.subscription.status,
            planName:         tenant.subscription.plan.name,
            planType:         tenant.subscription.plan.type,
            currentPeriodEnd: tenant.subscription.currentPeriodEnd,
          }
        : null,
      users: tenant.users,
    };
  }

  /**
   * Suspende un tenant: isActive = false.
   * Los usuarios no podrán autenticarse hasta que se reactive.
   */
  async suspendTenant(tenantId: string) {
    const exists = await this.prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
    if (!exists) throw new NotFoundException('Tenant no encontrado.');

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data:  { isActive: false },
      select: { id: true, name: true, isActive: true },
    });
  }

  /**
   * Reactiva un tenant suspendido.
   */
  async activateTenant(tenantId: string) {
    const exists = await this.prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
    if (!exists) throw new NotFoundException('Tenant no encontrado.');

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data:  { isActive: true },
      select: { id: true, name: true, isActive: true },
    });
  }
}
