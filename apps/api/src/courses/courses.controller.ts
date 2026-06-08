import {
  Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { ReorderDto } from './dto/reorder.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('Courses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'courses', version: '1' })
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  // ── Cursos ──────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Listar cursos del tenant (incluye isEnrolled y myProgress del usuario)' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.coursesService.findAll(user.tenantId, user.sub, user.role, {
      search,
      status,
      sortBy,
      sortOrder,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle del curso con módulos y lecciones' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.coursesService.findOne(user.tenantId, id, user.role);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Crear nuevo curso (OWNER/ADMIN)' })
  create(@Body() dto: CreateCourseDto, @CurrentUser() user: JwtPayload) {
    return this.coursesService.create(user.tenantId, user.sub, dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Editar curso' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.coursesService.update(user.tenantId, id, dto);
  }

  @Patch(':id/publish')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Publicar curso' })
  publish(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.coursesService.publish(user.tenantId, id);
  }

  @Patch(':id/archive')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Archivar curso (PUBLISHED → ARCHIVED)' })
  archive(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.coursesService.archive(user.tenantId, id);
  }

  @Patch(':id/unarchive')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Restaurar curso archivado a Borrador (ARCHIVED → DRAFT)' })
  unarchive(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.coursesService.unarchive(user.tenantId, id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Eliminar curso (soft delete)' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.coursesService.remove(user.tenantId, id);
  }

  // ── Módulos ─────────────────────────────────────────────────────────────────

  @Post(':courseId/modules')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Agregar módulo al curso' })
  createModule(
    @Param('courseId') courseId: string,
    @Body() dto: CreateModuleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.coursesService.createModule(user.tenantId, courseId, dto);
  }

  @Patch(':courseId/modules/:moduleId')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Editar módulo' })
  updateModule(
    @Param('courseId') courseId: string,
    @Param('moduleId') moduleId: string,
    @Body() dto: CreateModuleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.coursesService.updateModule(user.tenantId, courseId, moduleId, dto);
  }

  @Delete(':courseId/modules/:moduleId')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Eliminar módulo (y sus lecciones)' })
  removeModule(
    @Param('courseId') courseId: string,
    @Param('moduleId') moduleId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.coursesService.removeModule(user.tenantId, courseId, moduleId);
  }

  @Put(':courseId/modules/reorder')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Reordenar módulos' })
  reorderModules(
    @Param('courseId') courseId: string,
    @Body() dto: ReorderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.coursesService.reorderModules(user.tenantId, courseId, dto.orderedIds);
  }

  // ── Lecciones ───────────────────────────────────────────────────────────────

  @Post(':courseId/modules/:moduleId/lessons')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Agregar lección al módulo' })
  createLesson(
    @Param('courseId') courseId: string,
    @Param('moduleId') moduleId: string,
    @Body() dto: CreateLessonDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.coursesService.createLesson(user.tenantId, courseId, moduleId, dto);
  }

  @Get(':courseId/modules/:moduleId/lessons/:lessonId')
  @ApiOperation({ summary: 'Contenido completo de la lección (incluye Markdown)' })
  getLessonContent(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.coursesService.getLessonContent(user.tenantId, lessonId);
  }

  @Patch(':courseId/modules/:moduleId/lessons/:lessonId')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Editar lección (campos parciales — solo envía lo que cambia)' })
  updateLesson(
    @Param('courseId') courseId: string,
    @Param('moduleId') moduleId: string,
    @Param('lessonId') lessonId: string,
    @Body() dto: UpdateLessonDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.coursesService.updateLesson(user.tenantId, courseId, moduleId, lessonId, dto);
  }

  @Delete(':courseId/modules/:moduleId/lessons/:lessonId')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Eliminar lección' })
  removeLesson(
    @Param('courseId') courseId: string,
    @Param('moduleId') moduleId: string,
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.coursesService.removeLesson(user.tenantId, courseId, moduleId, lessonId);
  }

  @Put(':courseId/modules/:moduleId/lessons/reorder')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Reordenar lecciones' })
  reorderLessons(
    @Param('moduleId') moduleId: string,
    @Body() dto: ReorderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.coursesService.reorderLessons(user.tenantId, moduleId, dto.orderedIds);
  }
}
