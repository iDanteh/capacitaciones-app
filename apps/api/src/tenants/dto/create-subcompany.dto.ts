import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * DTO para crear una sub-empresa.
 *
 * Los campos de propietario son opcionales:
 *  - Si se proporcionan → se crea un UserInvite y se envía email de invitación.
 *  - Si no se proporcionan → el OWNER padre puede acceder directamente mediante
 *    el endpoint POST /auth/switch-tenant (se crea un usuario espejo automáticamente).
 */
export class CreateSubcompanyDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la empresa es requerido' })
  @MaxLength(100)
  name: string;

  /**
   * Slug URL-friendly.
   * Restricción: solo letras minúsculas, números y guiones.
   */
  @IsString()
  @MinLength(3,  { message: 'El slug debe tener al menos 3 caracteres' })
  @MaxLength(60)
  @Matches(/^[a-z0-9-]+$/, { message: 'El slug solo puede contener letras minúsculas, números y guiones' })
  slug: string;

  /** Email del propietario externo (opcional — se le enviará invitación si se proporciona). */
  @IsOptional()
  @IsEmail({}, { message: 'Ingresa un email válido para el propietario' })
  @MaxLength(254)
  ownerEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  ownerFirstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  ownerLastName?: string;
}
