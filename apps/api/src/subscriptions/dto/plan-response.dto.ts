import { ApiProperty } from '@nestjs/swagger';
import { PlanType } from '@prisma/client';
import type { Plan } from '@prisma/client';

export class PlanResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: PlanType }) type: PlanType;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty() priceUsd: number;
  @ApiProperty({ description: '-1 = ilimitado' }) maxEmployees: number;
  @ApiProperty({ description: '-1 = ilimitado' }) maxCompanies: number;
  @ApiProperty({ description: '-1 = ilimitado' }) maxStorageGb: number;
  @ApiProperty() hasEvaluations: boolean;
  @ApiProperty() hasCertificates: boolean;
  @ApiProperty() hasAnalytics: boolean;
  @ApiProperty() hasWhiteLabel: boolean;
  @ApiProperty() hasApi: boolean;
  @ApiProperty({ nullable: true }) stripePriceId: string | null;

  static from(plan: Plan): PlanResponseDto {
    const dto = new PlanResponseDto();
    dto.id              = plan.id;
    dto.type            = plan.type;
    dto.name            = plan.name;
    dto.description     = plan.description;
    dto.priceUsd        = Number(plan.priceUsd);
    dto.maxEmployees    = plan.maxEmployees;
    dto.maxCompanies    = plan.maxCompanies;
    dto.maxStorageGb    = plan.maxStorageGb;
    dto.hasEvaluations  = plan.hasEvaluations;
    dto.hasCertificates = plan.hasCertificates;
    dto.hasAnalytics    = plan.hasAnalytics;
    dto.hasWhiteLabel   = plan.hasWhiteLabel;
    dto.hasApi          = plan.hasApi;
    dto.stripePriceId   = plan.stripePriceId;
    return dto;
  }
}
