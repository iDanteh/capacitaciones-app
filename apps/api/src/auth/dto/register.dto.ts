import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para el registro de un nuevo tenant + usuario OWNER.
 *
 * El slug del tenant se deriva del nombre de la empresa en el servicio
 * (slugify) para garantizar consistencia — no se pide al usuario.
 *
 * Validaciones de contraseña:
 *  - Mínimo 8 caracteres
 *  - Al menos una mayúscula, una minúscula y un número
 *  → Suficiente para MVP; agregar 2FA en fases posteriores
 */
export class RegisterDto {
  // ── Datos de la empresa (nuevo tenant) ────────────────────────────────────

  @ApiProperty({ example: 'Acme Corp', description: 'Nombre de la empresa' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  companyName: string;

  // ── Datos del usuario OWNER ────────────────────────────────────────────────

  @ApiProperty({ example: 'Juan', description: 'Nombre del administrador' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstName: string;

  @ApiProperty({ example: 'Pérez', description: 'Apellido del administrador' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  lastName: string;

  @ApiProperty({ example: 'juan@acme.com' })
  @IsEmail({}, { message: 'El email no es válido' })
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'Password123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72) // límite de bcrypt
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'La contraseña debe tener al menos una mayúscula, una minúscula y un número',
  })
  password: string;
}
