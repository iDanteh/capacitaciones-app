import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

/**
 * Wrapper de PrismaClient que integra con el ciclo de vida de NestJS.
 *
 * Responsabilidades:
 *  1. Abrir/cerrar la conexión al iniciar/detener la app (lifecycle hooks).
 *  2. Log de queries SQL en desarrollo para facilitar debugging.
 *  3. Exponer `setTenantContext` para Row Level Security (RLS).
 *
 * Patrón: Service Layer + Singleton (garantizado por el módulo @Global).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly config: ConfigService) {
    super({
      datasources: {
        db: { url: config.getOrThrow<string>('database.url') },
      },
      log: [
        // 'event' emite el log como evento para que podamos capturarlo y formatearlo.
        // 'stdout' deja que Prisma maneje errors y warnings directamente.
        { emit: 'event',  level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn'  },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conexión a la base de datos establecida');
    this.registerQueryLogger();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Conexión a la base de datos cerrada');
  }

  /**
   * Establece el tenant activo en la sesión de PostgreSQL.
   *
   * PostgreSQL RLS usa esta variable para filtrar filas automáticamente.
   * El `true` como tercer argumento limita el valor a la transacción actual,
   * garantizando que no se filtre entre requests concurrentes.
   *
   * Debe invocarse en el TenantMiddleware antes de que llegue al controller.
   *
   * @see docs/rls.md
   */
  async setTenantContext(tenantId: string): Promise<void> {
    await this.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
  }

  /**
   * Registra un listener de queries SQL.
   * Solo activo en desarrollo — en producción sería demasiado noise y
   * podría exponer datos sensibles en logs.
   */
  private registerQueryLogger(): void {
    if (this.config.get<string>('nodeEnv') !== 'development') return;

    // El cast a `never` es necesario porque Prisma 5 no exporta el tipo
    // del evento 'query' directamente, pero la firma es estable.
    this.$on('query' as never, (event: { query: string; duration: number }) => {
      this.logger.debug(`(${event.duration}ms) ${event.query}`);
    });
  }
}
