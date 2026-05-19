import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Tenant } from '@prisma/client';

/**
 * Extrae el tenant activo del request, inyectado previamente por TenantMiddleware.
 *
 * Uso:
 *   @Get('example')
 *   @UseGuards(JwtAuthGuard)
 *   example(@CurrentTenant() tenant: Tenant) { ... }
 *
 * Retorna `undefined` si la ruta no pasó por el middleware (p. ej. rutas públicas).
 * Para rutas que requieren tenant obligatorio, combinar con un guard adicional
 * o validar en el handler.
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Tenant | undefined => {
    const request = ctx.switchToHttp().getRequest<{ tenant?: Tenant }>();
    return request.tenant;
  },
);
