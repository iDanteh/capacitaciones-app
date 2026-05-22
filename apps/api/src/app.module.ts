import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { SeederModule } from './seeder/seeder.module';
import { CoursesModule } from './courses/courses.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { StorageModule } from './storage/storage.module';
import { VideoModule } from './video/video.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { EvaluationsModule } from './evaluations/evaluations.module';
import { CertificatesModule } from './certificates/certificates.module';
import { NotificationsModule } from './notifications/notifications.module';
import configuration from './config/configuration';
import { validate } from './config/env.validation';

@Module({
  imports: [
    // ── Infraestructura ─────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,        // Disponible en toda la app via ConfigService
      load: [configuration],
      validate,
      envFilePath: '.env',
    }),
    DatabaseModule,          // @Global — PrismaService disponible en toda la app

    // ── Módulos de la aplicación ────────────────────────────────────────────
    HealthModule,

    // Fase 1 — Auth & Multi-tenancy:
    AuthModule,              // ✓ Registro, login, JWT + refresh tokens
    TenantsModule,           // ✓ Middleware RLS, resolución de tenant por header
    UsersModule,             // ✓ CRUD de usuarios, roles e invitaciones por email
    SubscriptionsModule,     // ✓ Planes, Stripe checkout/portal, storage add-ons, webhooks

    // Infra — Seed automático en desarrollo:
    SeederModule,            // ✓ OnApplicationBootstrap → seed idempotente en dev

    // Fase 2 — Core LMS:
    CoursesModule,           // ✓ Cursos, módulos y lecciones (CRUD completo)
    EnrollmentsModule,       // ✓ Inscripciones y tracking de progreso por lección
    StorageModule,           // ✓ MinIO presigned URLs (upload/download directo)
    VideoModule,             // ✓ Mux Direct Upload + webhooks de procesamiento

    // Fase 3 — Premium:
    AnalyticsModule,         // ✓ Reportes: overview, por curso, por empleado
    EvaluationsModule,       // ✓ Quizzes: CRUD, scoring, intentos limitados
    CertificatesModule,      // ✓ Certificados PDF, verificación pública por UUID

    // Infraestructura transversal — @Global, disponible en todos los módulos:
    NotificationsModule,     // ✓ WebSocket gateway (Socket.IO) — video.ready, enrollment.completed
  ],
})
export class AppModule {}
