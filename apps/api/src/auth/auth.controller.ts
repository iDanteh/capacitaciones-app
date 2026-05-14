import {
  Controller,
  Post,
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
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtPayload } from './strategies/jwt.strategy';
import { JwtRefreshPayload } from './strategies/jwt-refresh.strategy';

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
  constructor(private readonly authService: AuthService) {}

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
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Datos del usuario autenticado (desde el token)' })
  @ApiResponse({ status: 200, description: 'Payload del JWT.' })
  me(@CurrentUser() user: JwtPayload) {
    // Retorna el payload del token, no una consulta a DB.
    // Para datos completos del perfil usar UsersModule (Fase 1).
    return user;
  }
}
