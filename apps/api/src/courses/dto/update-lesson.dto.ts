import { PartialType } from '@nestjs/swagger';
import { CreateLessonDto } from './create-lesson.dto';

/**
 * DTO para actualizar una lección existente.
 *
 * Todos los campos son opcionales — el PATCH aplica solo lo que se envíe.
 * Patrón NestJS recomendado: PartialType hereda validadores y hace opcional cada campo.
 */
export class UpdateLessonDto extends PartialType(CreateLessonDto) {}
