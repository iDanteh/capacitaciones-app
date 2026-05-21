import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationsGateway } from './notifications.gateway';

/**
 * NotificationsModule — gestión de conexiones WebSocket en tiempo real.
 * @Global garantiza una única instancia del gateway en toda la aplicación.
 *
 * Exporta NotificationsGateway para que otros módulos puedan inyectarlo
 * y emitir eventos a sus tenants sin acoplarse al transport layer.
 *
 * Patrón: otros módulos importan NotificationsModule y reciben el gateway
 * listo para usar. Esto evita la dependencia circular al no re-exportar
 * toda la infraestructura WS, solo el gateway.
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
  providers: [NotificationsGateway],
  exports:   [NotificationsGateway],
})
export class NotificationsModule {}
