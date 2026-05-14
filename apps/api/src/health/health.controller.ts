import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from '../database/database.health';

@ApiTags('Health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly db: DatabaseHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Verifica el estado de la API y sus dependencias' })
  check() {
    return this.health.check([
      // Máximo 300MB de heap — alerta temprana de memory leaks
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
      // Ping a PostgreSQL — falla rápido si hay problemas de conexión
      () => this.db.isHealthy('database'),
    ]);
  }
}
