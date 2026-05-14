import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
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
    // TenantsModule         → Onboarding de empresas, middleware de tenant
    // UsersModule           → Gestión de usuarios y roles
    // SubscriptionsModule   → Planes y pagos con Stripe

    // Fase 2 — Core LMS:
    // CoursesModule         → Cursos, módulos y lecciones
    // EnrollmentsModule     → Inscripciones y progreso
    // StorageModule         → Upload de archivos (MinIO / S3-compatible)
    // VideoModule           → Streaming con Mux.com

    // Fase 3 — Premium:
    // EvaluationsModule     → Evaluaciones y resultados
    // CertificatesModule    → Generación y descarga de certificados
    // AnalyticsModule       → Reportes de progreso por empresa
  ],
})
export class AppModule {}
