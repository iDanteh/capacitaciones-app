import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class ReorderDto {
  @ApiProperty({
    description: 'Array de IDs en el nuevo orden deseado',
    example: ['id1', 'id2', 'id3'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  orderedIds: string[];
}
