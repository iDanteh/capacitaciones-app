import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';

/**
 * CleanupService — tareas de mantenimiento programadas.
 *
 * Responsabilidades:
 *  - Eliminar invitaciones de usuario expiradas (sin aceptar) > 30 días
 *
 * La tabla `user_invites` no tiene soft delete ni TTL automático, por lo que
 * sin esta limpieza crecería indefinidamente. 30 días de gracia permite auditoría
 * antes de la eliminación definitiva.
 */
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Elimina invitaciones que expiraron hace más de 30 días y nunca fueron aceptadas.
   * Se ejecuta diariamente a las 03:00 UTC para no interferir con el tráfico.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredInvites() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    try {
      const { count } = await this.prisma.userInvite.deleteMany({
        where: {
          acceptedAt: null,
          expiresAt:  { lt: cutoff },
        },
      });

      if (count > 0) {
        this.logger.log(`Purged ${count} expired invite(s) older than 30 days`);
      }
    } catch (err) {
      this.logger.error('Failed to purge expired invites', err);
    }
  }
}
