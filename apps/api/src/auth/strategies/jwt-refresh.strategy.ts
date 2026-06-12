import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

export interface JwtRefreshPayload {
  sub: string;
  tenantId: string;
  refreshToken?: string;
}

const RT_COOKIE = '__rt';

/**
 * Estrategia para refresh tokens de larga vida (7 días).
 *
 * El refresh token viaja en la cookie httpOnly `__rt`, no en el body.
 * Esto impide que XSS pueda leerlo desde JS.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => (req?.cookies as Record<string, string>)?.[RT_COOKIE] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.refreshSecret'),
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtRefreshPayload): JwtRefreshPayload {
    const refreshToken = (req?.cookies as Record<string, string>)?.[RT_COOKIE];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token no encontrado');
    }
    return { ...payload, refreshToken };
  }
}
