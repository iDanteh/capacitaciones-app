import { IsEmail, IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'acme-corp', description: 'Slug de la empresa' })
  @IsString()
  @IsNotEmpty()
  tenantSlug: string;

  @ApiProperty({ example: 'juan@acme.com' })
  @IsEmail({}, { message: 'El email no es válido' })
  @MaxLength(254)
  email: string;
}
