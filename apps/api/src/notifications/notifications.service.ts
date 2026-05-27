import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationType, UserRole, Prisma } from '@prisma/client';

export interface NotificationDto {
  id:        string;
  type:      string;
  title:     string;
  body:      string;
  data:      unknown;
  readAt:    Date | null;
  createdAt: Date;
}

/**
 * NotificationsService — persistencia y despacho de notificaciones.
 *
 * Flujo:
 *  1. Un servicio llama a `createForUser` o `createForAdmins`.
 *  2. La notificación se persiste en BD (garantía de entrega).
 *  3. Se emite en tiempo real al socket del usuario (`notification.new`).
 *  4. El cliente HTTP (campana) puede obtener el historial con `findForUser`.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma:   PrismaService,
    private readonly gateway:  NotificationsGateway,
  ) {}

  // ── Creación ──────────────────────────────────────────────────────────────────

  /** Crea y emite una notificación para un usuario específico. */
  async createForUser(
    userId:  string,
    tenantId: string,
    type:    NotificationType,
    title:   string,
    body:    string,
    data?:   Prisma.InputJsonValue,
  ): Promise<void> {
    const n = await this.prisma.notification.create({
      data: { userId, tenantId, type, title, body, data },
    });

    this.gateway.emitToUser(userId, 'notification.new', this.toDto(n));
    this.logger.debug(`Notif → usuario ${userId}: ${type}`);
  }

  /**
   * Crea y emite una notificación para TODOS los OWNER/ADMIN/MANAGER del tenant.
   * Cada admin recibe su propia copia persistida (para lecturas independientes).
   */
  async createForAdmins(
    tenantId: string,
    type:     NotificationType,
    title:    string,
    body:     string,
    data?:    Prisma.InputJsonValue,
  ): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: {
        tenantId,
        role:      { in: [UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER] },
        isActive:  true,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (admins.length === 0) return;

    // Crear individualmente para obtener IDs y emitir con datos completos
    await Promise.all(
      admins.map(async admin => {
        const n = await this.prisma.notification.create({
          data: { userId: admin.id, tenantId, type, title, body, data },
        });
        this.gateway.emitToUser(admin.id, 'notification.new', this.toDto(n));
      }),
    );

    this.logger.debug(`Notif → ${admins.length} admins (tenant ${tenantId}): ${type}`);
  }

  // ── Consulta ─────────────────────────────────────────────────────────────────

  async findForUser(
    userId:   string,
    tenantId: string,
    limit  = 25,
    offset = 0,
  ): Promise<{ notifications: NotificationDto[]; unreadCount: number }> {
    const [notifications, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where:   { userId, tenantId },
        orderBy: { createdAt: 'desc' },
        take:    limit,
        skip:    offset,
      }),
      this.prisma.notification.count({
        where: { userId, tenantId, readAt: null },
      }),
    ]);

    return { notifications: notifications.map(n => this.toDto(n)), unreadCount };
  }

  async getUnreadCount(userId: string, tenantId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, tenantId, readAt: null } });
  }

  // ── Acciones de lectura ──────────────────────────────────────────────────────

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data:  { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string, tenantId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, tenantId, readAt: null },
      data:  { readAt: new Date() },
    });
  }

  // ── Helper privado ────────────────────────────────────────────────────────────

  private toDto(n: {
    id: string; type: string; title: string; body: string;
    data: unknown; readAt: Date | null; createdAt: Date;
  }): NotificationDto {
    return {
      id:        n.id,
      type:      n.type,
      title:     n.title,
      body:      n.body,
      data:      n.data,
      readAt:    n.readAt,
      createdAt: n.createdAt,
    };
  }
}
