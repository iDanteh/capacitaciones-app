import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Enrollment, EnrollmentStatus, LessonProgress } from '@prisma/client';

type EnrollmentWithRelations = Enrollment & {
  course?: {
    id?: string;
    title: string;
    thumbnailUrl: string | null;
    totalLessons: number;
    status: string;
  };
  lessonProgress?: LessonProgress[];
};

/** Snapshot de progreso por lección — incluido en el enrollment para tracking en el visor. */
export class LessonProgressDto {
  lessonId: string;
  completedAt: Date | null;
  watchedSeconds: number | null;
}

export class EnrollmentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() courseId: string;
  @ApiProperty() userId: string;
  @ApiProperty({ enum: EnrollmentStatus }) status: EnrollmentStatus;
  @ApiProperty() progress: number;
  @ApiPropertyOptional() completedAt?: Date | null;
  @ApiPropertyOptional() courseTitle?: string;
  @ApiPropertyOptional() courseThumbnailUrl?: string | null;
  @ApiPropertyOptional() courseTotalLessons?: number;
  @ApiPropertyOptional() completedLessons?: number;
  /**
   * Progreso detallado por lección.
   * El visor lo usa para marcar visualmente las lecciones completadas
   * y para retomar videos desde el segundo exacto (watchedSeconds).
   */
  @ApiProperty({ type: [LessonProgressDto] })
  lessonProgress: LessonProgressDto[];
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static from(enrollment: EnrollmentWithRelations): EnrollmentResponseDto {
    const dto = new EnrollmentResponseDto();
    dto.id           = enrollment.id;
    dto.courseId     = enrollment.courseId;
    dto.userId       = enrollment.userId;
    dto.status       = enrollment.status;
    dto.progress     = enrollment.progress;
    dto.completedAt  = enrollment.completedAt;
    dto.createdAt    = enrollment.createdAt;
    dto.updatedAt    = enrollment.updatedAt;

    if (enrollment.course) {
      dto.courseTitle        = enrollment.course.title;
      dto.courseThumbnailUrl = enrollment.course.thumbnailUrl;
      dto.courseTotalLessons = enrollment.course.totalLessons;
    }

    // Serializar el array completo — el visor necesita lessonId + completedAt + watchedSeconds.
    dto.lessonProgress = (enrollment.lessonProgress ?? []).map(p => ({
      lessonId:       p.lessonId,
      completedAt:    p.completedAt,
      watchedSeconds: p.watchedSeconds,
    }));

    dto.completedLessons = dto.lessonProgress.filter(p => p.completedAt).length;

    return dto;
  }
}
