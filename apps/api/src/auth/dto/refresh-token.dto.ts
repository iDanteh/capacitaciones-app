import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token emitido en login o refresh anterior' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
