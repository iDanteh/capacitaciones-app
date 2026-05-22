import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EvaluationsService } from './evaluations.service';
import {
  CreateEvaluationDto,
  UpdateEvaluationDto,
  CreateQuestionDto,
} from './dto/create-evaluation.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { UserRole } from '@prisma/client';

/**
 * EvaluationsController
 *
 * Rutas de gestión (OWNER/ADMIN):
 *   POST   /lessons/:lessonId/evaluation        — crear evaluación
 *   GET    /lessons/:lessonId/evaluation/admin  — obtener con respuestas correctas
 *   PATCH  /evaluations/:id                     — editar metadatos
 *   DELETE /evaluations/:id                     — eliminar evaluación
 *   POST   /evaluations/:id/questions           — agregar pregunta
 *   DELETE /evaluations/:id/questions/:qid      — eliminar pregunta
 *
 * Rutas de consumo (cualquier usuario autenticado):
 *   GET    /lessons/:lessonId/evaluation        — obtener sin respuestas (para estudiante)
 *   POST   /evaluations/:id/attempt             — enviar intento
 *   GET    /evaluations/:id/attempts/my         — ver mis intentos
 */
@ApiTags('Evaluaciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlanFeatureGuard)
@RequireFeature('hasEvaluations')
@Controller()
export class EvaluationsController {
  constructor(private readonly service: EvaluationsService) {}

  // ── Rutas de gestión (ADMIN/OWNER) ────────────────────────────────────────

  @Post('lessons/:lessonId/evaluation')
  @ApiOperation({ summary: 'Crear evaluación para una lección' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  create(
    @CurrentUser() user: JwtPayload,
    @Param('lessonId') lessonId: string,
    @Body() dto: CreateEvaluationDto,
  ) {
    return this.service.create(user.tenantId, lessonId, dto);
  }

  @Get('lessons/:lessonId/evaluation/admin')
  @ApiOperation({ summary: 'Obtener evaluación con respuestas correctas (admin)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  getForAdmin(
    @CurrentUser() user: JwtPayload,
    @Param('lessonId') lessonId: string,
  ) {
    return this.service.findByLesson(user.tenantId, lessonId);
  }

  @Patch('evaluations/:id')
  @ApiOperation({ summary: 'Actualizar metadatos de una evaluación' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateEvaluationDto,
  ) {
    return this.service.update(user.tenantId, id, dto);
  }

  @Delete('evaluations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una evaluación' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.remove(user.tenantId, id);
  }

  @Post('evaluations/:id/questions')
  @ApiOperation({ summary: 'Agregar una pregunta a la evaluación' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  addQuestion(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.service.addQuestion(user.tenantId, id, dto);
  }

  @Delete('evaluations/:id/questions/:questionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una pregunta' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  removeQuestion(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('questionId') questionId: string,
  ) {
    return this.service.removeQuestion(user.tenantId, id, questionId);
  }

  // ── Rutas de consumo (todos los usuarios autenticados) ────────────────────

  @Get('lessons/:lessonId/evaluation')
  @ApiOperation({ summary: 'Obtener evaluación para estudiante (sin respuestas correctas)' })
  getForStudent(
    @CurrentUser() user: JwtPayload,
    @Param('lessonId') lessonId: string,
  ) {
    return this.service.getForStudent(user.tenantId, user.sub, lessonId);
  }

  @Post('evaluations/:id/attempt')
  @ApiOperation({ summary: 'Enviar intento de evaluación' })
  submitAttempt(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SubmitAttemptDto,
  ) {
    return this.service.submitAttempt(user.tenantId, user.sub, id, dto);
  }

  @Get('evaluations/:id/attempts/my')
  @ApiOperation({ summary: 'Ver mis intentos en una evaluación' })
  getMyAttempts(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.service.getMyAttempts(user.tenantId, user.sub, id);
  }
}
