import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

/**
 * NotificationsModule — WebSocket en tiempo real + notificaciones persistentes.
 *
 * @Global garantiza una única instancia en toda la aplicación.
 *
 * Exporta tanto el Gateway como el Service:
 *  - NotificationsGateway: para emit directo de eventos WS (video, enrollment).
 *  - NotificationsService: para crear/persistir notificaciones desde cualquier módulo.
 *
 * Patrón: módulos que quieran notificar a usuarios inyectan NotificationsService
 * sin importar este módulo (gracias al @Global).
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
      }),
    }),
  ],
  controllers: [NotificationsController],
  providers:   [NotificationsGateway, NotificationsService],
  exports:     [NotificationsGateway, NotificationsService],
})
export class NotificationsModule {}
