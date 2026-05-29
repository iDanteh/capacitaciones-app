import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { InviteUserDto } from './invite-user.dto';

/**
 * DTO para importación masiva de usuarios vía CSV.
 * El frontend parsea el CSV y envía el array ya estructurado.
 * Límite: 100 usuarios por request para evitar timeouts y saturar el servicio de email.
 */
export class BulkInviteDto {
  @IsArray()
  @ArrayMinSize(1,   { message: 'Debes incluir al menos un usuario' })
  @ArrayMaxSize(100, { message: 'Máximo 100 usuarios por importación' })
  @ValidateNested({ each: true })
  @Type(() => InviteUserDto)
  users: InviteUserDto[];
}
