import {
  IsString, IsOptional, IsInt, IsBoolean, Min, Max, MaxLength,
  IsArray, ArrayNotEmpty, ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateOptionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  text: string;

  @ApiProperty({ default: false })
  @IsBoolean()
  isCorrect: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class CreateQuestionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  text: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  points?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  explanation?: string;

  @ApiProperty({ type: [CreateOptionDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateOptionDto)
  options: CreateOptionDto[];
}

export class CreateEvaluationDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;

  @ApiPropertyOptional({ default: 70, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number = 70;

  @ApiPropertyOptional({ default: 3, description: '-1 = ilimitado' })
  @IsOptional()
  @IsInt()
  @Min(-1)
  maxAttempts?: number = 3;

  @ApiPropertyOptional({ description: 'Segundos límite. null = sin límite' })
  @IsOptional()
  @IsInt()
  @Min(30)
  timeLimit?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean = false;

  @ApiPropertyOptional({ type: [CreateQuestionDto] })
  @IsOptional()
  @Type(() => CreateQuestionDto)
  questions?: CreateQuestionDto[];
}

export class UpdateEvaluationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(-1)
  maxAttempts?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(30)
  timeLimit?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

/**
 * DTO para editar una pregunta existente.
 * Si se envían `options`, reemplaza todas las opciones existentes.
 * El servicio rechazará el cambio de opciones si ya existen intentos registrados.
 */
export class UpdateQuestionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  text?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  points?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  explanation?: string | null;

  @ApiPropertyOptional({ type: [CreateOptionDto], description: 'Si se envía, reemplaza todas las opciones.' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOptionDto)
  options?: CreateOptionDto[];
}

/** DTO para reordenar preguntas de una evaluación. */
export class ReorderQuestionsDto {
  @ApiProperty({ type: [String], description: 'IDs de preguntas en el nuevo orden.' })
  @IsArray()
  @ArrayNotEmpty()
  orderedIds: string[];
}

/** DTO para que un estudiante solicite reinicio de intentos. */
export class CreateResetRequestDto {
  @ApiPropertyOptional({ description: 'Mensaje opcional del estudiante al admin.', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
