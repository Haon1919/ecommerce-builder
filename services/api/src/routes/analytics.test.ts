import express from 'express';
import request from 'supertest';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import analyticsRouter from './analytics';
import { prisma } from '../db';
import * as anomaly from '../services/anomaly';

// --- Mocks ---
jest.mock('../db', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('../middleware/auth', () => ({
  requireStoreAdmin: (req: any, res: any, next: any) => next(),
  requireSuperAdmin: (req: any, res: any, next: any) => next(),
}));

jest.mock('../services/anomaly');

jest.mock('../config', () => ({
  config: {
    logging: {
      level: 'info',
      structured: false,
    }
  },
}));

// --- Test Setup ---
const app = express();
app.use(express.json());
app.use('/', analyticsRouter);

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockedAnomaly = anomaly as jest.Mocked<typeof anomaly>;

describe('Analytics Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const storeId = 'cl-store-123';

  // --- GET /:storeId/analytics/dashboard ---
  describe('GET /:storeId/analytics/dashboard', () => {
    it('should return aggregated dashboard analytics for a store', async () => {
      // Mock all the parallel queries
      mockedPrisma.order.count.mockResolvedValueOnce(150); // totalOrders
      mockedPrisma.order.aggregate.mockResolvedValue({ _sum: { total: 50000 } } as any);
      mockedPrisma.order.count.mockResolvedValueOnce(5); // pendingOrders
      mockedPrisma.product.count.mockResolvedValueOnce(200); // totalProducts
      mockedPrisma.product.count.mockResolvedValueOnce(10); // lowStockProducts
      mockedPrisma.contactMessage.count.mockResolvedValue(3);
      mockedPrisma.supportTicket.count.mockResolvedValue(2);
      mockedPrisma.order.findMany.mockResolvedValue([]); // recentOrders
      mockedPrisma.order.groupBy.mockResolvedValue([{ status: 'SHIPPED', _count: { id: 145 } }] as any);
      mockedPrisma.$queryRaw.mockResolvedValue([]); // revenueByDay
      mockedPrisma.chatSession.count.mockResolvedValue(25);

      const res = await request(app).get(`/${storeId}/analytics/dashboard`);

      expect(res.status).toBe(200);
      expect(res.body.overview.totalOrders).toBe(150);
      expect(res.body.overview.totalRevenue).toBe(50000);
      expect(res.body.overview.pendingOrders).toBe(5);
      expect(res.body.ordersByStatus.SHIPPED).toBe(145);
    });
  });

  // --- GET /super/overview ---
  describe('GET /super/overview', () => {
    it('should return platform-wide analytics for super admin', async () => {
        mockedPrisma.store.count.mockResolvedValueOnce(50); // totalStores
        mockedPrisma.store.count.mockResolvedValueOnce(45); // activeStores
        mockedPrisma.order.count.mockResolvedValue(1000);
        mockedPrisma.order.aggregate.mockResolvedValue({ _sum: { total: 1000000 } } as any);
        mockedPrisma.supportTicket.count.mockResolvedValue(20);
        mockedPrisma.alert.count.mockResolvedValue(3);
        mockedPrisma.$queryRaw.mockResolvedValueOnce([]); // storeGrowth
        mockedPrisma.$queryRaw.mockResolvedValueOnce([]); // topStores
        mockedAnomaly.getMetricHistory.mockResolvedValue([]);
        mockedAnomaly.getRecentAlerts.mockResolvedValue([]);

        const res = await request(app).get('/super/overview');

        expect(res.status).toBe(200);
        expect(res.body.overview.totalStores).toBe(50);
        expect(res.body.overview.activeStores).toBe(45);
        expect(res.body.overview.totalRevenue).toBe(1000000);
        expect(mockedAnomaly.getRecentAlerts).toHaveBeenCalledWith(10);
    });
  });

  // --- GET /metrics/:metric ---
  describe('GET /metrics/:metric', () => {
    it('should call getMetricHistory with correct params', async () => {
      mockedAnomaly.getMetricHistory.mockResolvedValue([{ value: 1, timestamp: new Date() }]);
      const res = await request(app).get('/metrics/error_rate?hours=48&storeId=test-store');
      
      expect(res.status).toBe(200);
      expect(mockedAnomaly.getMetricHistory).toHaveBeenCalledWith('error_rate', 48, 'test-store');
      expect(res.body.length).toBe(1);
    });
  });

  // --- GET /alerts ---
  describe('GET /alerts', () => {
    it('should fetch recent alerts', async () => {
      mockedPrisma.alert.findMany.mockResolvedValue([{ id: 'alert-1', message: 'Test' }] as any);
      const res = await request(app).get('/alerts?limit=10');

      expect(res.status).toBe(200);
      expect(mockedPrisma.alert.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
      expect(res.body[0].id).toBe('alert-1');
    });
  });

  // --- PATCH /alerts/:alertId/acknowledge ---
  describe('PATCH /alerts/:alertId/acknowledge', () => {
    it('should acknowledge an alert', async () => {
      mockedPrisma.alert.update.mockResolvedValue({ id: 'alert-1', acknowledged: true } as any);
      const res = await request(app).patch('/alerts/alert-1/acknowledge');

      expect(res.status).toBe(200);
      expect(mockedPrisma.alert.update).toHaveBeenCalledWith({
        where: { id: 'alert-1' },
        data: { acknowledged: true },
      });
      expect(res.body.acknowledged).toBe(true);
    });
  });
});
