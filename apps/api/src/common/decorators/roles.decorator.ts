import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorador para restringir el acceso a roles específicos.
 * Requiere que `RolesGuard` esté activo en la ruta.
 *
 * @example
 * @Roles(UserRole.OWNER, UserRole.ADMIN)
 * @UseGuards(JwtAuthGuard, RolesGuard)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
