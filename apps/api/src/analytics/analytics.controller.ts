import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'ADMIN', 'MANAGER')
@Controller({ path: 'analytics', version: '1' })
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Resumen general: totales de cursos, usuarios, inscripciones y tasa de completado' })
  getOverview(@CurrentUser() user: JwtPayload) {
    return this.analyticsService.getOverview(user.tenantId);
  }

  @Get('courses')
  @ApiOperation({ summary: 'Estadísticas por curso: inscritos, completados, progreso promedio' })
  getCourseStats(@CurrentUser() user: JwtPayload) {
    return this.analyticsService.getCourseStats(user.tenantId);
  }

  @Get('employees')
  @ApiOperation({ summary: 'Estadísticas por empleado: cursos inscritos, completados, último acceso' })
  getEmployeeStats(@CurrentUser() user: JwtPayload) {
    return this.analyticsService.getEmployeeStats(user.tenantId);
  }
}
