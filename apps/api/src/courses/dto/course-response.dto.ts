import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Course, CourseModule, Lesson, CourseStatus, LessonType } from '@prisma/client';

// ─── Tipos intermedios ────────────────────────────────────────────────────────

type LessonWithoutContent = Omit<Lesson, 'content'>;

type ModuleWithLessons = CourseModule & {
  lessons: LessonWithoutContent[];
};

type CourseWithRelations = Course & {
  author?: { firstName: string; lastName: string } | null;
  modules?: ModuleWithLessons[];
  _count?: { enrollments: number };
};

// ─── DTOs de respuesta ────────────────────────────────────────────────────────

export class LessonResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() moduleId: string;
  @ApiProperty() title: string;
  @ApiProperty({ enum: LessonType }) type: LessonType;
  @ApiProperty() order: number;
  @ApiProperty() isPreview: boolean;
  @ApiPropertyOptional() duration?: number | null;
  @ApiPropertyOptional() muxPlaybackId?: string | null;
  @ApiPropertyOptional() muxStatus?: string | null;
  @ApiPropertyOptional() fileName?: string | null;
  @ApiPropertyOptional() fileSizeBytes?: number | null;
  @ApiPropertyOptional() fileMimeType?: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static from(lesson: LessonWithoutContent): LessonResponseDto {
    const dto = new LessonResponseDto();
    dto.id            = lesson.id;
    dto.moduleId      = lesson.moduleId;
    dto.title         = lesson.title;
    dto.type          = lesson.type;
    dto.order         = lesson.order;
    dto.isPreview     = lesson.isPreview;
    dto.duration      = lesson.duration;
    dto.muxPlaybackId = lesson.muxPlaybackId;
    dto.muxStatus     = lesson.muxStatus;
    dto.fileName      = lesson.fileName;
    dto.fileSizeBytes = lesson.fileSizeBytes;
    dto.fileMimeType  = lesson.fileMimeType;
    dto.createdAt     = lesson.createdAt;
    dto.updatedAt     = lesson.updatedAt;
    return dto;
  }
}

export class ModuleResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() courseId: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional() description?: string | null;
  @ApiProperty() order: number;
  @ApiProperty({ type: [LessonResponseDto] }) lessons: LessonResponseDto[];
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static from(mod: ModuleWithLessons): ModuleResponseDto {
    const dto = new ModuleResponseDto();
    dto.id          = mod.id;
    dto.courseId    = mod.courseId;
    dto.title       = mod.title;
    dto.description = mod.description;
    dto.order       = mod.order;
    dto.lessons     = (mod.lessons ?? []).map(LessonResponseDto.from);
    dto.createdAt   = mod.createdAt;
    dto.updatedAt   = mod.updatedAt;
    return dto;
  }
}

export class CourseResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() tenantId: string;
  @ApiPropertyOptional() authorId?: string | null;
  @ApiPropertyOptional() authorName?: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional() description?: string | null;
  @ApiPropertyOptional() thumbnailUrl?: string | null;
  @ApiProperty({ enum: CourseStatus }) status: CourseStatus;
  @ApiProperty() totalLessons: number;
  @ApiPropertyOptional() enrollmentCount?: number;
  @ApiPropertyOptional({ type: [ModuleResponseDto] }) modules?: ModuleResponseDto[];

  /**
   * Solo presente en listados para el usuario autenticado.
   * Indica si el usuario actual ya está inscrito en este curso.
   * Elimina la necesidad de una segunda llamada a /enrollments/my en el catálogo.
   */
  @ApiPropertyOptional() isEnrolled?: boolean;

  /**
   * Progreso del usuario actual (0–100). Solo presente si isEnrolled=true.
   */
  @ApiPropertyOptional() myProgress?: number;

  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static from(course: CourseWithRelations): CourseResponseDto {
    const dto = new CourseResponseDto();
    dto.id              = course.id;
    dto.tenantId        = course.tenantId;
    dto.authorId        = course.authorId;
    dto.title           = course.title;
    dto.description     = course.description;
    dto.thumbnailUrl    = course.thumbnailUrl;
    dto.status          = course.status;
    dto.totalLessons    = course.totalLessons;
    dto.enrollmentCount = course._count?.enrollments;
    dto.createdAt       = course.createdAt;
    dto.updatedAt       = course.updatedAt;

    if (course.author) {
      dto.authorName = `${course.author.firstName} ${course.author.lastName}`;
    }
    if (course.modules) {
      dto.modules = course.modules.map(ModuleResponseDto.from);
    }
    return dto;
  }
}
