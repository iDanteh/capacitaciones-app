import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * DTO para crear una sub-empresa.
 * Se crea un Tenant hijo + se invita a un OWNER para esa empresa.
 */
export class CreateSubcompanyDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la empresa es requerido' })
  @MaxLength(100)
  name: string;

  /**
   * Slug URL-friendly. Se genera automáticamente si no se envía,
   * pero se puede personalizar.
   * Restricción: solo letras minúsculas, números y guiones.
   */
  @IsString()
  @MinLength(3,  { message: 'El slug debe tener al menos 3 caracteres' })
  @MaxLength(60)
  @Matches(/^[a-z0-9-]+$/, { message: 'El slug solo puede contener letras minúsculas, números y guiones' })
  slug: string;

  /** Email del propietario de la sub-empresa (se le enviará una invitación). */
  @IsEmail({}, { message: 'Ingresa un email válido para el propietario' })
  @MaxLength(254)
  ownerEmail: string;

  /** Nombre del propietario */
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  ownerFirstName: string;

  /** Apellido del propietario */
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  ownerLastName: string;
}
