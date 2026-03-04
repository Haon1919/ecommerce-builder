import { PrismaClient } from '@prisma/client';
import { logger } from './utils/logger';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getDatabaseUrl(): string | undefined {
  const currentUrl = process.env.DATABASE_URL;
  if (process.env.NODE_ENV !== 'production' || !currentUrl) {
    return undefined;
  }

  try {
    const url = new URL(currentUrl);
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', '20');
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', '30');
    }
    return url.toString();
  } catch (e) {
    logger.warn('Failed to parse DATABASE_URL for connection pool settings', { error: e instanceof Error ? e.message : String(e) });
    return undefined;
  }
}

const dbUrl = getDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
    ...(dbUrl ? { datasources: { db: { url: dbUrl } } } : {})
  });

// Log slow queries (>500ms)
prisma.$on('query' as never, (e: { duration: number; query: string }) => {
  if (e.duration > 500) {
    logger.warn('Slow query detected', {
      duration: e.duration,
      query: e.query.substring(0, 200),
    });
  }
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function connectDB() {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (err) {
    logger.error('Database connection failed', { error: err });
    process.exit(1);
  }
}

export async function disconnectDB() {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
