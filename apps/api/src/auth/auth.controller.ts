import {
  Controller,
  Post,
  Delete,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';
import { MfaConfirmDto } from './dto/mfa-confirm.dto';
import { MfaDisableDto } from './dto/mfa-disable.dto';
import { SwitchTenantDto } from './dto/switch-tenant.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtPayload } from './strategies/jwt.strategy';
import { JwtRefreshPayload } from './strategies/jwt-refresh.strategy';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.types';
import { Public } from './decorators/public.decorator';

const RT_COOKIE        = '__rt';
const PARENT_RT_COOKIE = '__parent_rt';
const SESSION_HINT     = '__auth';            // Cookie sin valor sensible en path '/' — solo para el middleware
const COOKIE_MAX_AGE   = 7 * 24 * 60 * 60 * 1000; // 7 días en ms

/**
 * Controller de autenticación.
 *
 * El refresh token viaja en cookies httpOnly (`__rt`), no en el body.
 * El access token se devuelve en el body y el cliente lo guarda en memoria.
 *
 * Rutas públicas:
 *   POST /auth/register        — Crear cuenta nueva
 *   POST /auth/login           — Iniciar sesión
 *   POST /auth/refresh         — Rotar tokens (cookie __rt)
 *   POST /auth/restore-parent  — Restaurar sesión padre tras switch-tenant
 *   POST /auth/mfa/verify      — Completar login con 2FA
 *
 * Rutas protegidas (requieren access token):
 *   POST   /auth/logout        — Revocar refresh token + limpiar cookie
 *   GET    /auth/me            — Datos del usuario autenticado
 *   POST   /auth/switch-tenant — Cambiar contexto a sub-empresa
 *   POST   /auth/mfa/setup     — Iniciar configuración de 2FA
 *   POST   /auth/mfa/confirm   — Confirmar 2FA
 *   DELETE /auth/mfa           — Desactivar 2FA
 */
@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService:  MfaService,
    private readonly audit:       AuditService,
  ) {}

  // ── Cookie helpers ─────────────────────────────────────────────────────────

  private cookieOptions(path = '/api/v1/auth') {
    return {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge:   COOKIE_MAX_AGE,
      path,
    };
  }

  private setRtCookie(res: Response, token: string): void {
    res.cookie(RT_COOKIE, token, this.cookieOptions());
  }

  private clearRtCookie(res: Response): void {
    res.clearCookie(RT_COOKIE, { path: '/api/v1/auth' });
  }

  private setSessionHintCookie(res: Response): void {
    res.cookie(SESSION_HINT, '1', {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge:   COOKIE_MAX_AGE,
      path:     '/',
    });
  }

  private clearSessionHintCookie(res: Response): void {
    res.clearCookie(SESSION_HINT, { path: '/' });
  }

  private setParentRtCookie(res: Response, token: string): void {
    res.cookie(PARENT_RT_COOKIE, token, this.cookieOptions());
  }

  private clearParentRtCookie(res: Response): void {
    res.clearCookie(PARENT_RT_COOKIE, { path: '/api/v1/auth' });
  }

  private getRtFromCookie(req: Request): string | undefined {
    return (req.cookies as Record<string, string>)?.[RT_COOKIE];
  }

  private getParentRtFromCookie(req: Request): string | undefined {
    return (req.cookies as Record<string, string>)?.[PARENT_RT_COOKIE];
  }

  // ── Register ───────────────────────────────────────────────────────────────

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar nueva empresa y usuario OWNER' })
  @ApiResponse({ status: 201, description: 'Empresa creada. Retorna accessToken + usuario.' })
  @ApiResponse({ status: 409, description: 'El nombre de empresa ya está en uso.' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);
    this.setRtCookie(res, result.refreshToken);
    this.setSessionHintCookie(res);
    const { refreshToken: _, ...safe } = result;
    return safe;
  }

  // ── Login ──────────────────────────────────────────────────────────────────

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, description: 'Login exitoso. Retorna accessToken + usuario (o challenge MFA).' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas.' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    if ('mfaPending' in result) return result; // MFA challenge — sin tokens todavía
    this.setRtCookie(res, result.refreshToken);
    this.setSessionHintCookie(res);
    const { refreshToken: _, ...safe } = result;
    return safe;
  }

  // ── Refresh ────────────────────────────────────────────────────────────────

  @Post('refresh')
  @Public()
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar access token (refresh token en cookie __rt)' })
  @ApiResponse({ status: 200, description: 'Nuevo accessToken emitido.' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido o expirado.' })
  async refresh(
    @CurrentUser() payload: JwtRefreshPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.refresh(payload);
    this.setRtCookie(res, tokens.refreshToken);
    this.setSessionHintCookie(res);
    return { accessToken: tokens.accessToken };
  }

  // ── Logout ─────────────────────────────────────────────────────────────────

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar sesión (revoca refresh token y limpia cookie)' })
  @ApiResponse({ status: 204, description: 'Sesión cerrada.' })
  async logout(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = this.getRtFromCookie(req);
    this.clearRtCookie(res);
    this.clearParentRtCookie(res);
    this.clearSessionHintCookie(res);
    if (refreshToken) {
      await this.authService.logout(refreshToken, user.sub, user.tenantId);
    }
  }

  // ── Me ─────────────────────────────────────────────────────────────────────

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
  @ApiOperation({ summary: 'Cambiar contexto a sub-empresa (solo OWNER)' })
  @ApiResponse({ status: 200, description: 'Contexto cambiado. Retorna accessToken + usuario.' })
  @ApiResponse({ status: 403, description: 'No tienes acceso a esta empresa.' })
  async switchTenant(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SwitchTenantDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parentRefreshToken = this.getRtFromCookie(req);

    const result = await this.authService.switchTenant(user.sub, user.tenantId, dto.childTenantId);

    // Guardar el RT del padre en cookie separada antes de sobrescribir __rt
    if (parentRefreshToken) {
      this.setParentRtCookie(res, parentRefreshToken);
    }

    this.setRtCookie(res, result.refreshToken);
    this.setSessionHintCookie(res);
    const { refreshToken: _, ...safe } = result;
    return safe;
  }

  // ── Restore parent ─────────────────────────────────────────────────────────

  @Post('restore-parent')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restaurar sesión padre tras switch-tenant (cookie __parent_rt)' })
  @ApiResponse({ status: 200, description: 'Sesión padre restaurada. Retorna accessToken.' })
  @ApiResponse({ status: 401, description: 'No hay sesión padre activa o expiró.' })
  async restoreParent(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parentRefreshToken = this.getParentRtFromCookie(req);
    if (!parentRefreshToken) {
      throw new UnauthorizedException('No hay sesión padre activa.');
    }

    const tokens = await this.authService.restoreParent(parentRefreshToken);

    this.setRtCookie(res, tokens.refreshToken);
    this.clearParentRtCookie(res);
    this.setSessionHintCookie(res);

    return { accessToken: tokens.accessToken };
  }

  // ── 2FA / MFA ──────────────────────────────────────────────────────────────

  @Post('mfa/verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 15 * 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Completar login con código TOTP o backup code' })
  @ApiResponse({ status: 200, description: 'Login completado. Retorna accessToken + usuario.' })
  @ApiResponse({ status: 401, description: 'Código o token MFA inválido.' })
  async mfaVerify(
    @Body() dto: MfaVerifyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyMfa(dto.mfaToken, dto.code);
    this.setRtCookie(res, result.refreshToken);
    this.setSessionHintCookie(res);
    const { refreshToken: _, ...safe } = result;
    return safe;
  }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60 * 60_000, limit: 3 } })
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
  @ApiResponse({ status: 201, description: '2FA activado.' })
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

  // ── Password Reset ─────────────────────────────────────────────────────────

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { ttl: 15 * 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Solicitar enlace de recuperación de contraseña' })
  @ApiResponse({ status: 204, description: 'Si el email existe, se envía un enlace. Siempre retorna 204.' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.authService.forgotPassword(dto.tenantSlug, dto.email);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { ttl: 15 * 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Restablecer contraseña con token del email' })
  @ApiResponse({ status: 204, description: 'Contraseña actualizada.' })
  @ApiResponse({ status: 400, description: 'Token inválido o expirado.' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
  }
}
