import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { DatabaseHealthIndicator } from './database.health';

/**
 * Módulo de base de datos — disponible globalmente en toda la app.
 *
 * `@Global()` elimina la necesidad de importar este módulo en cada feature module.
 * PrismaService actúa como el único punto de acceso a la DB (Single Responsibility).
 *
 * Exports:
 *  - PrismaService          → para queries en cualquier módulo
 *  - DatabaseHealthIndicator → para el health check en HealthModule
 */
@Global()
@Module({
  providers: [PrismaService, DatabaseHealthIndicator],
  exports:   [PrismaService, DatabaseHealthIndicator],
})
export class DatabaseModule {}
