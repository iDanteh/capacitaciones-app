import {
  Injectable,
  Logger,
  NestMiddleware,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Tenant } from '@prisma/client';
import { TenantsService } from '../tenants.service';
import { PrismaService } from '../../database/prisma.service';

/**
 * Middleware de resolución de tenant y activación de Row Level Security.
 *
 * Flujo por request:
 *  1. Lee el header `X-Tenant-Slug`.
 *  2. Si no existe → next() sin contexto (rutas de auth funcionan sin él).
 *  3. Si existe → busca el tenant en BD.
 *  4. Si el tenant no existe o está inactivo → 404.
 *  5. Activa RLS en PostgreSQL para esta sesión: SET LOCAL app.current_tenant_id = '<id>'.
 *  6. Adjunta `req.tenant` para que los controllers puedan usarlo con @CurrentTenant().
 *
 * ¿Por qué no usamos exclude() en el módulo?
 *  Simplificar la configuración. La lógica "si no hay header, pasar" ya cubre
 *  las rutas de auth sin necesidad de listar paths a excluir, que son frágiles
 *  ante cambios de versión de la API.
 *
 * Seguridad:
 *  - RLS garantiza que aunque el middleware no esté activo, las queries
 *    de Prisma sin contexto devuelven 0 filas (no hay data leak entre tenants).
 *  - El tenantId en el JWT es una segunda barrera — siempre se valida.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  constructor(
    private readonly tenantsService: TenantsService,
    private readonly prisma: PrismaService,
  ) {}

  async use(
    req: Request & { tenant?: Tenant },
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    const slug = req.headers['x-tenant-slug'] as string | undefined;

    // Sin header → pasar sin contexto (cubre rutas públicas y de auth)
    if (!slug) {
      return next();
    }

    const tenant = await this.tenantsService.findBySlug(slug);

    if (!tenant) {
      throw new NotFoundException(
        `La empresa "${slug}" no existe o está inactiva.`,
      );
    }

    // Activar RLS en la sesión de PostgreSQL actual
    await this.prisma.setTenantContext(tenant.id);

    // Disponible en handlers via @CurrentTenant()
    req.tenant = tenant;

    this.logger.debug(`RLS activado → tenant: ${tenant.slug} (${tenant.id})`);

    next();
  }
}
