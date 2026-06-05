import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionStatus } from '@prisma/client';
import type { Subscription, Plan, SubscriptionStoragePack, StoragePack } from '@prisma/client';
import { PlanResponseDto } from './plan-response.dto';
import { StoragePackResponseDto } from './storage-pack-response.dto';

type ActivePack = SubscriptionStoragePack & { storagePack: StoragePack };

export class ActiveStoragePackDto extends StoragePackResponseDto {
  @ApiProperty() quantity: number;

  static fromActive(item: ActivePack): ActiveStoragePackDto {
    const dto      = new ActiveStoragePackDto();
    dto.id         = item.storagePack.id;
    dto.name       = item.storagePack.name;
    dto.storageGb  = item.storagePack.storageGb;
    dto.priceUsd   = Number(item.storagePack.priceUsd);
    dto.quantity   = item.quantity;
    return dto;
  }
}

export class SubscriptionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: SubscriptionStatus }) status: SubscriptionStatus;
  @ApiProperty() currentPeriodStart: Date;
  @ApiProperty() currentPeriodEnd: Date;
  @ApiProperty() cancelAtPeriodEnd: boolean;
  @ApiProperty({ nullable: true }) trialEndsAt: Date | null;
  @ApiProperty() plan: PlanResponseDto;
  @ApiProperty({ type: [ActiveStoragePackDto] }) storagePacks: ActiveStoragePackDto[];
  /** Suma del storage base del plan más todos los add-ons activos. -1 = ilimitado. */
  @ApiProperty() totalStorageGb: number;

  static from(
    sub: Subscription & { plan: Plan; storagePacks: ActivePack[] },
  ): SubscriptionResponseDto {
    const dto               = new SubscriptionResponseDto();
    dto.id                  = sub.id;
    dto.status              = sub.status;
    dto.currentPeriodStart  = sub.currentPeriodStart;
    dto.currentPeriodEnd    = sub.currentPeriodEnd;
    dto.cancelAtPeriodEnd   = sub.cancelAtPeriodEnd;
    dto.trialEndsAt         = sub.trialEndsAt;
    dto.plan                = PlanResponseDto.from(sub.plan);
    dto.storagePacks        = sub.storagePacks.map(ActiveStoragePackDto.fromActive);

    // -1 (ilimitado) en el plan base → el total siempre es -1
    if (sub.plan.maxStorageGb === -1) {
      dto.totalStorageGb = -1;
    } else {
      const addOnGb      = sub.storagePacks.reduce(
        (sum, item) => sum + item.storagePack.storageGb * item.quantity,
        0,
      );
      dto.totalStorageGb = sub.plan.maxStorageGb + addOnGb;
    }

    return dto;
  }
}
