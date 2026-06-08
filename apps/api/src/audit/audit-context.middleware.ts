import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuditContextService } from './audit-context.service';

/**
 * Middleware que captura IP y User-Agent de cada request HTTP
 * y los hace disponibles para el AuditService via AsyncLocalStorage.
 *
 * Se aplica a todas las rutas desde AuditModule.configure().
 */
@Injectable()
export class AuditContextMiddleware implements NestMiddleware {
  constructor(private readonly ctx: AuditContextService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    // X-Forwarded-For puede tener múltiples IPs separadas por coma (proxies encadenados).
    // La primera es la IP original del cliente.
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ??
      req.socket.remoteAddress ??
      'unknown';

    const ua = (req.headers['user-agent'] as string | undefined) ?? 'unknown';

    // Wrappear el resto del pipeline dentro del contexto de AsyncLocalStorage
    this.ctx.run({ ipAddress: ip, userAgent: ua }, next);
  }
}
