import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { CourseResponseDto } from './dto/course-response.dto';
import { CourseStatus, LessonType } from '@prisma/client';

/**
 * CoursesService — gestión de cursos, módulos y lecciones.
 *
 * Todas las operaciones están scoped al tenantId del usuario autenticado,
 * lo que garantiza aislamiento multi-tenant en la capa de aplicación
 * (complementando el RLS de PostgreSQL).
 *
 * Patrón de reordenamiento:
 *  Al crear/eliminar items, el orden se recalcula para mantener valores
 *  contiguos (0, 1, 2...). Al reordenar, se usa la posición en el array.
 */
@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Cursos ───────────────────────────────────────────────────────────────────

  async findAll(tenantId: string, userId: string, role: string): Promise<CourseResponseDto[]> {
    // EMPLOYEE solo ve cursos publicados
    const statusFilter = ['EMPLOYEE'].includes(role)
      ? { status: CourseStatus.PUBLISHED }
      : {};

    const courses = await this.prisma.course.findMany({
      where: { tenantId, deletedAt: null, ...statusFilter },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { firstName: true, lastName: true } },
        _count: { select: { enrollments: true } },
      },
    });

    // Enriquecer con datos de inscripción del usuario actual en una sola consulta.
    // Esto evita que el frontend haga una segunda llamada a /enrollments/my
    // solo para saber qué cursos ya tiene el usuario.
    const enrollments = await this.prisma.enrollment.findMany({
      where: { tenantId, userId, status: { not: 'DROPPED' } },
      select: { courseId: true, progress: true },
    });
    const enrollmentMap = new Map(enrollments.map(e => [e.courseId, e.progress]));

    return courses.map(course => {
      const dto = CourseResponseDto.from(course);
      const progress = enrollmentMap.get(course.id);
      if (progress !== undefined) {
        dto.isEnrolled = true;
        dto.myProgress = progress;
      } else {
        dto.isEnrolled = false;
      }
      return dto;
    });
  }

  async findOne(tenantId: string, id: string, role: string): Promise<CourseResponseDto> {
    const course = await this.prisma.course.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        author: { select: { firstName: true, lastName: true } },
        _count: { select: { enrollments: true } },
        modules: {
          where:   { deletedAt: null },
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              where:   { deletedAt: null },
              orderBy: { order: 'asc' },
              // No incluimos `content` (Markdown pesado) en la vista de edición del árbol.
              // El frontend lo carga al seleccionar la lección.
              select: {
                id: true, moduleId: true, tenantId: true, title: true,
                type: true, order: true, isPreview: true, duration: true,
                muxPlaybackId: true, muxStatus: true, muxAssetId: true,
                fileKey: true, fileName: true, fileSizeBytes: true, fileMimeType: true,
                createdAt: true, updatedAt: true, deletedAt: true,
              },
            },
          },
        },
      },
    });

    if (!course) throw new NotFoundException('Curso no encontrado');

    // EMPLOYEE no puede ver cursos en borrador excepto lecciones de preview
    if (role === 'EMPLOYEE' && course.status === CourseStatus.DRAFT) {
      throw new ForbiddenException('Este curso no está disponible');
    }

    return CourseResponseDto.from(course as any);
  }

  async create(tenantId: string, userId: string, dto: CreateCourseDto): Promise<CourseResponseDto> {
    const course = await this.prisma.course.create({
      data: {
        tenantId,
        authorId:     userId,
        title:        dto.title,
        description:  dto.description,
        status:       dto.status ?? CourseStatus.DRAFT,
        thumbnailKey: dto.thumbnailKey,
        thumbnailUrl: dto.thumbnailUrl,
      },
      include: {
        author: { select: { firstName: true, lastName: true } },
        _count: { select: { enrollments: true } },
      },
    });

    this.logger.log(`Curso creado: ${course.title} (tenant: ${tenantId})`);
    return CourseResponseDto.from(course);
  }

  async update(tenantId: string, id: string, dto: UpdateCourseDto): Promise<CourseResponseDto> {
    await this.ensureCourseExists(tenantId, id);

    const course = await this.prisma.course.update({
      where: { id },
      data: {
        title:        dto.title,
        description:  dto.description,
        status:       dto.status,
        thumbnailKey: dto.thumbnailKey,
        thumbnailUrl: dto.thumbnailUrl,
      },
      include: {
        author: { select: { firstName: true, lastName: true } },
        _count: { select: { enrollments: true } },
      },
    });

    return CourseResponseDto.from(course);
  }

  async publish(tenantId: string, id: string): Promise<CourseResponseDto> {
    const course = await this.ensureCourseExists(tenantId, id);

    if (course.totalLessons === 0) {
      throw new BadRequestException(
        'No puedes publicar un curso sin lecciones. Agrega al menos una lección.',
      );
    }

    const updated = await this.prisma.course.update({
      where: { id },
      data:  { status: CourseStatus.PUBLISHED },
      include: {
        author: { select: { firstName: true, lastName: true } },
        _count: { select: { enrollments: true } },
      },
    });

    return CourseResponseDto.from(updated);
  }

  async archive(tenantId: string, id: string): Promise<CourseResponseDto> {
    await this.ensureCourseExists(tenantId, id);

    const updated = await this.prisma.course.update({
      where: { id },
      data:  { status: CourseStatus.ARCHIVED },
      include: {
        author: { select: { firstName: true, lastName: true } },
        _count: { select: { enrollments: true } },
      },
    });

    return CourseResponseDto.from(updated);
  }

  /**
   * Restaura un curso archivado a DRAFT.
   *
   * Flujo permitido: ARCHIVED → DRAFT (no directamente a PUBLISHED).
   * El instructor debe revisar el contenido antes de volver a publicar.
   * Los datos de progreso e inscripciones previas se conservan intactos.
   */
  async unarchive(tenantId: string, id: string): Promise<CourseResponseDto> {
    const course = await this.ensureCourseExists(tenantId, id);

    if (course.status !== CourseStatus.ARCHIVED) {
      throw new BadRequestException('Solo se pueden restaurar cursos archivados.');
    }

    const updated = await this.prisma.course.update({
      where: { id },
      data:  { status: CourseStatus.DRAFT },
      include: {
        author: { select: { firstName: true, lastName: true } },
        _count: { select: { enrollments: true } },
      },
    });

    return CourseResponseDto.from(updated);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.ensureCourseExists(tenantId, id);
    await this.prisma.course.update({
      where: { id },
      data:  { deletedAt: new Date() },
    });
  }

  // ── Módulos ──────────────────────────────────────────────────────────────────

  async createModule(tenantId: string, courseId: string, dto: CreateModuleDto) {
    await this.ensureCourseExists(tenantId, courseId);

    const lastModule = await this.prisma.courseModule.findFirst({
      where:   { courseId, deletedAt: null },
      orderBy: { order: 'desc' },
      select:  { order: true },
    });

    const module = await this.prisma.courseModule.create({
      data: {
        courseId,
        tenantId,
        title:       dto.title,
        description: dto.description,
        order:       (lastModule?.order ?? -1) + 1,
      },
      include: { lessons: true },
    });

    return module;
  }

  async updateModule(tenantId: string, courseId: string, moduleId: string, dto: Partial<CreateModuleDto>) {
    await this.ensureModuleExists(tenantId, courseId, moduleId);

    return this.prisma.courseModule.update({
      where: { id: moduleId },
      data: { title: dto.title, description: dto.description },
      include: { lessons: { where: { deletedAt: null }, orderBy: { order: 'asc' } } },
    });
  }

  async removeModule(tenantId: string, courseId: string, moduleId: string): Promise<void> {
    const module = await this.ensureModuleExists(tenantId, courseId, moduleId);

    await this.prisma.$transaction(async (tx) => {
      // Soft delete el módulo y todas sus lecciones
      await tx.lesson.updateMany({
        where: { moduleId },
        data:  { deletedAt: new Date() },
      });
      await tx.courseModule.update({
        where: { id: moduleId },
        data:  { deletedAt: new Date() },
      });
      // Recalcular totalLessons del curso
      const lessonCount = await tx.lesson.count({
        where: { module: { courseId }, deletedAt: null },
      });
      await tx.course.update({
        where: { id: courseId },
        data:  { totalLessons: lessonCount },
      });
    });

    // Reordenar módulos restantes
    await this.reorderSiblings('module', courseId);
  }

  async reorderModules(tenantId: string, courseId: string, orderedIds: string[]): Promise<void> {
    await this.ensureCourseExists(tenantId, courseId);

    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.courseModule.update({ where: { id }, data: { order: index } }),
      ),
    );
  }

  // ── Lecciones ────────────────────────────────────────────────────────────────

  async createLesson(tenantId: string, courseId: string, moduleId: string, dto: CreateLessonDto) {
    await this.ensureModuleExists(tenantId, courseId, moduleId);

    const lastLesson = await this.prisma.lesson.findFirst({
      where:   { moduleId, deletedAt: null },
      orderBy: { order: 'desc' },
      select:  { order: true },
    });

    const lesson = await this.prisma.$transaction(async (tx) => {
      const newLesson = await tx.lesson.create({
        data: {
          moduleId,
          tenantId,
          title:        dto.title,
          type:         dto.type,
          content:      dto.content,
          duration:     dto.duration,
          isPreview:    dto.isPreview ?? false,
          order:        (lastLesson?.order ?? -1) + 1,
          fileKey:      dto.fileKey,
          fileName:     dto.fileName,
          fileSizeBytes: dto.fileSizeBytes,
          fileMimeType:  dto.fileMimeType,
        },
      });

      // Incrementar contador desnormalizado en el curso
      await tx.course.update({
        where: { id: courseId },
        data:  { totalLessons: { increment: 1 } },
      });

      return newLesson;
    });

    return lesson;
  }

  async getLessonContent(tenantId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, tenantId, deletedAt: null },
    });
    if (!lesson) throw new NotFoundException('Lección no encontrada');
    return lesson;
  }

  async updateLesson(tenantId: string, courseId: string, moduleId: string, lessonId: string, dto: Partial<CreateLessonDto>) {
    await this.ensureLessonExists(tenantId, moduleId, lessonId);

    return this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        title:         dto.title,
        content:       dto.content,
        type:          dto.type,
        duration:      dto.duration,
        isPreview:     dto.isPreview,
        fileKey:       dto.fileKey,
        fileName:      dto.fileName,
        fileSizeBytes: dto.fileSizeBytes,
        fileMimeType:  dto.fileMimeType,
      },
    });
  }

  async removeLesson(tenantId: string, courseId: string, moduleId: string, lessonId: string): Promise<void> {
    await this.ensureLessonExists(tenantId, moduleId, lessonId);

    await this.prisma.$transaction(async (tx) => {
      await tx.lesson.update({ where: { id: lessonId }, data: { deletedAt: new Date() } });
      await tx.course.update({
        where: { id: courseId },
        data:  { totalLessons: { decrement: 1 } },
      });
    });

    await this.reorderSiblings('lesson', moduleId);
  }

  async reorderLessons(tenantId: string, moduleId: string, orderedIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.lesson.update({ where: { id }, data: { order: index } }),
      ),
    );
  }

  // ── Helpers privados ─────────────────────────────────────────────────────────

  private async ensureCourseExists(tenantId: string, courseId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, tenantId, deletedAt: null },
    });
    if (!course) throw new NotFoundException('Curso no encontrado');
    return course;
  }

  private async ensureModuleExists(tenantId: string, courseId: string, moduleId: string) {
    const module = await this.prisma.courseModule.findFirst({
      where: { id: moduleId, courseId, tenantId, deletedAt: null },
    });
    if (!module) throw new NotFoundException('Módulo no encontrado');
    return module;
  }

  private async ensureLessonExists(tenantId: string, moduleId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, moduleId, tenantId, deletedAt: null },
    });
    if (!lesson) throw new NotFoundException('Lección no encontrada');
    return lesson;
  }

  /**
   * Reordena los elementos hermanos con valores contiguos (0, 1, 2...).
   * Se llama después de eliminar un item para cerrar el "hueco" en el orden.
   */
  private async reorderSiblings(type: 'module' | 'lesson', parentId: string): Promise<void> {
    if (type === 'module') {
      const modules = await this.prisma.courseModule.findMany({
        where: { courseId: parentId, deletedAt: null },
        orderBy: { order: 'asc' },
        select: { id: true },
      });
      await this.prisma.$transaction(
        modules.map((m, i) =>
          this.prisma.courseModule.update({ where: { id: m.id }, data: { order: i } }),
        ),
      );
    } else {
      const lessons = await this.prisma.lesson.findMany({
        where: { moduleId: parentId, deletedAt: null },
        orderBy: { order: 'asc' },
        select: { id: true },
      });
      await this.prisma.$transaction(
        lessons.map((l, i) =>
          this.prisma.lesson.update({ where: { id: l.id }, data: { order: i } }),
        ),
      );
    }
  }
}
