import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

type UploadFolder = 'thumbnails' | 'lessons' | 'avatars' | 'logos';

export class PresignedUploadDto {
  @ApiProperty({
    description: 'Nombre original del archivo (ej: "video.mp4")',
    example: 'intro-react.mp4',
  })
  @IsString()
  fileName: string;

  @ApiProperty({
    description: 'Carpeta destino en el bucket',
    enum: ['thumbnails', 'lessons', 'avatars', 'logos'],
  })
  @IsIn(['thumbnails', 'lessons', 'avatars', 'logos'])
  folder: UploadFolder;

  @ApiPropertyOptional({ description: 'MIME type del archivo' })
  @IsOptional()
  @IsString()
  contentType?: string;

  /**
   * Si es true, el objeto se almacena bajo el prefijo `public/`
   * que tiene acceso anónimo de lectura (configurado en minio-init).
   * Usar para miniaturas de cursos y avatares.
   * No usar para archivos de lecciones (requieren URL firmada).
   */
  @ApiPropertyOptional({ description: 'Si true, el objeto será accesible públicamente sin firma' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
