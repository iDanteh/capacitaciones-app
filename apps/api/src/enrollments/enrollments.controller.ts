import {
  Body, Controller, Delete, Get, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EnrollmentsService } from './enrollments.service';
import { EnrollDto, CompleteLessonDto } from './dto/enroll.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('Enrollments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'enrollments', version: '1' })
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  // ── Mis inscripciones ────────────────────────────────────────────────────────

  @Get('my')
  @ApiOperation({ summary: 'Mis inscripciones activas' })
  myEnrollments(@CurrentUser() user: JwtPayload) {
    return this.enrollmentsService.myEnrollments(user.tenantId, user.sub);
  }

  @Get(':enrollmentId')
  @ApiOperation({ summary: 'Detalle de inscripción con progreso' })
  findOne(
    @Param('enrollmentId') enrollmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.enrollmentsService.findOne(user.tenantId, user.sub, enrollmentId);
  }

  @Post()
  @ApiOperation({ summary: 'Inscribirse en un curso' })
  enroll(@Body() dto: EnrollDto, @CurrentUser() user: JwtPayload) {
    return this.enrollmentsService.enroll(user.tenantId, user.sub, dto.courseId);
  }

  @Delete(':enrollmentId')
  @ApiOperation({ summary: 'Cancelar inscripción' })
  unenroll(
    @Param('enrollmentId') enrollmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.enrollmentsService.unenroll(user.tenantId, user.sub, enrollmentId);
  }

  // ── Progreso ─────────────────────────────────────────────────────────────────

  @Post(':enrollmentId/lessons/:lessonId/complete')
  @ApiOperation({ summary: 'Marcar lección como completada' })
  completeLesson(
    @Param('enrollmentId') enrollmentId: string,
    @Param('lessonId') lessonId: string,
    @Body() dto: CompleteLessonDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.enrollmentsService.completeLesson(
      user.tenantId, user.sub, enrollmentId, lessonId, dto.watchedSeconds,
    );
  }

  @Patch(':enrollmentId/lessons/:lessonId/progress')
  @ApiOperation({ summary: 'Guardar progreso de video (segundos vistos)' })
  saveVideoProgress(
    @Param('enrollmentId') enrollmentId: string,
    @Param('lessonId') lessonId: string,
    @Body() dto: CompleteLessonDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.enrollmentsService.saveVideoProgress(
      user.tenantId, user.sub, enrollmentId, lessonId, dto.watchedSeconds ?? 0,
    );
  }

  // ── Admin: inscripciones de un curso ────────────────────────────────────────

  @Get('course/:courseId')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Listar inscripciones de un curso (ADMIN/MANAGER)' })
  getCourseEnrollments(
    @Param('courseId') courseId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.enrollmentsService.getCourseEnrollments(user.tenantId, courseId);
  }

  @Post('admin/enroll')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Inscribir a un usuario en un curso (ADMIN)' })
  adminEnroll(
    @Body() body: { userId: string; courseId: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.enrollmentsService.enrollUserById(user.tenantId, body.userId, body.courseId);
  }
}
