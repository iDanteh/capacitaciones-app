import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * NotificationsGateway — WebSocket gateway multi-tenant con Socket.IO.
 *
 * Autenticación: el cliente envía el access_token JWT en handshake.auth.token.
 * Aislamiento multi-tenant: cada cliente se une a la room `tenant:{tenantId}`.
 * Los eventos se emiten siempre a la room, nunca a sockets individuales.
 *
 * Eventos emitidos (desde otros servicios vía emitToTenant):
 *  - `video.ready`           → Mux terminó de procesar un video
 *  - `enrollment.completed`  → Un empleado completó un curso
 *
 * @example (cliente)
 *   const sock = io('http://localhost:5000/notifications', {
 *     auth: { token: localStorage.getItem('access_token') },
 *   });
 *   sock.on('video.ready', ({ lessonId, lessonTitle, muxPlaybackId }) => { ... });
 */
@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5001',
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth as { token?: string })?.token ??
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`WS rechazado (sin token): ${client.id}`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<{ sub: string; tenantId: string }>(token, {
        secret: this.config.get<string>('jwt.secret'),
      });

      client.data.tenantId = payload.tenantId;
      client.data.userId   = payload.sub;

      // Room del tenant — para broadcast general (video.ready, enrollment.completed)
      await client.join(`tenant:${payload.tenantId}`);
      // Room personal — para notificaciones dirigidas al usuario específico
      await client.join(`user:${payload.sub}`);

      this.logger.debug(`WS conectado: ${client.id} (tenant: ${payload.tenantId}, user: ${payload.sub})`);
    } catch {
      this.logger.warn(`WS rechazado (token inválido): ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`WS desconectado: ${client.id}`);
  }

  /**
   * Emite un evento a todos los sockets conectados del tenant.
   * Usado para eventos generales: video.ready, enrollment.completed.
   */
  emitToTenant(tenantId: string, event: string, data: unknown): void {
    this.server?.to(`tenant:${tenantId}`).emit(event, data);
    this.logger.debug(`WS emit → tenant:${tenantId} | ${event}`);
  }

  /**
   * Emite un evento al socket personal del usuario.
   * Usado para notificaciones dirigidas: notification.new, reset_approved, etc.
   */
  emitToUser(userId: string, event: string, data: unknown): void {
    this.server?.to(`user:${userId}`).emit(event, data);
    this.logger.debug(`WS emit → user:${userId} | ${event}`);
  }
}
