import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Tenant } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { TenantResponseDto } from './dto/tenant-response.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { CreateSubcompanyDto } from './dto/create-subcompany.dto';

/**
 * Servicio de Tenants.
 *
 * Responsabilidades:
 *  - Resolver un tenant por slug (usado por TenantMiddleware).
 *  - Resolver un tenant por ID (usado por controllers autenticados).
 *  - Construir DTOs de respuesta pública.
 *
 * Nota de RLS: este servicio hace lookups DIRECTOS por PK/unique key,
 * por lo que no depende de que el contexto RLS esté activo.
 * TenantMiddleware activa RLS ANTES de que cualquier controller llame aquí.
 */
// Tipo de respuesta para sub-empresas
export interface SubcompanyResponse {
  id:        string;
  name:      string;
  slug:      string;
  isActive:  boolean;
  createdAt: Date;
  userCount: number;
}

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email:  EmailService,
  ) {}

  /**
   * Busca un tenant activo por slug.
   * Retorna null si no existe o está inactivo/eliminado.
   * Usado por TenantMiddleware para validar el header X-Tenant-Slug.
   */
  async findBySlug(slug: string): Promise<Tenant | null> {
    return this.prisma.tenant.findFirst({
      where: { slug, isActive: true, deletedAt: null },
    });
  }

  /**
   * Busca un tenant activo por ID.
   * Retorna null si no existe o está inactivo/eliminado.
   */
  async findById(id: string): Promise<Tenant | null> {
    return this.prisma.tenant.findFirst({
      where: { id, isActive: true, deletedAt: null },
    });
  }

  /**
   * Resuelve el branding público de un tenant a partir de su dominio personalizado.
   * Usado por el middleware de Next.js para inyectar el slug sin que el usuario lo escriba.
   * Retorna null si el dominio no está asociado a ningún tenant activo.
   */
  async getPublicBrandingByDomain(
    hostname: string,
  ): Promise<{ slug: string; name: string; logoUrl: string | null; primaryColor: string | null; appName: string | null } | null> {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        domain:    { equals: hostname.toLowerCase(), mode: 'insensitive' },
        isActive:  true,
        deletedAt: null,
      },
      select: { slug: true, name: true, logoUrl: true, primaryColor: true, appName: true } as any,
    }) as unknown as { slug: string; name: string; logoUrl: string | null; primaryColor: string | null; appName: string | null } | null;
    return tenant ?? null;
  }

  /**
   * Devuelve el branding público de un tenant por slug, sin autenticación.
   * Solo expone los tres campos necesarios para pre-cargar la UI de login.
   * Retorna null si el tenant no existe o está inactivo.
   */
  async getPublicBranding(slug: string): Promise<{ name: string; logoUrl: string | null; primaryColor: string | null; appName: string | null } | null> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug, isActive: true, deletedAt: null },
      select: { name: true, logoUrl: true, primaryColor: true, appName: true } as any,
    }) as unknown as { name: string; logoUrl: string | null; primaryColor: string | null; appName: string | null } | null;
    return tenant ?? null;
  }

  /**
   * Devuelve el DTO público del tenant del usuario autenticado.
   * Lanza NotFoundException si el tenant no existe (no debería ocurrir
   * en condiciones normales si el JWT es válido).
   */
  async getMyTenant(tenantId: string): Promise<TenantResponseDto> {
    const tenant = await this.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant no encontrado.');
    }
    return TenantResponseDto.from(tenant);
  }

  /**
   * Actualiza los datos de personalización del tenant.
   * El dominio personalizado solo está disponible en plan Enterprise.
   */
  async updateMyTenant(tenantId: string, dto: UpdateTenantDto): Promise<TenantResponseDto> {
    const tenant = await this.findById(tenantId);
    if (!tenant) throw new NotFoundException('Tenant no encontrado.');

    // Campos que requieren plan Enterprise: domain y appName
    const needsEnterprise = dto.domain !== undefined || dto.appName !== undefined;
    if (needsEnterprise) {
      const subscription = await this.prisma.subscription.findUnique({
        where: { tenantId },
        include: { plan: true },
      });
      if (dto.domain !== undefined && (!subscription || subscription.plan.type !== 'ENTERPRISE')) {
        throw new ForbiddenException('El dominio personalizado requiere el plan Enterprise.');
      }
      if (dto.appName !== undefined && (!subscription || !subscription.plan.hasWhiteLabel)) {
        throw new ForbiddenException('El nombre de plataforma personalizado requiere un plan con white-label.');
      }
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.name             ? { name:         dto.name.trim() }          : {}),
        ...(dto.logoUrl      !== undefined ? { logoUrl:      dto.logoUrl || null }      : {}),
        ...(dto.primaryColor !== undefined ? { primaryColor: dto.primaryColor || null } : {}),
        ...(dto.domain       !== undefined ? { domain:       dto.domain || null }       : {}),
        ...(dto.appName      !== undefined ? { appName:      dto.appName.trim() || null } : {}),
      },
    });

    return TenantResponseDto.from(updated);
  }

  // ── Sub-empresas ───────────────────────────────────────────────────────────

  /**
   * Lista todas las sub-empresas activas del tenant padre.
   */
  async listSubcompanies(parentTenantId: string): Promise<SubcompanyResponse[]> {
    const children = await this.prisma.tenant.findMany({
      where:   { parentTenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select:  {
        id: true, name: true, slug: true, isActive: true, createdAt: true,
        _count: { select: { users: { where: { deletedAt: null } } } },
      },
    });

    return children.map(c => ({
      id:        c.id,
      name:      c.name,
      slug:      c.slug,
      isActive:  c.isActive,
      createdAt: c.createdAt,
      userCount: c._count.users,
    }));
  }

  /**
   * Crea una sub-empresa e invita a su propietario.
   * Verifica límite maxCompanies del plan del tenant padre.
   */
  async createSubcompany(
    parentTenantId: string,
    inviterId:      string,
    dto:            CreateSubcompanyDto,
  ): Promise<SubcompanyResponse> {
    // Verificar que el padre no es ya una sub-empresa (sin anidación multinivel)
    const parentTenant = await this.prisma.tenant.findUnique({
      where:  { id: parentTenantId },
      select: { parentTenantId: true },
    });
    if (parentTenant?.parentTenantId) {
      throw new ForbiddenException('Las sub-empresas no pueden crear sub-empresas.');
    }

    // Verificar que el plan permite sub-empresas
    const subscription = await this.prisma.subscription.findUnique({
      where:   { tenantId: parentTenantId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new ForbiddenException('No se encontró una suscripción activa.');
    }

    const maxCompanies = subscription.plan.maxCompanies;

    if (maxCompanies === 0) {
      throw new ForbiddenException(
        'Tu plan no incluye sub-empresas. Actualiza al plan Business o Enterprise.',
      );
    }

    if (maxCompanies !== -1) {
      const currentCount = await this.prisma.tenant.count({
        where: { parentTenantId, deletedAt: null },
      });
      if (currentCount >= maxCompanies) {
        throw new ForbiddenException(
          `Tu plan permite máximo ${maxCompanies} sub-empresa${maxCompanies !== 1 ? 's' : ''}. Actualiza tu plan para agregar más.`,
        );
      }
    }

    // Verificar slug único
    const slugExists = await this.prisma.tenant.findUnique({ where: { slug: dto.slug } });
    if (slugExists) throw new ConflictException('Ya existe una empresa con ese slug. Elige otro.');

    // Crear sub-empresa
    const child = await this.prisma.tenant.create({
      data: {
        name:           dto.name.trim(),
        slug:           dto.slug,
        parentTenantId,
      },
    });

    // Si se proporcionaron datos del propietario externo → enviar invitación
    if (dto.ownerEmail) {
      const [inviter, parentTenant] = await Promise.all([
        this.prisma.user.findUniqueOrThrow({ where: { id: inviterId } }),
        this.prisma.tenant.findUniqueOrThrow({ where: { id: parentTenantId } }),
      ]);

      const rawToken     = crypto.randomBytes(32).toString('hex');
      const tokenHash    = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt    = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const normalizedEmail = dto.ownerEmail.toLowerCase().trim();

      await this.prisma.userInvite.create({
        data: {
          tenantId:    child.id,
          email:       normalizedEmail,
          firstName:   (dto.ownerFirstName ?? '').trim(),
          lastName:    (dto.ownerLastName  ?? '').trim(),
          role:        'OWNER',
          tokenHash,
          invitedById: inviterId,
          expiresAt,
        },
      });

      // Email (fallo silencioso)
      // Fire-and-forget — sendInvite ya maneja reintentos y errores internamente
      this.email.sendInvite({
        to:          dto.ownerEmail,
        inviterName: `${inviter.firstName} ${inviter.lastName}`,
        companyName: `${dto.name} (sub-empresa de ${parentTenant.name})`,
        role:        'OWNER',
        token:       rawToken,
        branding: {
          name:         parentTenant.name,
          logoUrl:      (parentTenant as any).logoUrl      ?? null,
          primaryColor: (parentTenant as any).primaryColor ?? null,
          appName:      (parentTenant as any).appName      ?? null,
        },
      });
    }

    this.logger.log(`Sub-empresa "${child.name}" creada por ${inviterId}`);

    return {
      id:        child.id,
      name:      child.name,
      slug:      child.slug,
      isActive:  child.isActive,
      createdAt: child.createdAt,
      userCount: 0,
    };
  }

  /**
   * Elimina (soft delete) una sub-empresa del tenant padre.
   * Solo el OWNER del tenant padre puede hacer esto.
   */
  async deleteSubcompany(parentTenantId: string, childId: string): Promise<void> {
    const child = await this.prisma.tenant.findFirst({
      where: { id: childId, parentTenantId, deletedAt: null },
    });
    if (!child) throw new NotFoundException('Sub-empresa no encontrada.');

    await this.prisma.tenant.update({
      where: { id: childId },
      data:  { deletedAt: new Date(), isActive: false },
    });

    this.logger.log(`Sub-empresa ${childId} eliminada por tenant ${parentTenantId}`);
  }

  /**
   * Retorna la "familia" de tenants visible para el dropdown del sidebar.
   * - Si el tenant actual es padre → devuelve sus sub-empresas hijas.
   * - Si el tenant actual es sub-empresa → devuelve sus hermanas (hijas del padre) + info del padre.
   * Esto garantiza que el dropdown siempre muestre datos frescos sin depender del caché local.
   */
  async getFamilyTenants(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where:  { id: tenantId },
      select: { parentTenantId: true },
    });
    if (!tenant) throw new NotFoundException('Tenant no encontrado.');

    const isSubcompany = !!tenant.parentTenantId;
    const rootId       = tenant.parentTenantId ?? tenantId;

    const [siblings, parentTenant] = await Promise.all([
      this.prisma.tenant.findMany({
        where:   { parentTenantId: rootId, deletedAt: null, isActive: true },
        select:  { id: true, name: true, slug: true, isActive: true },
        orderBy: { createdAt: 'asc' },
      }),
      isSubcompany
        ? this.prisma.tenant.findUnique({ where: { id: rootId }, select: { id: true, name: true } })
        : null,
    ]);

    return {
      isSubcompany,
      parent:       parentTenant ?? null,
      subcompanies: siblings,
    };
  }
}
