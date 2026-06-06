import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { SuperAdminService } from './super-admin.service';

@ApiTags('Super Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller({ path: 'super-admin', version: '1' })
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Estadísticas globales de la plataforma (solo SUPER_ADMIN)' })
  getPlatformStats() {
    return this.superAdminService.getPlatformStats();
  }

  @Get('tenants')
  @ApiOperation({ summary: 'Lista todos los tenants raíz con sus stats (solo SUPER_ADMIN)' })
  listTenants(@Query('search') search?: string) {
    return this.superAdminService.listTenants(search);
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Detalle completo de un tenant (solo SUPER_ADMIN)' })
  getTenantDetail(@Param('id') id: string) {
    return this.superAdminService.getTenantDetail(id);
  }

  @Patch('tenants/:id/suspend')
  @ApiOperation({ summary: 'Suspende un tenant (solo SUPER_ADMIN)' })
  suspendTenant(@Param('id') id: string) {
    return this.superAdminService.suspendTenant(id);
  }

  @Patch('tenants/:id/activate')
  @ApiOperation({ summary: 'Reactiva un tenant suspendido (solo SUPER_ADMIN)' })
  activateTenant(@Param('id') id: string) {
    return this.superAdminService.activateTenant(id);
  }
}
