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

  /**
   * Elimina solicitudes de restablecimiento de contraseña expiradas hace más de 30 días.
   * Los registros usados o expirados ya no tienen valor tras ese período.
   * Se ejecuta junto al cron de invitaciones (03:00 UTC).
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredPasswordResets() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    try {
      const { count } = await this.prisma.passwordResetRequest.deleteMany({
        where: { expiresAt: { lt: cutoff } },
      });

      if (count > 0) {
        this.logger.log(`Purged ${count} expired password reset request(s) older than 30 days`);
      }
    } catch (err) {
      this.logger.error('Failed to purge expired password reset requests', err);
    }
  }

  /**
   * Elimina eventos de Stripe procesados hace más de 90 días.
   * La retención de 90 días cubre el período de reintentos de Stripe (72h).
   * Se ejecuta a las 03:00 UTC del primer día de cada mes.
   */
  @Cron('0 3 1 * *')
  async purgeOldStripeEvents() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    try {
      const { count } = await this.prisma.processedStripeEvent.deleteMany({
        where: { processedAt: { lt: cutoff } },
      });

      if (count > 0) {
        this.logger.log(`Purged ${count} old Stripe event record(s)`);
      }
    } catch (err) {
      this.logger.error('Failed to purge old Stripe events', err);
    }
  }
}
