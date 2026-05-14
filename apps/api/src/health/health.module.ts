import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

/**
 * DatabaseHealthIndicator no se declara aquí porque DatabaseModule es @Global
 * y ya lo exporta — NestJS lo resuelve automáticamente por inyección de dependencias.
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
