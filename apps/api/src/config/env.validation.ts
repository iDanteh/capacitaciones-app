import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 5000;

  // ── Base de datos ────────────────────────────────────────────────────────────
  @IsString()
  DATABASE_URL: string;

  // ── Redis ────────────────────────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  REDIS_URL: string;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD: string;

  // ── JWT ──────────────────────────────────────────────────────────────────────
  @IsString()
  JWT_SECRET: string;

  @IsString()
  JWT_REFRESH_SECRET: string;

  // ── MFA ──────────────────────────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  MFA_ENCRYPTION_KEY: string;

  @IsString()
  @IsOptional()
  MFA_JWT_SECRET: string;

  // ── Stripe ───────────────────────────────────────────────────────────────────
  // Requeridas: StripeService usa getOrThrow — sin estas vars el API no arranca.
  // En dev se aceptan claves sk_test_*; en prod deben ser sk_live_*.
  @IsString()
  STRIPE_SECRET_KEY: string;

  @IsString()
  STRIPE_WEBHOOK_SECRET: string;

  // ── Storage ──────────────────────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  STORAGE_ENDPOINT: string;

  @IsString()
  @IsOptional()
  STORAGE_ACCESS_KEY: string;

  @IsString()
  @IsOptional()
  STORAGE_SECRET_KEY: string;

  @IsString()
  @IsOptional()
  STORAGE_BUCKET: string;

  @IsString()
  @IsOptional()
  STORAGE_PUBLIC_URL: string;

  @IsString()
  @IsOptional()
  STORAGE_SERVER_URL: string;

  // ── Mux ──────────────────────────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  MUX_TOKEN_ID: string;

  @IsString()
  @IsOptional()
  MUX_TOKEN_SECRET: string;

  @IsString()
  @IsOptional()
  MUX_WEBHOOK_SECRET: string;

  // ── Email ────────────────────────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  RESEND_API_KEY: string;

  @IsString()
  @IsOptional()
  EMAIL_FROM: string;

  // ── App ──────────────────────────────────────────────────────────────────────
  @IsString()
  @IsOptional()
  FRONTEND_URL: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Variables de entorno inválidas:\n${errors.toString()}`);
  }

  return validatedConfig;
}
