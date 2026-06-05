import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard de roles — complementa JwtAuthGuard.
 *
 * Lee los roles permitidos del decorador @Roles() y verifica que
 * el usuario autenticado (inyectado por JwtStrategy) tenga uno de ellos.
 *
 * Debe usarse DESPUÉS de JwtAuthGuard para que request.user exista.
 *
 * @example
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles(UserRole.OWNER, UserRole.ADMIN)
 * findAll() {}
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Sin @Roles() → ruta abierta a cualquier usuario autenticado
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: { role: UserRole } }>();

    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('No tienes permisos para realizar esta acción');
    }

    return true;
  }
}
