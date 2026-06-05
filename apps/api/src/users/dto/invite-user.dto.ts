import { IsEmail, IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { UserRole } from '@prisma/client';

/** Roles que se pueden asignar al invitar — excluye OWNER y SUPER_ADMIN. */
const INVITABLE_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE];

export class InviteUserDto {
  @IsEmail({}, { message: 'Ingresa un email válido' })
  @MaxLength(254)
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MaxLength(50)
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'El apellido es requerido' })
  @MaxLength(50)
  lastName: string;

  @IsIn(INVITABLE_ROLES, { message: 'Rol inválido. Valores permitidos: ADMIN, MANAGER, EMPLOYEE' })
  role: UserRole;
}
