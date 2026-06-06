import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditContextService } from './audit-context.service';
import { AuditLogParams } from './audit.types';

/**
 * Servicio de auditoría.
 *
 * Diseño fire-and-forget:
 *  - `log()` es síncrono desde la perspectiva del llamador (devuelve void).
 *  - La escritura en BD se despacha con setImmediate(), fuera del event loop
 *    de la request actual, para no bloquear el response al usuario.
 *  - Nunca propaga errores de escritura — un log fallido no debe romper la
 *    operación principal.
 *
 * El contexto HTTP (IP, User-Agent) se captura síncronamente desde
 * AsyncLocalStorage antes de salir del scope de la request, y se pasa
 * al callback asíncrono de forma segura.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx:    AuditContextService,
  ) {}

  /**
   * Registra una acción de auditoría de forma no bloqueante.
   *
   * @example
   * this.audit.log({
   *   action:   AuditAction.USER_LOGIN,
   *   userId:   user.id,
   *   tenantId: tenant.id,
   *   meta:     { email: user.email },
   * });
   */
  log(params: AuditLogParams): void {
    // Captura síncrona — el AsyncLocalStorage scope puede expirar antes
    // de que el setImmediate se ejecute, así que leemos aquí.
    const { ipAddress, userAgent } = this.ctx.get();

    setImmediate(async () => {
      try {
        await this.prisma.auditLog.create({
          data: {
            action:    params.action,
            userId:    params.userId   ?? null,
            tenantId:  params.tenantId ?? null,
            entity:    params.entity   ?? null,
            entityId:  params.entityId ?? null,
            meta:      params.meta as Prisma.InputJsonValue ?? undefined,
            ipAddress: ipAddress       ?? null,
            userAgent: userAgent       ?? null,
          },
        });
      } catch (err) {
        // Fallar silenciosamente — la operación principal ya fue completada.
        this.logger.error(
          `Audit log failed [${params.action}]: ${(err as Error).message}`,
        );
      }
    });
  }
}
