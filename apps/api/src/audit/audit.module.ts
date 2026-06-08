import { Global, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { AuditContextService } from './audit-context.service';
import { AuditContextMiddleware } from './audit-context.middleware';
import { AuditService } from './audit.service';

/**
 * Módulo global de auditoría.
 *
 * Al ser @Global, el AuditService queda disponible en todos los módulos
 * sin necesidad de importar AuditModule en cada uno.
 *
 * El AuditContextMiddleware se aplica a todas las rutas para capturar
 * IP y User-Agent via AsyncLocalStorage antes de que llegue al controlador.
 */
@Global()
@Module({
  providers: [AuditContextService, AuditContextMiddleware, AuditService],
  exports:   [AuditService],
})
export class AuditModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(AuditContextMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
