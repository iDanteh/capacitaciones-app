import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

/**
 * StorageService — abstracción sobre MinIO (S3-compatible).
 *
 * En desarrollo: MinIO local (docker compose).
 * En producción: cambiar las env vars STORAGE_* a Backblaze B2 o AWS S3.
 * El código NO cambia — solo las variables de entorno.
 *
 * Patrón de upload (presigned PUT):
 *  1. Frontend pide un presigned URL al backend → POST /storage/presigned-upload
 *  2. Backend genera la URL firmada con tiempo de vida limitado.
 *  3. Frontend sube el archivo DIRECTAMENTE a MinIO (sin pasar por el API).
 *  4. Frontend notifica al backend con el `key` del objeto subido.
 *  5. Backend guarda el `key` en la DB (Lesson.fileKey, Course.thumbnailKey, etc.).
 *
 * Este patrón evita que los archivos pasen por el servidor Node.js,
 * reduciendo latencia y consumo de memoria del API.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: Minio.Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const rawEndpoint = config.get<string>('storage.endpoint', 'localhost');
    const accessKey   = config.get<string>('storage.accessKey', 'minioadmin');
    const secretKey   = config.get<string>('storage.secretKey', 'minioadmin');

    this.bucket = config.get<string>('storage.bucket', 'lms-files');

    // Normalizar endpoint: el cliente MinIO espera solo hostname, sin protocolo ni puerto.
    // Soportamos tanto "localhost" como "http://localhost:9000" en STORAGE_ENDPOINT.
    let endPoint = rawEndpoint;
    let port     = config.get<number>('storage.port', 9000);
    let useSSL   = config.get<string>('storage.useSSL', 'false') === 'true';

    if (rawEndpoint.includes('://')) {
      const url = new URL(rawEndpoint);
      endPoint = url.hostname;
      if (url.port) port = parseInt(url.port, 10);
      useSSL = url.protocol === 'https:';
    }

    this.client = new Minio.Client({
      endPoint,
      port:      typeof port === 'string' ? parseInt(port as string, 10) : port,
      useSSL,
      accessKey,
      secretKey,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucketExists();
  }

  // ── Presigned URLs ───────────────────────────────────────────────────────────

  /**
   * Genera un presigned URL para que el cliente suba un archivo directamente.
   * Expira en 15 minutos.
   *
   * @param key  - Object key destino (ej: "thumbnails/abc123.jpg")
   * @returns URL de PUT firmada
   */
  async getPresignedUploadUrl(key: string): Promise<string> {
    return this.client.presignedPutObject(this.bucket, key, 15 * 60);
  }

  /**
   * Genera un presigned URL para descarga temporal.
   * Expira en 1 hora.
   */
  async getPresignedDownloadUrl(key: string): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, 60 * 60);
  }

  /**
   * URL pública (sin firma) para objetos en la carpeta public/.
   * Se configura via mc anonymous set download en el init de Docker.
   */
  getPublicUrl(key: string): string {
    const base = this.config.get<string>('storage.publicUrl', 'http://localhost:9000/lms-files');
    return `${base}/${key}`;
  }

  // ── Gestión de objetos ───────────────────────────────────────────────────────

  async deleteFile(key: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucket, key);
    } catch (error) {
      // No lanzar error si el objeto no existe — operación idempotente.
      this.logger.warn(`No se pudo eliminar el objeto "${key}":`, error);
    }
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch {
      return false;
    }
  }

  // ── Inicialización ───────────────────────────────────────────────────────────

  private async ensureBucketExists(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, 'us-east-1');
        this.logger.log(`Bucket "${this.bucket}" creado`);
      } else {
        this.logger.debug(`Bucket "${this.bucket}" ya existe`);
      }
    } catch (error) {
      // En prod, si MinIO no está disponible al inicio no debe bloquear la app.
      this.logger.error('No se pudo conectar a MinIO:', error);
    }
  }
}
