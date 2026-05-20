import {
  Body, Controller, Headers, Logger, Param, Patch, Post, RawBodyRequest,
  Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { MuxService } from './mux.service';
import { PrismaService } from '../database/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class CreateUploadDto {
  @ApiProperty({ description: 'ID de la lección a la que pertenecerá el video' })
  @IsString()
  lessonId: string;
}

@ApiTags('Video')
@Controller({ path: 'video', version: '1' })
export class VideoController {
  private readonly logger = new Logger(VideoController.name);

  constructor(
    private readonly muxService: MuxService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Crea un Direct Upload URL en Mux para que el cliente suba el video.
   * Almacena el uploadId en la lección para ligar el webhook posterior.
   */
  @Post('upload-url')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Obtener URL de upload directo a Mux' })
  async createUploadUrl(
    @Body() dto: CreateUploadDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const corsOrigin = process.env.FRONTEND_URL ?? 'http://localhost:5001';

    const { uploadUrl, uploadId } = await this.muxService.createDirectUpload(corsOrigin);

    // Marcar la lección como "preparando" y guardar el uploadId como assetId temporal
    await this.prisma.lesson.updateMany({
      where: { id: dto.lessonId, tenantId: user.tenantId },
      data:  { muxAssetId: uploadId, muxStatus: 'preparing' },
    });

    return { uploadUrl, uploadId };
  }

  /**
   * Webhook de Mux — recibe notificaciones del estado de los videos.
   *
   * Eventos manejados:
   *  - video.asset.ready   → el video está listo para reproducción
   *  - video.asset.errored → el procesamiento falló
   *
   * No requiere autenticación JWT — usa firma HMAC verificada por MuxService.
   */
  @Post('webhook')
  @ApiOperation({ summary: 'Webhook de Mux (no requiere auth)' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('mux-signature') signature: string,
  ) {
    const rawBody = req.rawBody?.toString() ?? '';

    if (!this.muxService.verifyWebhookSignature(rawBody, signature)) {
      this.logger.warn('Webhook de Mux con firma inválida rechazado');
      return { received: false };
    }

    const payload = JSON.parse(rawBody);
    const { type, data } = payload;

    this.logger.debug(`Webhook Mux: ${type}`);

    if (type === 'video.asset.ready') {
      const assetId    = data.id as string;
      const playbackId = (data.playback_ids?.[0]?.id ?? '') as string;
      const duration   = Math.round((data.duration ?? 0) as number);

      // El uploadId fue guardado como muxAssetId temporal → reemplazar con el assetId real
      await this.prisma.lesson.updateMany({
        where: { muxAssetId: data.upload_id ?? assetId },
        data: {
          muxAssetId:    assetId,
          muxPlaybackId: playbackId,
          muxStatus:     'ready',
          duration,
        },
      });

      this.logger.log(`Video listo: asset ${assetId}, playback ${playbackId}`);
    }

    if (type === 'video.asset.errored') {
      const assetId = data.id as string;
      await this.prisma.lesson.updateMany({
        where: { muxAssetId: assetId },
        data:  { muxStatus: 'errored' },
      });
      this.logger.error(`Video con error en Mux: asset ${assetId}`);
    }

    return { received: true };
  }

  /**
   * Permite al admin vincular manualmente un playbackId de Mux a una lección.
   * Útil para migrar videos existentes.
   */
  @Patch('lessons/:lessonId/playback')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Vincular manualmente playbackId de Mux a una lección' })
  async setPlaybackId(
    @Param('lessonId') lessonId: string,
    @Body() body: { muxAssetId: string; muxPlaybackId: string; duration?: number },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.prisma.lesson.updateMany({
      where: { id: lessonId, tenantId: user.tenantId },
      data: {
        muxAssetId:    body.muxAssetId,
        muxPlaybackId: body.muxPlaybackId,
        muxStatus:     'ready',
        duration:      body.duration,
      },
    });
  }
}
