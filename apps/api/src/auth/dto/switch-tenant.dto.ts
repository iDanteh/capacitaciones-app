import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SwitchTenantDto {
  @ApiProperty({ description: 'ID de la sub-empresa a la que se quiere acceder' })
  @IsString()
  @IsNotEmpty({ message: 'El ID de la empresa es requerido' })
  childTenantId: string;
}
