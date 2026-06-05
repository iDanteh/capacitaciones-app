import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
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
  UpdateQuestionDto,
  ReorderQuestionsDto,
  CreateResetRequestDto,
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

  @Patch('evaluations/:id/questions/:questionId')
  @ApiOperation({ summary: 'Editar texto, puntos, explicación u opciones de una pregunta' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  updateQuestion(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.service.updateQuestion(user.tenantId, id, questionId, dto);
  }

  @Put('evaluations/:id/questions/reorder')
  @ApiOperation({ summary: 'Reordenar preguntas de una evaluación' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  reorderQuestions(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ReorderQuestionsDto,
  ) {
    return this.service.reorderQuestions(user.tenantId, id, dto.orderedIds);
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

  // ── Solicitudes de reinicio de intentos ─────────────────────────────────

  @Post('evaluations/:id/reset-requests')
  @ApiOperation({ summary: 'Solicitar reinicio de intentos (estudiante)' })
  createResetRequest(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateResetRequestDto,
  ) {
    return this.service.createResetRequest(user.tenantId, user.sub, id, dto.message);
  }

  @Get('evaluations/:id/reset-requests')
  @ApiOperation({ summary: 'Listar solicitudes de reinicio pendientes (admin)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  listPendingResets(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.service.listPendingResets(user.tenantId, id);
  }

  @Post('evaluations/:id/reset-requests/:reqId/approve')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Aprobar solicitud — reinicia intentos del usuario' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  approveReset(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('reqId') reqId: string,
  ) {
    return this.service.approveReset(user.tenantId, id, reqId, user.sub);
  }

  @Post('evaluations/:id/reset-requests/:reqId/deny')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Rechazar solicitud de reinicio' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  denyReset(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('reqId') reqId: string,
  ) {
    return this.service.denyReset(user.tenantId, id, reqId, user.sub);
  }
}
