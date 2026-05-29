import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';

/**
 * Módulo de autenticación.
 *
 * No configura JwtModule con un secreto fijo — cada signAsync() recibe
 * su propio secreto dinámicamente (access vs. refresh).
 * `signOptions` vacío aquí evita que un secreto mal configurado
 * afecte silenciosamente ambas estrategias.
 */
@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
  ],
  providers: [
    AuthService,
    MfaService,
    JwtStrategy,
    JwtRefreshStrategy,
  ],
  controllers: [AuthController],
  exports: [
    // JwtAuthGuard y JwtStrategy se exportan implícitamente al registrar PassportModule.
    // AuthService se exporta por si otros módulos necesitan validar tokens internamente.
    AuthService,
  ],
})
export class AuthModule {}
