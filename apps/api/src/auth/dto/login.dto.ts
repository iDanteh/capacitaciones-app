import { IsEmail, IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO de login.
 *
 * Incluye tenantSlug porque el email es único por tenant, no globalmente.
 * Un mismo email puede existir en múltiples empresas.
 */
export class LoginDto {
  @ApiProperty({ example: 'acme-corp', description: 'Slug de la empresa' })
  @IsString()
  @IsNotEmpty()
  tenantSlug: string;

  @ApiProperty({ example: 'juan@acme.com' })
  @IsEmail({}, { message: 'El email no es válido' })
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'Password123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password: string;
}
