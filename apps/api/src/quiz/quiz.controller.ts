import {
  Controller, Get, Post, Patch, Put, Delete,
  Body, Param, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { QuizService } from './quiz.service';
import {
  CreateQuizDto, UpdateQuizDto, AddQuizQuestionDto, UpdateQuizQuestionDto,
  ReorderQuizQuestionsDto, AssignQuizDto, SubmitQuizAttemptDto,
} from './dto/quiz.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { UserRole } from '@prisma/client';

/**
 * QuizController — Quizzes standalone (no vinculados a lecciones).
 *
 * Rutas de gestión (OWNER/ADMIN/MANAGER):
 *   POST   /quizzes
 *   GET    /quizzes
 *   GET    /quizzes/:id
 *   PATCH  /quizzes/:id
 *   DELETE /quizzes/:id
 *   POST   /quizzes/:id/questions
 *   PATCH  /quizzes/:id/questions/:qid
 *   DELETE /quizzes/:id/questions/:qid
 *   PUT    /quizzes/:id/questions/reorder
 *   POST   /quizzes/:id/assign
 *   DELETE /quizzes/:id/assignments/:aid
 *   GET    /quizzes/:id/assignments
 *   GET    /quizzes/:id/results
 *
 * Rutas de empleado (todos los autenticados):
 *   GET    /quizzes/my-assignments
 *   GET    /quizzes/assignments/:aid
 *   POST   /quizzes/assignments/:aid/start
 *   POST   /quizzes/assignments/:aid/submit
 */
@ApiTags('Quizzes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('quizzes')
export class QuizController {
  constructor(private readonly service: QuizService) {}

  // ── Gestión (OWNER / ADMIN / MANAGER) ───────────────────────────────────────
  // PlanFeatureGuard se aplica solo a estas rutas — los empleados deben poder
  // consumir /my-assignments y /assignments/:aid/start|submit sin que su plan
  // sea evaluado (el plan ya fue comprobado cuando el admin asignó el quiz).

  @Post()
  @UseGuards(RolesGuard, PlanFeatureGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequireFeature('hasEvaluations')
  @ApiOperation({ summary: 'Crear quiz' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateQuizDto) {
    return this.service.createQuiz(user.tenantId, user.sub, dto);
  }

  @Get()
  @UseGuards(RolesGuard, PlanFeatureGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequireFeature('hasEvaluations')
  @ApiOperation({ summary: 'Listar quizzes del tenant' })
  list(@CurrentUser() user: JwtPayload) {
    return this.service.listQuizzes(user.tenantId);
  }

  // IMPORTANTE: las rutas con sub-paths estáticos (/my-assignments, /assignments/:aid)
  // deben declararse ANTES de la ruta dinámica /:id para que el router no las confunda.

  @Get('my-assignments')
  @ApiOperation({ summary: 'Obtener mis asignaciones pendientes (empleado)' })
  getMyAssignments(@CurrentUser() user: JwtPayload) {
    return this.service.getMyAssignments(user.tenantId, user.sub);
  }

  @Get('my-results')
  @ApiOperation({ summary: 'Historial de quizzes completados con revisión detallada (empleado)' })
  getMyResults(@CurrentUser() user: JwtPayload) {
    return this.service.getMyResults(user.tenantId, user.sub);
  }

  @Get('assignments/:aid')
  @ApiOperation({ summary: 'Detalles de una asignación (empleado)' })
  getAssignment(@CurrentUser() user: JwtPayload, @Param('aid') aid: string) {
    return this.service.getAssignmentDetail(user.tenantId, aid, user.sub);
  }

  @Post('assignments/:aid/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar quiz — crea el intento y activa el timer' })
  startAttempt(@CurrentUser() user: JwtPayload, @Param('aid') aid: string) {
    return this.service.startAttempt(user.tenantId, aid, user.sub);
  }

  @Post('assignments/:aid/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enviar respuestas del quiz — califica y cierra el intento' })
  submitAttempt(
    @CurrentUser() user: JwtPayload,
    @Param('aid') aid: string,
    @Body() dto: SubmitQuizAttemptDto,
  ) {
    return this.service.submitAttempt(user.tenantId, aid, user.sub, dto);
  }

  @Get(':id')
  @UseGuards(RolesGuard, PlanFeatureGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequireFeature('hasEvaluations')
  @ApiOperation({ summary: 'Obtener quiz con preguntas y opciones' })
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.getQuiz(user.tenantId, id);
  }

  @Get(':id/employees')
  @UseGuards(RolesGuard, PlanFeatureGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequireFeature('hasEvaluations')
  @ApiOperation({ summary: 'Empleados asignables al quiz (role=EMPLOYEE, activos, del tenant)' })
  getAssignableEmployees(@CurrentUser() user: JwtPayload) {
    return this.service.getAssignableEmployees(user.tenantId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard, PlanFeatureGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequireFeature('hasEvaluations')
  @ApiOperation({ summary: 'Actualizar quiz' })
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateQuizDto) {
    return this.service.updateQuiz(user.tenantId, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard, PlanFeatureGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequireFeature('hasEvaluations')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar quiz (soft delete)' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.deleteQuiz(user.tenantId, id);
  }

  // ── Preguntas ──────────────────────────────────────────────────────────────

  @Post(':id/questions')
  @UseGuards(RolesGuard, PlanFeatureGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequireFeature('hasEvaluations')
  @ApiOperation({ summary: 'Agregar pregunta al quiz' })
  addQuestion(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: AddQuizQuestionDto) {
    return this.service.addQuestion(user.tenantId, id, dto);
  }

  @Patch(':id/questions/:qid')
  @UseGuards(RolesGuard, PlanFeatureGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequireFeature('hasEvaluations')
  @ApiOperation({ summary: 'Actualizar texto o puntos de una pregunta' })
  updateQuestion(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('qid') qid: string,
    @Body() dto: UpdateQuizQuestionDto,
  ) {
    return this.service.updateQuestion(user.tenantId, id, qid, dto);
  }

  @Delete(':id/questions/:qid')
  @UseGuards(RolesGuard, PlanFeatureGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequireFeature('hasEvaluations')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar pregunta del quiz' })
  removeQuestion(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Param('qid') qid: string) {
    return this.service.removeQuestion(user.tenantId, id, qid);
  }

  @Put(':id/questions/reorder')
  @UseGuards(RolesGuard, PlanFeatureGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequireFeature('hasEvaluations')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reordenar preguntas' })
  reorderQuestions(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: ReorderQuizQuestionsDto) {
    return this.service.reorderQuestions(user.tenantId, id, dto);
  }

  // ── Asignaciones ────────────────────────────────────────────────────────────

  @Post(':id/assign')
  @UseGuards(RolesGuard, PlanFeatureGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequireFeature('hasEvaluations')
  @ApiOperation({ summary: 'Asignar quiz a uno o varios empleados' })
  assign(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: AssignQuizDto) {
    return this.service.assignToUsers(user.tenantId, id, user.sub, dto);
  }

  @Delete(':id/assignments/:aid')
  @UseGuards(RolesGuard, PlanFeatureGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequireFeature('hasEvaluations')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar asignación (solo si no está completada)' })
  removeAssignment(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Param('aid') aid: string) {
    return this.service.removeAssignment(user.tenantId, id, aid);
  }

  @Get(':id/assignments')
  @UseGuards(RolesGuard, PlanFeatureGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequireFeature('hasEvaluations')
  @ApiOperation({ summary: 'Listar asignaciones del quiz con estado de cada empleado' })
  getAssignments(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.getAssignments(user.tenantId, id);
  }

  @Get(':id/results')
  @UseGuards(RolesGuard, PlanFeatureGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequireFeature('hasEvaluations')
  @ApiOperation({ summary: 'Resultados completos del quiz (score por empleado)' })
  getResults(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.getResults(user.tenantId, id);
  }
}
