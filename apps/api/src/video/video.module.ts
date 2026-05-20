import { Module } from '@nestjs/common';
import { VideoController } from './video.controller';
import { MuxService } from './mux.service';

@Module({
  controllers: [VideoController],
  providers:   [MuxService],
  exports:     [MuxService],
})
export class VideoModule {}
