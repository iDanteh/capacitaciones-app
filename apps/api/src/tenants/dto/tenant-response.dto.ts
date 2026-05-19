import { ApiProperty } from '@nestjs/swagger';
import { Tenant } from '@prisma/client';

/**
 * Shape de respuesta pública de un Tenant.
 * Excluye campos internos (deletedAt, etc.) que no deben exponerse al cliente.
 *
 * Patrón: DTO de salida con factory method estático `from()`.
 * Esto desacopla la representación HTTP del modelo de Prisma — si el schema
 * cambia, solo ajustamos aquí, no en cada controller.
 */
export class TenantResponseDto {
  @ApiProperty({ description: 'ID único del tenant' })
  id: string;

  @ApiProperty({ description: 'Nombre de la empresa' })
  name: string;

  @ApiProperty({ description: 'Slug URL-friendly. Ej: acme-corp' })
  slug: string;

  @ApiProperty({ description: 'Dominio personalizado (solo Enterprise)', required: false, nullable: true })
  domain: string | null;

  @ApiProperty({ description: 'URL del logo', required: false, nullable: true })
  logoUrl: string | null;

  @ApiProperty({ description: 'Si el tenant está activo' })
  isActive: boolean;

  @ApiProperty({ description: 'Fecha de creación' })
  createdAt: Date;

  static from(tenant: Tenant): TenantResponseDto {
    const dto = new TenantResponseDto();
    dto.id        = tenant.id;
    dto.name      = tenant.name;
    dto.slug      = tenant.slug;
    dto.domain    = tenant.domain ?? null;
    dto.logoUrl   = tenant.logoUrl ?? null;
    dto.isActive  = tenant.isActive;
    dto.createdAt = tenant.createdAt;
    return dto;
  }
}
