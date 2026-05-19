import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { PlanType } from '@prisma/client';

export class CreateCheckoutDto {
  @ApiProperty({ enum: PlanType, description: 'Plan al que se quiere migrar (solo BUSINESS o ENTERPRISE)' })
  @IsEnum(PlanType)
  planType: PlanType;
}
