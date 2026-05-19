import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { TenantMiddleware } from './middleware/tenant.middleware';

/**
 * Módulo de multi-tenancy.
 *
 * Responsabilidades:
 *  1. Exponer TenantsService al resto de la app (exports).
 *  2. Registrar TenantMiddleware en todas las rutas excepto las de auth.
 *
 * El middleware se excluye de las rutas de auth porque:
 *  - /auth/register: crea un tenant nuevo, no necesita uno existente.
 *  - /auth/login: identifica el tenant por el body (tenantSlug), no por header.
 *  - /auth/refresh: opera sobre RefreshToken (sin tenantId), no necesita RLS.
 *  - /auth/logout: igual que refresh.
 *  - /health: monitoreo, sin datos de tenant.
 *
 * Para el resto de rutas: si el cliente envía X-Tenant-Slug, el middleware
 * activa RLS. Si no lo envía, pasa sin contexto (el guard de JWT protege
 * el acceso a datos).
 */
@Module({
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        // Rutas de auth — gestionan el tenant de forma distinta al middleware
        { path: 'auth/register', method: RequestMethod.POST },
        { path: 'auth/login',    method: RequestMethod.POST },
        { path: 'auth/refresh',  method: RequestMethod.POST },
        { path: 'auth/logout',   method: RequestMethod.POST },
        // Health check — sin contexto de tenant
        { path: 'health',        method: RequestMethod.GET  },
        { path: 'health/(.*)',   method: RequestMethod.GET  },
      )
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
