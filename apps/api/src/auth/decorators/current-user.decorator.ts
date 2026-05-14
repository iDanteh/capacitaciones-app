import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extrae el payload del JWT ya validado desde el request.
 * Passport coloca el resultado de `validate()` en `request.user`.
 *
 * Uso:
 *   @Get('profile')
 *   @UseGuards(JwtAuthGuard)
 *   getProfile(@CurrentUser() user: JwtPayload) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
