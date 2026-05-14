import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Seguridad ──────────────────────────────────────────────────────────────
  app.use(helmet());
  app.use(compression());

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ── Versionado de la API ───────────────────────────────────────────────────
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // ── Pipes globales — valida y transforma todos los DTOs ───────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // Elimina campos no declarados en el DTO
      forbidNonWhitelisted: true, // Lanza error si vienen campos extra
      transform: true,          // Convierte strings a los tipos del DTO automáticamente
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Filtros e interceptores globales ──────────────────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // ── Swagger (solo en no-producción) ───────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Capacitaciones API')
      .setDescription('API para plataforma de capacitación empresarial multi-tenant')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    console.log(`Swagger disponible en: http://localhost:${process.env.PORT ?? 3001}/api/docs`);
  }

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`API corriendo en: http://localhost:${port}/api/v1`);
}

bootstrap();
