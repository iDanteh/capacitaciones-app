import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import Mux from '@mux/mux-node';

/**
 * MuxService — wrapper del SDK oficial de Mux para video.
 *
 * Flujo de upload de video:
 *  1. Frontend solicita un Direct Upload URL → POST /video/upload-url
 *  2. MuxService crea un DirectUpload en Mux y devuelve la URL.
 *  3. Frontend sube el video directamente a Mux (sin pasar por el API).
 *  4. Mux procesa el video de forma asíncrona.
 *  5. Mux envía un webhook a POST /video/webhook cuando el asset está listo.
 *  6. El webhook actualiza la lección con muxAssetId, muxPlaybackId y muxStatus.
 *
 * El player del frontend usa muxPlaybackId con @mux/mux-player-react.
 */
@Injectable()
export class MuxService {
  private readonly logger = new Logger(MuxService.name);
  private readonly mux: Mux | null = null;
  private readonly webhookSecret: string;

  constructor(private readonly config: ConfigService) {
    const tokenId     = config.get<string>('mux.tokenId');
    const tokenSecret = config.get<string>('mux.tokenSecret');
    this.webhookSecret = config.get<string>('mux.webhookSecret', '');

    if (tokenId && tokenSecret) {
      this.mux = new Mux({ tokenId, tokenSecret });
    } else {
      this.logger.warn('MUX_TOKEN_ID/MUX_TOKEN_SECRET no configurados — VideoModule en modo mock');
    }
  }

  /**
   * Crea un Direct Upload URL en Mux.
   * El cliente sube el video directamente a esta URL (sin pasar por el API).
   *
   * @param corsOrigin  - Origen permitido para el upload (URL del frontend)
   * @returns uploadUrl y uploadId para rastrear el asset
   */
  async createDirectUpload(corsOrigin: string): Promise<{ uploadUrl: string; uploadId: string }> {
    if (!this.mux) {
      // Modo mock para desarrollo sin cuenta Mux
      return {
        uploadUrl: 'https://mock-mux-upload-url.example.com/upload',
        uploadId:  `mock_upload_${Date.now()}`,
      };
    }

    const upload = await this.mux.video.uploads.create({
      cors_origin:        corsOrigin,
      new_asset_settings: {
        playback_policy: ['public'],
        mp4_support:     'standard',
      },
    });

    return {
      uploadUrl: upload.url,
      uploadId:  upload.id,
    };
  }

  /**
   * Obtiene el asset de Mux dado un upload ID.
   * Necesario en el webhook para ligar asset → lección.
   */
  async getAssetByUploadId(uploadId: string) {
    if (!this.mux) return null;

    const upload = await this.mux.video.uploads.retrieve(uploadId);
    if (!upload.asset_id) return null;

    return this.mux.video.assets.retrieve(upload.asset_id);
  }

  /**
   * Elimina un asset de Mux (al eliminar una lección de video).
   */
  async deleteAsset(assetId: string): Promise<void> {
    if (!this.mux) return;
    try {
      await this.mux.video.assets.delete(assetId);
    } catch (error) {
      this.logger.warn(`No se pudo eliminar el asset Mux "${assetId}":`, error);
    }
  }

  /**
   * Verifica la firma del webhook de Mux usando HMAC-SHA256.
   *
   * Formato de la cabecera `mux-signature`: t=<timestamp>,v1=<hash>
   * El payload firmado es: `<timestamp>.<body>`
   *
   * Usar timingSafeEqual para evitar timing attacks en la comparación.
   */
  verifyWebhookSignature(body: string, signature: string): boolean {
    if (!this.webhookSecret) return true; // Dev sin secret configurado

    try {
      const parts     = signature.split(',');
      const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
      const hash      = parts.find(p => p.startsWith('v1='))?.slice(3);

      if (!timestamp || !hash) return false;

      const expected = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(`${timestamp}.${body}`)
        .digest('hex');

      // timingSafeEqual requiere buffers del mismo tamaño
      const expectedBuf = Buffer.from(expected, 'hex');
      const receivedBuf = Buffer.from(hash, 'hex');

      if (expectedBuf.length !== receivedBuf.length) return false;

      return crypto.timingSafeEqual(expectedBuf, receivedBuf);
    } catch {
      return false;
    }
  }
}
