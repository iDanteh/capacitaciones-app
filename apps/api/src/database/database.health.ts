import { Injectable, Logger } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from './prisma.service';

/**
 * Indicador de salud para la base de datos.
 *
 * Ejecuta un `SELECT 1` liviano para verificar que la conexión está activa.
 * Es consumido por HealthController via el módulo Terminus.
 *
 * Patrón: Strategy (HealthIndicator) — cada indicador es intercambiable.
 */
@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(DatabaseHealthIndicator.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (error) {
      this.logger.error('Database health check failed', error);
      throw new HealthCheckError(
        'Database connection failed',
        this.getStatus(key, false),
      );
    }
  }
}
