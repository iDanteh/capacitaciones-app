import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, Min, Max, IsArray, IsDateString, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateQuizDto {
  @IsString() @IsNotEmpty() title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() instructions?: string;
  @IsOptional() @IsInt() @Min(30) timeLimit?: number;
  @IsInt() @Min(0) @Max(100) minScore: number = 70;
}

export class UpdateQuizDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() instructions?: string;
  @IsOptional() @IsInt() @Min(30) timeLimit?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) minScore?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateQuizOptionDto {
  @IsString() text: string;
  @IsBoolean() isCorrect: boolean;
  @IsOptional() @IsInt() order?: number;
}

export class AddQuizQuestionDto {
  @IsString() @IsNotEmpty() text: string;
  @IsOptional() @IsString() explanation?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CreateQuizOptionDto) @ArrayMinSize(2)
  options: CreateQuizOptionDto[];
}

export class UpdateQuizQuestionDto {
  @IsOptional() @IsString() text?: string;
  @IsOptional() @IsString() explanation?: string;
}

export class ReorderQuizQuestionsDto {
  @IsArray() @IsString({ each: true }) orderedIds: string[];
}

export class AssignQuizDto {
  @IsArray() @IsString({ each: true }) @ArrayMinSize(1) userIds: string[];
  @IsOptional() @IsDateString() dueDate?: string;
}

export class SubmitQuizAttemptDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => QuizAnswerDto)
  answers: QuizAnswerDto[];
}

export class QuizAnswerDto {
  @IsString() questionId: string;
  @IsString() optionId: string;
}
