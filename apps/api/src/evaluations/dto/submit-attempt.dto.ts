import { IsString, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AnswerDto {
  @ApiProperty({ description: 'ID de la pregunta' })
  @IsString()
  questionId: string;

  @ApiProperty({ description: 'ID de la opción seleccionada' })
  @IsString()
  optionId: string;
}

export class SubmitAttemptDto {
  @ApiProperty({ description: 'ID del enrollment del usuario' })
  @IsString()
  enrollmentId: string;

  @ApiProperty({ type: [AnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];
}
