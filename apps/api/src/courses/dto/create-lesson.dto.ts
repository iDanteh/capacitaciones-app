import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, MinLength,
} from 'class-validator';
import { LessonType } from '@prisma/client';

export class CreateLessonDto {
  @ApiProperty({ example: '¿Qué es React?' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @ApiProperty({ enum: LessonType, default: LessonType.TEXT })
  @IsEnum(LessonType)
  type: LessonType;

  @ApiPropertyOptional({ description: 'Contenido Markdown (solo para type=TEXT)' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Duración en segundos' })
  @IsOptional()
  @IsInt()
  duration?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPreview?: boolean;

  // ── Archivo (type=FILE) ───────────────────────────────────────────────────
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  fileSizeBytes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileMimeType?: string;
}
