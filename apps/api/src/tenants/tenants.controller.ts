import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiOkResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { TenantResponseDto } from './dto/tenant-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

/**
 * Controller de Tenants.
 *
 * Scope inicial (MVP): solo expone la información del tenant autenticado.
 * Futuras rutas (UsersModule, SubscriptionsModule) usarán el tenant
 * inyectado por el middleware, no rutas de gestión aquí.
 */
@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /**
   * Devuelve los datos del tenant al que pertenece el usuario autenticado.
   * No requiere X-Tenant-Slug — usa el tenantId del JWT directamente,
   * ya que es un lookup por PK (no afectado por RLS).
   */
  @Get('me')
  @ApiOperation({ summary: 'Información del tenant autenticado' })
  @ApiOkResponse({ type: TenantResponseDto })
  @ApiNotFoundResponse({ description: 'Tenant no encontrado' })
  getMyTenant(@CurrentUser() user: JwtPayload): Promise<TenantResponseDto> {
    return this.tenantsService.getMyTenant(user.tenantId);
  }
}
