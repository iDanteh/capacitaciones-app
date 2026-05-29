import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

/**
 * DTO para que el propio usuario actualice su perfil.
 * Solo permite cambiar nombre y avatar — no rol ni estado.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Nombre' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ description: 'Apellido' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ description: 'URL del avatar (https://...). Vacío para quitar.' })
  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/.+|^$/, {
    message: 'avatarUrl debe ser una URL válida (https://...) o vacío para quitar',
  })
  avatarUrl?: string;
}
