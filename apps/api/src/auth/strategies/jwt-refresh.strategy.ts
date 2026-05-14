import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

export interface JwtRefreshPayload {
  sub: string;
  tenantId: string;
  // El token raw se inyecta en validate() para poder buscar su hash en DB
  refreshToken?: string;
}

/**
 * Estrategia para refresh tokens de larga vida (7 días).
 *
 * Se diferencia de la estrategia de access en:
 *  1. Usa un secreto distinto (JWT_REFRESH_SECRET) — un access token comprometido
 *     no puede usarse como refresh token y viceversa.
 *  2. Inyecta el raw token en el payload para que AuthService pueda verificar
 *     su hash en DB (invalidación server-side).
 *  3. El token se envía en el body, no en el header (RefreshTokenDto).
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    super({
      // Extrae el refreshToken del body del request
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.refreshSecret'),
      // `passReqToCallback: true` permite acceder al request completo en validate()
      passReqToCallback: true,
    });
  }

  /**
   * `req.body.refreshToken` contiene el token raw.
   * Lo adjuntamos al payload para que AuthService pueda comparar su hash
   * contra lo almacenado en DB — esto permite invalidación server-side
   * (logout, rotación, revocación por sospecha).
   */
  validate(req: Request, payload: JwtRefreshPayload): JwtRefreshPayload {
    const refreshToken = req.body?.refreshToken as string | undefined;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token no encontrado');
    }
    return { ...payload, refreshToken };
  }
}
