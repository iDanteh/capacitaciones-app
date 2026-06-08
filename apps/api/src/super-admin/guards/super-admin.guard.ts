import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { JwtPayload } from '../../auth/strategies/jwt.strategy';

/**
 * SuperAdminGuard — verifica que el usuario autenticado tenga el rol SUPER_ADMIN.
 *
 * Debe usarse DESPUÉS de JwtAuthGuard para que req.user esté disponible.
 * A diferencia de RolesGuard, este guard no depende del decorator @Roles()
 * y lanza ForbiddenException con un mensaje explícito.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user: JwtPayload }>();
    if (req.user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Acceso exclusivo para Super Admin.');
    }
    return true;
  }
}
