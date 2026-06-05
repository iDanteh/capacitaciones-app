import { IsString, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MfaVerifyDto {
  @ApiProperty({ description: 'JWT temporal emitido en el login cuando 2FA está activo' })
  @IsString()
  @IsNotEmpty()
  mfaToken: string;

  @ApiProperty({ description: 'Código TOTP de 6 dígitos o backup code de 8 caracteres' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 8, { message: 'El código debe tener entre 6 y 8 caracteres' })
  code: string;
}
