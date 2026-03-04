import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { logger } from '../utils/logger';

let requestCount = 0;

export function getAndResetRequestCount(): number {
  const count = requestCount;
  requestCount = 0;
  return count;
}

/**
 * Log every API request to the database for the live log viewer.
 * PII is stripped — only method, path, status, duration are logged.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
  req.headers['x-trace-id'] = traceId;

  res.on('finish', () => {
    requestCount++;
    const duration = Date.now() - start;
    const storeId = req.user?.storeId ?? null;

    // Fire-and-forget DB log (non-blocking)
    prisma.appLog
      .create({
        data: {
          storeId,
          level: res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO',
          service: 'api',
          message: `${req.method} ${req.path} ${res.statusCode} ${duration}ms`,
          traceId,
          meta: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            durationMs: duration,
            userAgent: req.headers['user-agent']?.substring(0, 100) ?? '',
          },
        },
      })
      .catch((err: any) => logger.error('Failed to write request log', { error: err }));

    // Also record error rate metric
    if (res.statusCode >= 500) {
      prisma.metricSnapshot
        .create({
          data: { metric: 'error_rate', value: 1, storeId, tags: { path: req.path } },
        })
        .catch(() => { });
    }
  });

  next();
}

/**
 * Response time header middleware.
 */
export function responseTime(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationMs = durationNs / 1_000_000;
    res.setHeader('X-Response-Time', `${durationMs.toFixed(2)}ms`);

    // Record p99 proxy metric
    if (Math.random() < 0.1) {
      // Sample 10% of requests
      prisma.metricSnapshot
        .create({
          data: {
            metric: 'response_time_p99',
            value: durationMs,
            storeId: req.user?.storeId ?? null,
          },
        })
        .catch(() => { });
    }
  });
  next();
}

/**
 * Super admin data isolation middleware.
 * Ensures super admin API endpoints NEVER return raw PII fields.
 * Fields like customerEmailEnc, customerNameEnc, etc. are scrubbed.
 */
const PII_FIELDS = [
  'customerEmailEnc',
  'customerNameEnc',
  'customerPhoneEnc',
  'shippingAddrEnc',
  'nameEnc',
  'emailEnc',
  'password',
];

export function scrubPIIForSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    if (req.user?.type !== 'SUPER_ADMIN') {
      return originalJson(body);
    }
    const scrubbed = deepScrub(body, PII_FIELDS);
    return originalJson(scrubbed);
  };

  next();
}

function deepScrub(obj: unknown, fields: string[]): unknown {
  if (Array.isArray(obj)) return obj.map((item) => deepScrub(item, fields));
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (fields.includes(key)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = deepScrub(value, fields);
      }
    }
    return result;
  }
  return obj;
}
