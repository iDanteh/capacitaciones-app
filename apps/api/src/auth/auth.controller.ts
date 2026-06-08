import {
  Controller,
  Post,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';
import { MfaConfirmDto } from './dto/mfa-confirm.dto';
import { MfaDisableDto } from './dto/mfa-disable.dto';
import { SwitchTenantDto } from './dto/switch-tenant.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtPayload } from './strategies/jwt.strategy';
import { JwtRefreshPayload } from './strategies/jwt-refresh.strategy';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.types';

/**
 * Controller de autenticación.
 *
 * Rutas públicas (sin guard):
 *   POST /auth/register   — Crear cuenta nueva (empresa + OWNER)
 *   POST /auth/login      — Iniciar sesión
 *   POST /auth/refresh    — Rotar tokens (requiere refresh token válido en body)
 *
 * Rutas protegidas:
 *   POST /auth/logout     — Revocar refresh token activo
 *   GET  /auth/me         — Datos del usuario autenticado
 *
 * El versionado lo maneja el prefijo global 'api/v1' definido en main.ts.
 */
@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService:  MfaService,
    private readonly audit:       AuditService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar nueva empresa y usuario OWNER' })
  @ApiResponse({ status: 201, description: 'Empresa creada. Retorna tokens + usuario.' })
  @ApiResponse({ status: 409, description: 'El nombre de empresa ya está en uso.' })
  @ApiResponse({ status: 422, description: 'Datos de registro inválidos.' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, description: 'Login exitoso. Retorna tokens + usuario.' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas.' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar access token usando refresh token' })
  @ApiResponse({ status: 200, description: 'Nuevo par de tokens emitido.' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido o expirado.' })
  refresh(
    @CurrentUser() payload: JwtRefreshPayload,
    @Body() _dto: RefreshTokenDto, // validado por el guard; @Body aquí activa class-validator
  ) {
    return this.authService.refresh(payload);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar sesión (revoca el refresh token)' })
  @ApiResponse({ status: 204, description: 'Sesión cerrada.' })
  logout(@CurrentUser() user: JwtPayload, @Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken, user.sub, user.tenantId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Datos del usuario autenticado (desde el token)' })
  @ApiResponse({ status: 200, description: 'Payload del JWT.' })
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }

  // ── Switch tenant ──────────────────────────────────────────────────────────

  @Post('switch-tenant')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambiar contexto a una sub-empresa (solo OWNER)' })
  @ApiResponse({ status: 200, description: 'Contexto cambiado. Retorna nuevos tokens + usuario de la sub-empresa.' })
  @ApiResponse({ status: 403, description: 'No tienes acceso a esta empresa o no es una sub-empresa tuya.' })
  switchTenant(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SwitchTenantDto,
  ) {
    return this.authService.switchTenant(user.sub, user.tenantId, dto.childTenantId);
  }

  // ── 2FA / MFA ──────────────────────────────────────────────────────────────

  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 15 * 60_000, limit: 5 } }) // 5 intentos / 15 min
  @ApiOperation({ summary: 'Completar login con código TOTP o backup code' })
  @ApiResponse({ status: 200, description: 'Login completado. Retorna tokens + usuario.' })
  @ApiResponse({ status: 401, description: 'Código o token MFA inválido.' })
  mfaVerify(@Body() dto: MfaVerifyDto) {
    return this.authService.verifyMfa(dto.mfaToken, dto.code);
  }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60 * 60_000, limit: 3 } }) // 3 intentos / hora
  @ApiOperation({ summary: 'Iniciar configuración de 2FA — retorna QR y secret' })
  @ApiResponse({ status: 201, description: 'QR generado. Escanea y luego confirma con /mfa/confirm.' })
  mfaSetup(@CurrentUser() user: JwtPayload) {
    this.audit.log({ action: AuditAction.MFA_SETUP, userId: user.sub, tenantId: user.tenantId });
    return this.mfaService.setup(user.sub);
  }

  @Post('mfa/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 15 * 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Confirmar 2FA con primer código TOTP — activa el 2FA y retorna backup codes' })
  @ApiResponse({ status: 201, description: '2FA activado. Guarda los backup codes en un lugar seguro.' })
  mfaConfirm(@CurrentUser() user: JwtPayload, @Body() dto: MfaConfirmDto) {
    this.audit.log({ action: AuditAction.MFA_CONFIRMED, userId: user.sub, tenantId: user.tenantId });
    return this.mfaService.confirm(user.sub, dto.code);
  }

  @Delete('mfa')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { ttl: 15 * 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Desactivar 2FA (requiere código TOTP o backup code)' })
  @ApiResponse({ status: 204, description: '2FA desactivado.' })
  mfaDisable(@CurrentUser() user: JwtPayload, @Body() dto: MfaDisableDto) {
    this.audit.log({ action: AuditAction.MFA_DISABLED, userId: user.sub, tenantId: user.tenantId });
    return this.mfaService.disable(user.sub, dto.code);
  }
}
