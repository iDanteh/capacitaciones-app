import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

/**
 * Payload embebido en el access token JWT.
 * Se mantiene mínimo — solo lo necesario para autorización por request.
 * Datos mutables (nombre, avatar) se consultan de DB cuando se necesitan.
 */
export interface JwtPayload {
  sub: string;       // userId
  email: string;
  tenantId: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Estrategia para access tokens de corta vida (15 minutos).
 *
 * Extrae el token del header Authorization: Bearer <token>.
 * Passport llama a `validate()` después de verificar la firma y la expiración.
 *
 * Si el token es inválido/expirado, Passport lanza 401 automáticamente
 * antes de que llegue a `validate()`.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.secret'),
    });
  }

  /**
   * Llamado después de que Passport valida la firma.
   * El valor retornado se asigna a `request.user`.
   *
   * En este punto el token ya es criptográficamente válido.
   * No consultamos DB aquí para mantener los requests rápidos —
   * si se necesita verificar que el usuario sigue activo, agregar
   * una capa de caché en Redis.
   */
  validate(payload: JwtPayload): JwtPayload {
    if (!payload.sub || !payload.tenantId) {
      throw new UnauthorizedException('Token malformado');
    }
    return payload;
  }
}
