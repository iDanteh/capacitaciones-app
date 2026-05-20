import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EnrollmentResponseDto } from './dto/enrollment-response.dto';
import { EnrollmentStatus, CourseStatus } from '@prisma/client';

/**
 * EnrollmentsService — inscripciones y seguimiento de progreso.
 *
 * Flujo de progreso:
 *  1. El usuario se inscribe en un curso → Enrollment creado con progress=0.
 *  2. Al completar una lección → LessonProgress.completedAt se registra.
 *  3. Se recalcula enrollment.progress = (lecciones completadas / total) * 100.
 *  4. Si progress = 100 → enrollment.status = COMPLETED.
 *
 * El cálculo es eventual: no hay transacciones largas, solo actualizaciones
 * puntuales. El progreso es siempre derivable desde LessonProgress.
 */
@Injectable()
export class EnrollmentsService {
  private readonly logger = new Logger(EnrollmentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Inscripción ──────────────────────────────────────────────────────────────

  async enroll(tenantId: string, userId: string, courseId: string): Promise<EnrollmentResponseDto> {
    // Verificar que el curso existe y está publicado
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, tenantId, deletedAt: null, status: CourseStatus.PUBLISHED },
    });

    if (!course) throw new NotFoundException('Curso no encontrado o no disponible');

    // Verificar inscripción duplicada
    const existing = await this.prisma.enrollment.findUnique({
      where: { tenantId_userId_courseId: { tenantId, userId, courseId } },
    });

    if (existing && existing.status === EnrollmentStatus.ACTIVE) {
      throw new ConflictException('Ya estás inscrito en este curso');
    }

    // Si existe pero DROPPED → reactivar en lugar de crear uno nuevo
    if (existing) {
      const reactivated = await this.prisma.enrollment.update({
        where: { id: existing.id },
        data:  { status: EnrollmentStatus.ACTIVE },
        include: {
          course:         { select: { title: true, thumbnailUrl: true, totalLessons: true, status: true } },
          lessonProgress: true,
        },
      });
      return EnrollmentResponseDto.from(reactivated);
    }

    const enrollment = await this.prisma.enrollment.create({
      data: { tenantId, userId, courseId },
      include: {
        course:         { select: { title: true, thumbnailUrl: true, totalLessons: true, status: true } },
        lessonProgress: true,
      },
    });

    this.logger.log(`Usuario ${userId} inscrito en curso ${courseId}`);
    return EnrollmentResponseDto.from(enrollment);
  }

  async unenroll(tenantId: string, userId: string, enrollmentId: string): Promise<void> {
    const enrollment = await this.ensureEnrollmentAccess(tenantId, userId, enrollmentId);
    await this.prisma.enrollment.update({
      where: { id: enrollment.id },
      data:  { status: EnrollmentStatus.DROPPED },
    });
  }

  // ── Mis inscripciones ────────────────────────────────────────────────────────

  async myEnrollments(tenantId: string, userId: string): Promise<EnrollmentResponseDto[]> {
    const enrollments = await this.prisma.enrollment.findMany({
      where:   { tenantId, userId, status: { not: EnrollmentStatus.DROPPED } },
      orderBy: { createdAt: 'desc' },
      include: {
        course:         { select: { title: true, thumbnailUrl: true, totalLessons: true, status: true } },
        lessonProgress: true,
      },
    });

    return enrollments.map(EnrollmentResponseDto.from);
  }

  async findOne(tenantId: string, userId: string, enrollmentId: string): Promise<EnrollmentResponseDto> {
    const enrollment = await this.ensureEnrollmentAccess(tenantId, userId, enrollmentId);

    const full = await this.prisma.enrollment.findUnique({
      where: { id: enrollment.id },
      include: {
        course:         { select: { title: true, thumbnailUrl: true, totalLessons: true, status: true } },
        lessonProgress: true,
      },
    });

    return EnrollmentResponseDto.from(full!);
  }

  // ── Progreso ─────────────────────────────────────────────────────────────────

  async completeLesson(
    tenantId: string,
    userId: string,
    enrollmentId: string,
    lessonId: string,
    watchedSeconds?: number,
  ): Promise<EnrollmentResponseDto> {
    const enrollment = await this.ensureEnrollmentAccess(tenantId, userId, enrollmentId);

    if (enrollment.status === EnrollmentStatus.DROPPED) {
      throw new ForbiddenException('No puedes actualizar el progreso de una inscripción cancelada');
    }

    // Registrar/actualizar progreso de la lección
    await this.prisma.lessonProgress.upsert({
      where:  { enrollmentId_lessonId: { enrollmentId, lessonId } },
      update: { completedAt: new Date(), watchedSeconds },
      create: {
        enrollmentId,
        lessonId,
        userId,
        tenantId,
        completedAt:   new Date(),
        watchedSeconds,
      },
    });

    // Recalcular progreso global
    return this.recalculateProgress(enrollmentId, tenantId, userId, enrollment.courseId);
  }

  async saveVideoProgress(
    tenantId: string,
    userId: string,
    enrollmentId: string,
    lessonId: string,
    watchedSeconds: number,
  ): Promise<void> {
    const enrollment = await this.ensureEnrollmentAccess(tenantId, userId, enrollmentId);

    await this.prisma.lessonProgress.upsert({
      where:  { enrollmentId_lessonId: { enrollmentId, lessonId } },
      update: { watchedSeconds },
      create: { enrollmentId, lessonId, userId, tenantId, watchedSeconds },
    });
  }

  // ── Gestión de inscripciones por ADMIN ────────────────────────────────────────

  async enrollUserById(tenantId: string, userId: string, courseId: string): Promise<EnrollmentResponseDto> {
    return this.enroll(tenantId, userId, courseId);
  }

  async getCourseEnrollments(tenantId: string, courseId: string) {
    return this.prisma.enrollment.findMany({
      where: { tenantId, courseId, status: { not: EnrollmentStatus.DROPPED } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Helpers privados ─────────────────────────────────────────────────────────

  private async ensureEnrollmentAccess(tenantId: string, userId: string, enrollmentId: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id: enrollmentId, tenantId },
    });

    if (!enrollment) throw new NotFoundException('Inscripción no encontrada');

    // Solo el propio usuario o un admin puede acceder
    if (enrollment.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a esta inscripción');
    }

    return enrollment;
  }

  /**
   * Recalcula el progreso del enrollment.
   *
   * Fórmula: (lecciones completadas / totalLessons del curso) * 100
   * Efecto secundario: si llega a 100, marca enrollment como COMPLETED.
   */
  private async recalculateProgress(
    enrollmentId: string,
    tenantId: string,
    userId: string,
    courseId: string,
  ): Promise<EnrollmentResponseDto> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { totalLessons: true },
    });

    const completedCount = await this.prisma.lessonProgress.count({
      where: { enrollmentId, completedAt: { not: null } },
    });

    const total    = course?.totalLessons ?? 1;
    const progress = Math.round((completedCount / total) * 100);
    const isCompleted = progress >= 100;

    const updated = await this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        progress,
        status:      isCompleted ? EnrollmentStatus.COMPLETED : EnrollmentStatus.ACTIVE,
        completedAt: isCompleted ? new Date() : null,
      },
      include: {
        course:         { select: { title: true, thumbnailUrl: true, totalLessons: true, status: true } },
        lessonProgress: true,
      },
    });

    return EnrollmentResponseDto.from(updated);
  }
}
