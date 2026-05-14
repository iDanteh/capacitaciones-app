import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard para rutas protegidas con access token.
 *
 * Uso:
 *   @UseGuards(JwtAuthGuard)
 *
 * Si el token es inválido/ausente, Passport lanza UnauthorizedException
 * antes de que el controller procese la request.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
