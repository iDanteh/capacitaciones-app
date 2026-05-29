import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { BulkInviteDto } from './dto/bulk-invite.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ── Perfil propio (cualquier usuario autenticado) ──────────────────────────

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  getMyProfile(@CurrentUser() user: JwtPayload) {
    return this.usersService.getMyProfile(user.sub, user.tenantId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Actualizar nombre y avatar del perfil propio' })
  updateMyProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateMyProfile(user.sub, user.tenantId, dto);
  }

  @Post('me/change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })   // Máx. 5 intentos/min — brute-force protection
  @ApiOperation({ summary: 'Cambiar contraseña (requiere contraseña actual)' })
  changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(user.sub, user.tenantId, dto);
  }

  // ── Rutas protegidas (requieren rol específico) ────────────────────────────

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Listar usuarios del tenant (paginado)' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page',  new DefaultValuePipe(1),  ParseIntPipe) page:  number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.usersService.findAll(user.tenantId, page, Math.min(limit, 100));
  }

  @Get('invites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Listar invitaciones pendientes' })
  findPendingInvites(@CurrentUser() user: JwtPayload) {
    return this.usersService.findPendingInvites(user.tenantId);
  }

  @Post('invite')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })  // Máx. 10 invitaciones/min por IP
  @ApiOperation({ summary: 'Invitar un nuevo usuario por email' })
  invite(@CurrentUser() user: JwtPayload, @Body() dto: InviteUserDto) {
    return this.usersService.invite(user.tenantId, user.sub, dto);
  }

  @Post('invite-bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })   // 3 importaciones/min — cada una puede traer hasta 100 usuarios
  @ApiOperation({ summary: 'Importar múltiples usuarios desde CSV (máx. 100 por request)' })
  inviteBulk(@CurrentUser() user: JwtPayload, @Body() dto: BulkInviteDto) {
    return this.usersService.inviteBulk(user.tenantId, user.sub, dto);
  }

  @Delete('invites/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancelar una invitación pendiente' })
  cancelInvite(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.usersService.cancelInvite(user.tenantId, id);
  }

  // ── :id debe ir DESPUÉS de rutas literales (me, invites) ──────────────────

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Obtener un usuario por ID' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.usersService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar nombre, rol o estado de un usuario (admin)' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(user.tenantId, id, dto, user.sub);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar (soft delete) un usuario' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.usersService.remove(user.tenantId, id, user.sub);
  }

  // ── Rutas públicas (aceptar invitación — sin JWT) ──────────────────────────

  @Get('accept-invite/info')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })  // Ruta pública — limitar enumeración
  @ApiOperation({ summary: 'Obtener información de una invitación por token (público)' })
  getInviteInfo(@Query('token') token: string) {
    return this.usersService.getInviteByToken(token);
  }

  @Post('accept-invite')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })   // Ruta pública — prevenir brute-force en tokens
  @ApiOperation({ summary: 'Aceptar invitación y crear cuenta (público)' })
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.usersService.acceptInvite(dto);
  }
}
