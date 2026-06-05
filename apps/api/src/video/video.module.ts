import { Module } from '@nestjs/common';
import { VideoController } from './video.controller';
import { MuxService } from './mux.service';

// NotificationsGateway se inyecta vía @Global() — no necesita importar NotificationsModule aquí.
@Module({
  controllers: [VideoController],
  providers:   [MuxService],
  exports:     [MuxService],
})
export class VideoModule {}
