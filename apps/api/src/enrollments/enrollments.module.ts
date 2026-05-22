import { Module } from '@nestjs/common';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';
import { CertificatesModule } from '../certificates/certificates.module';

// NotificationsGateway se inyecta vía @Global() — no necesita importar NotificationsModule aquí.
@Module({
  imports:     [CertificatesModule],
  controllers: [EnrollmentsController],
  providers:   [EnrollmentsService],
  exports:     [EnrollmentsService],
})
export class EnrollmentsModule {}
