import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiTags,
  ApiOkResponse, ApiNotFoundResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { TenantsService } from './tenants.service';
import { TenantResponseDto } from './dto/tenant-response.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { CreateSubcompanyDto } from './dto/create-subcompany.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Información del tenant autenticado' })
  @ApiOkResponse({ type: TenantResponseDto })
  @ApiNotFoundResponse({ description: 'Tenant no encontrado' })
  getMyTenant(@CurrentUser() user: JwtPayload): Promise<TenantResponseDto> {
    return this.tenantsService.getMyTenant(user.tenantId);
  }

  @Patch('me')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Actualizar personalización del tenant (logo, color, nombre, dominio)' })
  @ApiOkResponse({ type: TenantResponseDto })
  updateMyTenant(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateTenantDto,
  ): Promise<TenantResponseDto> {
    return this.tenantsService.updateMyTenant(user.tenantId, dto);
  }

  // ── Sub-empresas ────────────────────────────────────────────────────────────

  @Get('children')
  @UseGuards(RolesGuard)
  @Roles('OWNER')
  @ApiOperation({ summary: 'Listar sub-empresas del tenant autenticado' })
  listSubcompanies(@CurrentUser() user: JwtPayload) {
    return this.tenantsService.listSubcompanies(user.tenantId);
  }

  @Post('children')
  @UseGuards(RolesGuard)
  @Roles('OWNER')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Crear sub-empresa (verifica límite del plan)' })
  createSubcompany(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSubcompanyDto,
  ) {
    return this.tenantsService.createSubcompany(user.tenantId, user.sub, dto);
  }

  @Delete('children/:id')
  @UseGuards(RolesGuard)
  @Roles('OWNER')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar (soft delete) una sub-empresa' })
  deleteSubcompany(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.tenantsService.deleteSubcompany(user.tenantId, id);
  }
}
