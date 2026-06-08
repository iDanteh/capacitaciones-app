import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
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
import { CleanupModule } from './cleanup/cleanup.module';
import { SearchModule } from './search/search.module';
import { AuditModule } from './audit/audit.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
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
    // Rate limiting global: 120 req/min por IP. Rutas sensibles aplican límites más estrictos vía @Throttle().
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    // Soporte para tareas programadas (@Cron, @Interval, @Timeout)
    ScheduleModule.forRoot(),
    DatabaseModule,          // @Global — PrismaService disponible en toda la app
    AuditModule,             // @Global — AuditService + AsyncLocalStorage de contexto HTTP

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

    // Búsqueda global:
    SearchModule,            // ✓ GET /search?q= — cursos, usuarios, certificados

    // Mantenimiento — tareas programadas:
    CleanupModule,           // ✓ Limpieza de invitaciones expiradas (cron diario)

    // Fase 4 — Gestión interna:
    SuperAdminModule,        // ✓ Panel SUPER_ADMIN — gestión centralizada de tenants
  ],
  providers: [
    // ThrottlerGuard aplicado globalmente — todas las rutas heredan el límite base.
    // Rutas sensibles usan @Throttle() para límites más restrictivos.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
