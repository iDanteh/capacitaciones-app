import { ApiProperty } from '@nestjs/swagger';
import type { StoragePack } from '@prisma/client';

export class StoragePackResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() storageGb: number;
  @ApiProperty() priceUsd: number;

  static from(pack: StoragePack): StoragePackResponseDto {
    const dto    = new StoragePackResponseDto();
    dto.id        = pack.id;
    dto.name      = pack.name;
    dto.storageGb = pack.storageGb;
    dto.priceUsd  = Number(pack.priceUsd);
    return dto;
  }
}
