import { detectAnomaly, recordMetric, getRecentAlerts, getMetricHistory } from './anomaly';
import { prisma } from '../db';

jest.mock('../db', () => ({
  prisma: {
    metricSnapshot: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    alert: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('../config', () => ({
  config: {
    anomaly: {
      snapshotIntervalMs: 60000,
      baselineWindowHours: 168,
      klThreshold: 0.5,
    },
  },
}));

const mockPrisma = prisma as any;

describe('Anomaly Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.metricSnapshot.create.mockResolvedValue({});
    mockPrisma.alert.create.mockResolvedValue({});
  });

  describe('detectAnomaly', () => {
    it('returns isAnomaly=false and klDivergence=0 when there are fewer than 3 data points', async () => {
      mockPrisma.metricSnapshot.findMany
        .mockResolvedValueOnce([{ value: 10 }, { value: 12 }])
        .mockResolvedValueOnce([{ value: 5 }, { value: 6 }]);

      const result = await detectAnomaly('error_rate');

      expect(result.isAnomaly).toBe(false);
      expect(result.klDivergence).toBe(0);
      expect(mockPrisma.alert.create).not.toHaveBeenCalled();
    });

    it('returns isAnomaly=false when current and baseline distributions are similar', async () => {
      const values = Array.from({ length: 20 }, () => ({ value: 5 }));
      mockPrisma.metricSnapshot.findMany
        .mockResolvedValueOnce(values)
        .mockResolvedValueOnce(values);

      const result = await detectAnomaly('order_count');

      expect(result.isAnomaly).toBe(false);
      expect(result.klDivergence).toBeCloseTo(0, 2);
      expect(mockPrisma.alert.create).not.toHaveBeenCalled();
    });

    it('detects an anomaly when current distribution diverges significantly from baseline', async () => {
      // Current: spread across 0-999 (wide distribution)
      // Baseline: all concentrated at 0 (narrow distribution)
      // This produces a large KL divergence because the distributions differ structurally
      const currentValues = Array.from({ length: 20 }, (_, i) => ({ value: i * 50 }));
      const baselineValues = Array.from({ length: 20 }, () => ({ value: 0 }));
      mockPrisma.metricSnapshot.findMany
        .mockResolvedValueOnce(currentValues)
        .mockResolvedValueOnce(baselineValues);

      const result = await detectAnomaly('error_rate');

      expect(result.isAnomaly).toBe(true);
      expect(result.klDivergence).toBeGreaterThan(0.5);
      expect(mockPrisma.alert.create).toHaveBeenCalled();
    });

    it('creates an alert with WARNING or CRITICAL severity when an anomaly is detected', async () => {
      const currentValues = Array.from({ length: 20 }, (_, i) => ({ value: i * 50 }));
      const baselineValues = Array.from({ length: 20 }, () => ({ value: 0 }));
      mockPrisma.metricSnapshot.findMany
        .mockResolvedValueOnce(currentValues)
        .mockResolvedValueOnce(baselineValues);

      const result = await detectAnomaly('api_requests');

      if (result.isAnomaly) {
        const alertCall = mockPrisma.alert.create.mock.calls[0][0];
        expect(['WARNING', 'CRITICAL']).toContain(alertCall.data.severity);
      }
    });

    it('creates a CRITICAL alert when KL divergence exceeds 2x threshold (>1.0)', async () => {
      // Very wide current vs very narrow baseline → extreme KL
      const currentValues = Array.from({ length: 20 }, (_, i) => ({ value: i * 50 }));
      const baselineValues = Array.from({ length: 20 }, () => ({ value: 0 }));
      mockPrisma.metricSnapshot.findMany
        .mockResolvedValueOnce(currentValues)
        .mockResolvedValueOnce(baselineValues);

      const result = await detectAnomaly('error_rate');
      expect(result.isAnomaly).toBe(true);

      const alertCall = mockPrisma.alert.create.mock.calls[0][0];
      // KL will be far above 1.0 (threshold * 2), so severity should be CRITICAL
      expect(alertCall.data.severity).toBe('CRITICAL');
    });

    it('includes metric name and storeId in the created alert', async () => {
      const currentValues = Array.from({ length: 20 }, (_, i) => ({ value: i * 50 }));
      const baselineValues = Array.from({ length: 20 }, () => ({ value: 0 }));
      mockPrisma.metricSnapshot.findMany
        .mockResolvedValueOnce(currentValues)
        .mockResolvedValueOnce(baselineValues);

      await detectAnomaly('response_time_p99', 'store1');

      const alertCall = mockPrisma.alert.create.mock.calls[0][0];
      expect(alertCall.data.metric).toBe('response_time_p99');
      expect(alertCall.data.storeId).toBe('store1');
    });

    it('returns correct metric name, currentMean, and baselineMean', async () => {
      const currentValues = Array.from({ length: 5 }, () => ({ value: 10 }));
      const baselineValues = Array.from({ length: 5 }, () => ({ value: 5 }));
      mockPrisma.metricSnapshot.findMany
        .mockResolvedValueOnce(currentValues)
        .mockResolvedValueOnce(baselineValues);

      const result = await detectAnomaly('response_time_p99', 'store1');

      expect(result.metric).toBe('response_time_p99');
      expect(result.currentMean).toBe(10);
      expect(result.baselineMean).toBe(5);
    });

    it('uses null storeId when none is provided', async () => {
      mockPrisma.metricSnapshot.findMany.mockResolvedValue([]);

      await detectAnomaly('api_requests');

      const calls = mockPrisma.metricSnapshot.findMany.mock.calls;
      expect(calls[0][0].where.storeId).toBeNull();
    });
  });

  describe('recordMetric', () => {
    it('creates a metric snapshot with all provided fields', async () => {
      await recordMetric('order_count', 42, 'store1', { source: 'checkout' });

      expect(mockPrisma.metricSnapshot.create).toHaveBeenCalledWith({
        data: {
          metric: 'order_count',
          value: 42,
          storeId: 'store1',
          tags: { source: 'checkout' },
        },
      });
    });

    it('uses null storeId and empty tags when not provided', async () => {
      await recordMetric('api_requests', 100);

      expect(mockPrisma.metricSnapshot.create).toHaveBeenCalledWith({
        data: {
          metric: 'api_requests',
          value: 100,
          storeId: null,
          tags: {},
        },
      });
    });
  });

  describe('getRecentAlerts', () => {
    it('returns alerts ordered by createdAt descending', async () => {
      const mockAlerts = [
        { id: 'a1', metric: 'error_rate', severity: 'CRITICAL' },
        { id: 'a2', metric: 'api_requests', severity: 'WARNING' },
      ];
      mockPrisma.alert.findMany.mockResolvedValue(mockAlerts);

      const result = await getRecentAlerts(10);

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      expect(result).toEqual(mockAlerts);
    });

    it('defaults to 50 alerts when limit is not specified', async () => {
      mockPrisma.alert.findMany.mockResolvedValue([]);

      await getRecentAlerts();

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 })
      );
    });
  });

  describe('getMetricHistory', () => {
    it('queries snapshots for the given metric and store within the time window', async () => {
      mockPrisma.metricSnapshot.findMany.mockResolvedValue([]);

      await getMetricHistory('error_rate', 24, 'store1');

      const call = mockPrisma.metricSnapshot.findMany.mock.calls[0][0];
      expect(call.where.metric).toBe('error_rate');
      expect(call.where.storeId).toBe('store1');
      expect(call.where.timestamp.gte).toBeInstanceOf(Date);
      expect(call.orderBy).toEqual({ timestamp: 'asc' });
    });

    it('uses null storeId when store is not provided', async () => {
      mockPrisma.metricSnapshot.findMany.mockResolvedValue([]);

      await getMetricHistory('api_requests');

      const call = mockPrisma.metricSnapshot.findMany.mock.calls[0][0];
      expect(call.where.storeId).toBeNull();
    });

    it('computes the from date based on the hours parameter', async () => {
      mockPrisma.metricSnapshot.findMany.mockResolvedValue([]);

      const before = Date.now();
      await getMetricHistory('error_rate', 12);
      const after = Date.now();

      const call = mockPrisma.metricSnapshot.findMany.mock.calls[0][0];
      const fromDate: Date = call.where.timestamp.gte;
      const expectedFrom = before - 12 * 3600 * 1000;
      expect(fromDate.getTime()).toBeGreaterThanOrEqual(expectedFrom - 1000);
      expect(fromDate.getTime()).toBeLessThanOrEqual(after);
    });
  });
});
