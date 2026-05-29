import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Tenant } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TenantResponseDto } from './dto/tenant-response.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

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
@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

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

    // Si se intenta actualizar el dominio, verificar que el plan sea Enterprise
    if (dto.domain !== undefined) {
      const subscription = await this.prisma.subscription.findUnique({
        where: { tenantId },
        include: { plan: true },
      });
      if (!subscription || subscription.plan.type !== 'ENTERPRISE') {
        throw new ForbiddenException('El dominio personalizado requiere el plan Enterprise.');
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.name)                    data.name         = dto.name.trim();
    if (dto.logoUrl !== undefined)   data.logoUrl       = dto.logoUrl || null;
    if (dto.primaryColor !== undefined) data.primaryColor = dto.primaryColor || null;
    if (dto.domain !== undefined)    data.domain        = dto.domain || null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: data as any, // cast necesario hasta que el cliente Prisma regenere con primaryColor
    });

    return TenantResponseDto.from(updated);
  }
}
