/**
 * Configuración tipada de la aplicación.
 * Centraliza todas las variables de entorno en un objeto accesible
 * via ConfigService.get('database.url') en lugar de process.env directamente.
 */
export default () => ({
  port: parseInt(process.env.PORT ?? '5000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    url: process.env.REDIS_URL,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },

  // Storage S3-compatible — MinIO en dev/VPS, Backblaze B2 o AWS S3 en prod.
  // Cambiar de proveedor = solo cambiar estas env vars. El SDK es el mismo.
  storage: {
    endpoint:  process.env.STORAGE_ENDPOINT  ?? 'localhost',
    port:      parseInt(process.env.STORAGE_PORT ?? '9000', 10),
    useSSL:    process.env.STORAGE_USE_SSL   ?? 'false',
    accessKey: process.env.STORAGE_ACCESS_KEY ?? 'minioadmin',
    secretKey: process.env.STORAGE_SECRET_KEY ?? 'minioadmin',
    bucket:    process.env.STORAGE_BUCKET    ?? 'lms-files',
    publicUrl: process.env.STORAGE_PUBLIC_URL ?? 'http://localhost:9000/lms-files',
  },

  mux: {
    tokenId:       process.env.MUX_TOKEN_ID,
    tokenSecret:   process.env.MUX_TOKEN_SECRET,
    webhookSecret: process.env.MUX_WEBHOOK_SECRET,
  },

  email: {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM ?? 'noreply@capacitaciones.app',
  },

  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
});
