import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AddStoragePackDto {
  @ApiProperty({ description: 'ID del StoragePack a agregar' })
  @IsString()
  packId: string;
}
