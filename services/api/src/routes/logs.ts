import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { requireSuperAdmin, requireAdminOrSuperAdmin } from '../middleware/auth';
import { Server } from 'socket.io';

const router = Router();

// This will be set when Socket.IO is initialized
let io: Server | null = null;
export function setSocketIO(socketIO: Server) {
  io = socketIO;
}

// GET /logs - super admin: live log feed (paginated)
router.get('/', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { storeId, level, service, limit = '100', offset = '0', from, to } = req.query;

  const where: Record<string, unknown> = {};
  if (storeId) where.storeId = storeId;
  if (level) where.level = level;
  if (service) where.service = service;
  if (from || to) {
    where.timestamp = {};
    if (from) (where.timestamp as Record<string, Date>).gte = new Date(from as string);
    if (to) (where.timestamp as Record<string, Date>).lte = new Date(to as string);
  }

  const [logs, total] = await Promise.all([
    prisma.appLog.findMany({
      where: where as any,
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      select: {
        id: true,
        level: true,
        service: true,
        message: true,
        meta: true,
        traceId: true,
        timestamp: true,
        storeId: true,
        // Note: We never include store.users or customer data - just the store ID
      },
    }),
    prisma.appLog.count({ where: where as any }),
  ]);

  res.json({ logs, total });
});

// GET /logs/stats - log level counts for health dashboard
router.get('/stats', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { hours = '1' } = req.query;
  const from = new Date(Date.now() - parseInt(hours as string) * 3600 * 1000);

  const stats = await prisma.appLog.groupBy({
    by: ['level', 'service'],
    where: { timestamp: { gte: from } },
    _count: { id: true },
  });

  // Error rate trend (last 60 minutes, 1-minute buckets)
  const trend = await prisma.$queryRaw<Array<{ minute: string; errors: number; total: number }>>`
    SELECT
      TO_CHAR(DATE_TRUNC('minute', timestamp), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as minute,
      COUNT(CASE WHEN level IN ('ERROR', 'CRITICAL') THEN 1 END)::int as errors,
      COUNT(*)::int as total
    FROM "AppLog"
    WHERE timestamp >= ${from}
    GROUP BY DATE_TRUNC('minute', timestamp)
    ORDER BY minute ASC
  `;

  res.json({ stats, trend });
});

/**
 * Emit a log entry to connected super admins via Socket.IO.
 * Called from the request logger middleware.
 */
export function emitLog(log: {
  id: string;
  level: string;
  service: string;
  message: string;
  storeId?: string | null;
  timestamp: Date;
}) {
  if (io) {
    io.to('super-admin-logs').emit('log', log);
  }
}

export default router;
