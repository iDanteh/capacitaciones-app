import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StorageService } from './storage.service';
import { PresignedUploadDto } from './dto/presigned-upload.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import * as crypto from 'crypto';

const ALLOWED_EXTENSIONS: Record<string, Set<string>> = {
  thumbnails: new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']),
  avatars:    new Set(['jpg', 'jpeg', 'png', 'webp']),
  logos:      new Set(['jpg', 'jpeg', 'png', 'webp', 'svg']),
  lessons:    new Set(['mp4', 'webm', 'mov', 'pdf', 'zip']),
};

@ApiTags('Storage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'storage', version: '1' })
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Genera un presigned URL para que el cliente suba un archivo directamente a MinIO.
   *
   * Flujo:
   *  1. Cliente llama a este endpoint con el nombre y carpeta del archivo.
   *  2. Backend genera un object key único (carpeta/uuid.ext) y devuelve el URL firmado.
   *  3. Cliente hace PUT al URL firmado con el archivo (sin pasar por el API).
   *  4. Cliente guarda el `key` y lo envía al crear/editar la lección/curso.
   */
  @Post('presigned-upload')
  @ApiOperation({ summary: 'Obtener URL firmada para subir archivo directamente a MinIO' })
  async getPresignedUpload(
    @Body() dto: PresignedUploadDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const ext = (dto.fileName.split('.').pop() ?? '').toLowerCase();
    const allowed = ALLOWED_EXTENSIONS[dto.folder];
    if (!ext || !allowed?.has(ext)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido para la carpeta "${dto.folder}". ` +
        `Permitidos: ${[...(allowed ?? [])].join(', ')}.`,
      );
    }

    const uuid   = crypto.randomUUID();
    // Los objetos públicos van bajo public/ para que la policy anónima de MinIO los exponga.
    const prefix = dto.isPublic ? 'public' : 'private';
    const key    = `${prefix}/${dto.folder}/${user.tenantId}/${uuid}.${ext}`;
    const uploadUrl = await this.storageService.getPresignedUploadUrl(key);

    return {
      uploadUrl,
      key,
      publicUrl: this.storageService.getPublicUrl(key),
    };
  }

  /**
   * Genera un presigned URL para descargar/visualizar un archivo privado.
   * Útil para lecciones de tipo FILE que no están en la carpeta pública.
   */
  @Get('presigned-download/:key(*)')
  @ApiOperation({ summary: 'Obtener URL firmada para descargar un archivo' })
  async getPresignedDownload(
    @Param('key') key: string,
    @CurrentUser() _user: JwtPayload,
  ) {
    const downloadUrl = await this.storageService.getPresignedDownloadUrl(key);
    return { downloadUrl };
  }
}
