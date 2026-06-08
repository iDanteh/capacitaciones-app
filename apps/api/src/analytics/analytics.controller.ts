import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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

  @Get('activity')
  @ApiOperation({ summary: 'Feed de actividad reciente: inscripciones, completados, certificados, nuevos usuarios (últimos 30 días)' })
  getActivity(@CurrentUser() user: JwtPayload) {
    return this.analyticsService.getActivity(user.tenantId);
  }

  @Get('weekly')
  @ApiOperation({ summary: 'Datos históricos de los últimos 7 días: inscripciones, completados, usuarios, cursos, certificados' })
  getWeekly(@CurrentUser() user: JwtPayload) {
    return this.analyticsService.getWeekly(user.tenantId);
  }

  @Get('employees')
  @ApiOperation({ summary: 'Estadísticas por empleado: cursos inscritos, completados, último acceso' })
  getEmployeeStats(
    @CurrentUser() user: JwtPayload,
    @Query('search') search?: string,
  ) {
    return this.analyticsService.getEmployeeStats(user.tenantId, search);
  }
}
