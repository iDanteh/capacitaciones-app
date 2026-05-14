import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard para el endpoint de refresh de tokens.
 * Usa la estrategia 'jwt-refresh' que valida con JWT_REFRESH_SECRET
 * y extrae el token del body.
 */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
