import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class EnrollDto {
  @ApiProperty({ description: 'ID del curso al que inscribirse' })
  @IsString()
  courseId: string;
}

export class CompleteLessonDto {
  @ApiPropertyOptional({ description: 'Segundos visualizados (solo para lecciones de video)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  watchedSeconds?: number;
}
