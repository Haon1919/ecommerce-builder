import dotenv from 'dotenv';
dotenv.config();

const required = (key: string, validate?: (v: string) => string | undefined): string => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  if (validate) {
    const err = validate(val);
    if (err) throw new Error(`Invalid env var ${key}: ${err}`);
  }
  return val;
};

const optional = (key: string, def = ''): string => process.env[key] ?? def;

export const config = {
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3001')),

  db: {
    url: required('DATABASE_URL'),
  },

  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: optional('JWT_EXPIRES_IN', '7d'),
    refreshSecret: optional('REFRESH_TOKEN_SECRET', 'dev-refresh-secret'),
    refreshExpiresIn: optional('REFRESH_TOKEN_EXPIRES_IN', '30d'),
  },

  encryption: {
    key: required('ENCRYPTION_KEY', (v) =>
      v.length !== 32 ? `must be exactly 32 characters (got ${v.length})` : undefined
    ),
    ivSecret: required('ENCRYPTION_IV_SECRET', (v) =>
      v.length !== 16 ? `must be exactly 16 characters (got ${v.length})` : undefined
    ),
  },

  gcp: {
    projectId: optional('GCP_PROJECT_ID', ''),
    region: optional('GCP_REGION', 'us-central1'),
    bucketName: optional('GCS_BUCKET_NAME', ''),
  },

  ga: {
    measurementId: optional('GA4_MEASUREMENT_ID', ''),
    apiSecret: optional('GA4_API_SECRET', ''),
  },

  gemini: {
    apiKey: optional('GEMINI_API_KEY', ''),
    model: optional('GEMINI_MODEL', 'gemini-1.5-pro'),
  },

  stripe: {
    secretKey: optional('STRIPE_SECRET_KEY', ''),
    webhookSecret: optional('STRIPE_WEBHOOK_SECRET', ''),
  },

  email: {
    host: optional('SMTP_HOST', 'smtp.gmail.com'),
    port: parseInt(optional('SMTP_PORT', '587')),
    user: optional('SMTP_USER', ''),
    pass: optional('SMTP_PASS', ''),
    from: optional('EMAIL_FROM', 'noreply@example.com'),
  },

  redis: {
    url: optional('REDIS_URL', 'redis://localhost:6379'),
  },

  urls: {
    api: optional('API_URL', 'http://localhost:3001'),
    admin: optional('ADMIN_URL', 'http://localhost:3002'),
    store: optional('STORE_URL', 'http://localhost:3003'),
    superAdmin: optional('SUPER_ADMIN_URL', 'http://localhost:3004'),
  },

  cors: {
    allowedOrigins: optional('ALLOWED_ORIGINS', 'http://localhost:3002,http://localhost:3003,http://localhost:3004')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },

  rateLimit: {
    windowMs: parseInt(optional('RATE_LIMIT_WINDOW_MS', '60000')),
    max: parseInt(optional('RATE_LIMIT_MAX', '100')),
  },

  anomaly: {
    klThreshold: parseFloat(optional('KL_DIVERGENCE_THRESHOLD', '0.5')),
    snapshotIntervalMs: parseInt(optional('METRIC_SNAPSHOT_INTERVAL_MS', '60000')),
    baselineWindowHours: parseInt(optional('BASELINE_WINDOW_HOURS', '168')),
  },

  retention: {
    appLogsDays: parseInt(optional('APP_LOGS_RETENTION_DAYS', '30')),
    metricSnapshotsDays: parseInt(optional('METRIC_SNAPSHOTS_RETENTION_DAYS', '90')),
  },

  superAdmin: {
    email: optional('SUPER_ADMIN_EMAIL', ''),
  },

  logging: {
    level: optional('LOG_LEVEL', 'info'),
    structured: optional('STRUCTURED_LOGGING', 'false') === 'true',
  },
} as const;

if (config.env === 'production' && config.jwt.secret.length < 64) {
  throw new Error('JWT_SECRET must be at least 64 characters long in production');
}

// Warn loudly if obviously-weak keys are used outside of production
if (config.env !== 'production') {
  if (/^0+$/.test(config.encryption.key)) {
    console.warn('[SECURITY] ENCRYPTION_KEY is all zeros — replace with: openssl rand -hex 16');
  }
  if (config.jwt.secret.startsWith('local-dev') || config.jwt.secret.startsWith('dev-')) {
    console.warn('[SECURITY] JWT_SECRET looks like a placeholder — use a strong random value even in dev');
  }
}
