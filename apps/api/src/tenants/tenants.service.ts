import { Injectable, NotFoundException } from '@nestjs/common';
import { Tenant } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TenantResponseDto } from './dto/tenant-response.dto';

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
}
