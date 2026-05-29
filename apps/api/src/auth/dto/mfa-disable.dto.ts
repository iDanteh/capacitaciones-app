import { IsString, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MfaDisableDto {
  @ApiProperty({ description: 'Código TOTP de 6 dígitos o backup code (para confirmar la desactivación)' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 8, { message: 'El código debe tener entre 6 y 8 caracteres' })
  code: string;
}
