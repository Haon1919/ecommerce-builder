import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { requireAuth, requireSuperAdmin } from '../middleware/auth';
import { requirePermission } from '../middleware/auth.permission';
import { getMetricHistory, getRecentAlerts } from '../services/anomaly';

const router = Router();

// GET /stores/:storeId/analytics/dashboard - admin analytics dashboard
router.get('/:storeId/analytics/dashboard', requirePermission('analytics:read'), async (req: Request, res: Response): Promise<void> => {
  const storeId = req.params.storeId as string;
  const { days = '30' } = req.query;
  const fromDate = new Date(Date.now() - parseInt(days as string) * 86400 * 1000);

  try {
    const [
      totalOrders,
      totalRevenue,
      pendingOrders,
      totalProducts,
      lowStockProducts,
      unreadMessages,
      openTickets,
      recentOrders,
      ordersByStatus,
      revenueByDay,
      chatSessions,
    ] = await Promise.all([
      prisma.order.count({ where: { storeId, createdAt: { gte: fromDate } } }),
      prisma.order.aggregate({
        where: { storeId, createdAt: { gte: fromDate }, status: { not: 'CANCELLED' } },
        _sum: { total: true },
      }),
      prisma.order.count({ where: { storeId, status: 'PENDING' } }),
      prisma.product.count({ where: { storeId, active: true } }),
      prisma.product.count({ where: { storeId, active: true, trackStock: true, stock: { lte: 5 } } }),
      prisma.contactMessage.count({ where: { storeId, read: false } }),
      prisma.supportTicket.count({ where: { storeId, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      prisma.order.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          createdAt: true,
          items: { select: { productName: true, quantity: true } },
        },
      }),
      prisma.order.groupBy({
        by: ['status'],
        where: { storeId },
        _count: { id: true },
      }),
      // Revenue by day (last 30 days)
      prisma.$queryRaw<Array<{ date: string; revenue: number; orders: number }>>`
        SELECT
          DATE(created_at) as date,
          COALESCE(SUM(total), 0)::float as revenue,
          COUNT(*)::int as orders
        FROM "Order"
        WHERE store_id = ${storeId}
          AND created_at >= ${fromDate}
          AND status != 'CANCELLED'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,
      prisma.chatSession.count({ where: { storeId, createdAt: { gte: fromDate } } }),
    ]);

    res.json({
      overview: {
        totalOrders,
        totalRevenue: Number(totalRevenue._sum?.total ?? 0),
        pendingOrders,
        totalProducts,
        lowStockProducts,
        unreadMessages,
        openTickets,
        chatSessions,
      },
      recentOrders,
      ordersByStatus: Object.fromEntries((ordersByStatus as any[]).map((s: { status: string; _count: { id: number } }) => [s.status, s._count.id])),
      revenueByDay,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Analytics error' });
  }
});

// GET /analytics/super - super admin platform overview
router.get('/super/overview', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const fromDate = new Date(Date.now() - 30 * 86400 * 1000);

  try {
    const [
      totalStores,
      activeStores,
      totalOrders,
      totalRevenue,
      openTickets,
      criticalAlerts,
      storeGrowth,
      topStoresByRevenue,
    ] = await Promise.all([
      prisma.store.count(),
      prisma.store.count({ where: { active: true } }),
      prisma.order.count({ where: { createdAt: { gte: fromDate } } }),
      prisma.order.aggregate({
        where: { createdAt: { gte: fromDate }, status: { not: 'CANCELLED' } },
        _sum: { total: true },
      }),
      prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      prisma.alert.count({ where: { severity: 'CRITICAL', acknowledged: false } }),
      // Stores created per day (last 30 days) - anonymized
      prisma.$queryRaw<Array<{ date: string; count: number }>>`
        SELECT DATE(created_at) as date, COUNT(*)::int as count
        FROM "Store"
        WHERE created_at >= ${fromDate}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,
      // Top stores by revenue (no PII - just store names and totals)
      prisma.$queryRaw<Array<{ store_name: string; revenue: number; order_count: number }>>`
        SELECT s.name as store_name,
               COALESCE(SUM(o.total), 0)::float as revenue,
               COUNT(o.id)::int as order_count
        FROM "Store" s
        LEFT JOIN "Order" o ON o.store_id = s.id AND o.created_at >= ${fromDate} AND o.status != 'CANCELLED'
        GROUP BY s.id, s.name
        ORDER BY revenue DESC
        LIMIT 10
      `,
    ]);

    // System health metrics
    const [errorRate, avgResponseTime, recentAlerts] = await Promise.all([
      getMetricHistory('error_rate', 24),
      getMetricHistory('response_time_ms', 24),
      getRecentAlerts(10),
    ]);

    res.json({
      overview: {
        totalStores,
        activeStores,
        totalOrders,
        // Note: total revenue is platform aggregate - not per-customer
        totalRevenue: Number(totalRevenue._sum?.total ?? 0),
        openTickets,
        criticalAlerts,
      },
      storeGrowth,
      topStoresByRevenue,
      systemHealth: {
        errorRate: errorRate.slice(-60),
        avgResponseTime: avgResponseTime.slice(-60),
      },
      recentAlerts,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Analytics error' });
  }
});

// GET /analytics/metrics/:metric - time series for anomaly charts
router.get('/metrics/:metric', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { metric } = req.params;
  const { hours = '24', storeId } = req.query;

  const history = await getMetricHistory(metric as string, parseInt(hours as string), storeId as string | undefined);
  res.json(history);
});

// GET /analytics/alerts - recent alerts
router.get('/alerts', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { limit = '50', unacknowledged } = req.query;

  const alerts = await prisma.alert.findMany({
    where: unacknowledged === 'true' ? { acknowledged: false } : {},
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit as string),
  });

  res.json(alerts);
});

// PATCH /analytics/alerts/:alertId/acknowledge
router.patch('/alerts/:alertId/acknowledge', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const alertId = req.params.alertId as string;
  const alert = await prisma.alert.update({
    where: { id: alertId },
    data: { acknowledged: true },
  });
  res.json(alert);
});

export default router;
