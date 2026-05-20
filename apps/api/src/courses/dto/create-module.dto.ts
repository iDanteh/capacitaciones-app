import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateModuleDto {
  @ApiProperty({ example: 'Módulo 1: Fundamentos' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  title: string;

  @ApiPropertyOptional({ example: 'Conceptos básicos de React y JSX.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
