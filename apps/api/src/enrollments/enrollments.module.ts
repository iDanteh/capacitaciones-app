import { Module } from '@nestjs/common';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';

// NotificationsGateway se inyecta vía @Global() — no necesita importar NotificationsModule aquí.
@Module({
  controllers: [EnrollmentsController],
  providers:   [EnrollmentsService],
  exports:     [EnrollmentsService],
})
export class EnrollmentsModule {}
