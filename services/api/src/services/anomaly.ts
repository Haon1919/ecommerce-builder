/**
 * KL Divergence Anomaly Detection Service
 *
 * Uses Kullback-Leibler divergence to detect behavioral anomalies
 * in platform metrics. KL(P||Q) measures how distribution P (current)
 * diverges from Q (baseline). High divergence = potential incident.
 *
 * Monitored metrics:
 * - error_rate: HTTP 5xx error percentage
 * - response_time_p99: 99th percentile response time (ms)
 * - order_count: Orders per minute per store
 * - chat_sessions: Chat sessions per minute
 * - api_requests: Total API requests per minute
 */

import { prisma } from '../db';
import { logger } from '../utils/logger';
import { config } from '../config';
import axios from 'axios';

const EPSILON = 1e-10; // Prevent log(0)

/**
 * Compute KL divergence: KL(P||Q) = Σ P(x) * log(P(x) / Q(x))
 * Both arrays must have the same length and sum to ~1 (probability distributions).
 */
function klDivergence(p: number[], q: number[]): number {
  if (p.length !== q.length || p.length === 0) return 0;

  let kl = 0;
  for (let i = 0; i < p.length; i++) {
    const pi = p[i] + EPSILON;
    const qi = q[i] + EPSILON;
    kl += pi * Math.log(pi / qi);
  }
  return kl;
}

/**
 * Convert an array of values into a probability distribution.
 * Uses histogram bucketing with numBuckets buckets.
 */
function toProbabilityDistribution(values: number[], numBuckets = 20): number[] {
  if (values.length === 0) return new Array(numBuckets).fill(1 / numBuckets);

  const min = values.reduce((a, b) => Math.min(a, b), Infinity);
  const max = values.reduce((a, b) => Math.max(a, b), -Infinity);
  const range = max - min || 1;
  const buckets = new Array(numBuckets).fill(0);

  for (const v of values) {
    const idx = Math.min(Math.floor(((v - min) / range) * numBuckets), numBuckets - 1);
    buckets[idx]++;
  }

  const total = buckets.reduce((a, b) => a + b, 0);
  return buckets.map((b) => b / total);
}

/**
 * Fetch metric values for a time window.
 */
async function fetchMetricValues(
  metric: string,
  fromDate: Date,
  toDate: Date,
  storeId?: string
): Promise<number[]> {
  const snapshots = await prisma.metricSnapshot.findMany({
    where: {
      metric,
      storeId: storeId ?? null,
      timestamp: { gte: fromDate, lte: toDate },
    },
    select: { value: true },
    orderBy: { timestamp: 'asc' },
  });
  return snapshots.map((s: { value: number }) => s.value);
}

/**
 * Run anomaly detection for a given metric.
 * Returns the KL divergence and whether it exceeds the threshold.
 */
export async function detectAnomaly(
  metric: string,
  storeId?: string
): Promise<{
  metric: string;
  klDivergence: number;
  isAnomaly: boolean;
  currentMean: number;
  baselineMean: number;
}> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - config.anomaly.snapshotIntervalMs * 5);
  const baselineStart = new Date(
    now.getTime() - config.anomaly.baselineWindowHours * 3600 * 1000
  );
  const baselineEnd = new Date(now.getTime() - config.anomaly.snapshotIntervalMs * 5);

  const [currentValues, baselineValues] = await Promise.all([
    fetchMetricValues(metric, windowStart, now, storeId),
    fetchMetricValues(metric, baselineStart, baselineEnd, storeId),
  ]);

  if (currentValues.length < 3 || baselineValues.length < 3) {
    return {
      metric,
      klDivergence: 0,
      isAnomaly: false,
      currentMean: 0,
      baselineMean: 0,
    };
  }

  const p = toProbabilityDistribution(currentValues);
  const q = toProbabilityDistribution(baselineValues);
  const kl = klDivergence(p, q);

  const currentMean = currentValues.reduce((a, b) => a + b, 0) / currentValues.length;
  const baselineMean = baselineValues.reduce((a, b) => a + b, 0) / baselineValues.length;

  const isAnomaly = kl > config.anomaly.klThreshold;

  if (isAnomaly) {
    logger.warn(`Anomaly detected: metric=${metric} kl=${kl.toFixed(4)}`, {
      metric,
      storeId,
      klDivergence: kl,
      currentMean,
      baselineMean,
    });

    // Persist alert
    await prisma.alert.create({
      data: {
        metric,
        storeId: storeId ?? null,
        severity: kl > config.anomaly.klThreshold * 2 ? 'CRITICAL' : 'WARNING',
        message: `Anomaly detected in ${metric}: KL divergence ${kl.toFixed(4)} exceeds threshold ${config.anomaly.klThreshold}. Current mean: ${currentMean.toFixed(2)}, baseline: ${baselineMean.toFixed(2)}`,
        klDivergence: kl,
      },
    });
  }

  return { metric, klDivergence: kl, isAnomaly, currentMean, baselineMean };
}

/**
 * Record a metric snapshot for anomaly detection.
 */
export async function recordMetric(
  metric: string,
  value: number,
  storeId?: string,
  tags?: Record<string, string>
): Promise<void> {
  await prisma.metricSnapshot.create({
    data: {
      metric,
      value,
      storeId: storeId ?? null,
      tags: tags ?? {},
    },
  });
}

/**
 * Run all anomaly checks. Called on a schedule.
 */
export async function runAnomalyChecks(): Promise<void> {
  const metrics = [
    'error_rate',
    'response_time_p99',
    'order_count',
    'api_requests',
    'chat_sessions',
  ];

  const results = await Promise.allSettled(metrics.map((m) => detectAnomaly(m)));

  for (const result of results) {
    if (result.status === 'rejected') {
      logger.error('Anomaly check failed', { error: result.reason });
    }
  }

  try {
    await checkProductInventoryAnomalies();
  } catch (e) {
    logger.error('checkProductInventoryAnomalies failed', { error: e });
  }
}

/**
 * Predictive Inventory Monitoring
 * Tracks product stock velocity and triggers emergency alert webhooks
 * if an anomalous sales spike will deplete stock within 48 hours.
 */
async function checkProductInventoryAnomalies() {
  const products = await prisma.product.findMany({
    where: { trackStock: true, stock: { gt: 0 }, active: true },
    include: { store: { include: { settings: true } } },
  });

  const now = new Date();
  const windowStart = new Date(now.getTime() - config.anomaly.snapshotIntervalMs * 5);

  for (const product of products) {
    const metricName = `product_sales:${product.id}`;

    // 1. Check if there's an anomaly compared to 7 days
    const result = await detectAnomaly(metricName, product.storeId);
    if (!result.isAnomaly) continue;

    // 2. Gather total sales in current 5-min window
    const recentSales = await prisma.metricSnapshot.aggregate({
      where: { metric: metricName, timestamp: { gte: windowStart } },
      _sum: { value: true },
    });

    const totalSoldLast5Mins = recentSales._sum.value || 0;
    if (totalSoldLast5Mins === 0) continue;

    const salesPerMinute = totalSoldLast5Mins / 5;
    const minutesUntilDepletion = product.stock / salesPerMinute;

    if (minutesUntilDepletion <= 48 * 60) {
      // Depletes within 48 hours
      const store = product.store;
      if (store.tier === 'GROWTH' || store.tier === 'ENTERPRISE') {
        const webhooks = (store.settings as any)?.supplierWebhookUrls || [];
        for (const url of webhooks) {
          try {
            await axios.post(url, {
              event: 'PREDICTIVE_INVENTORY_ALERT',
              productId: product.id,
              productName: product.name,
              sku: product.sku,
              currentStock: product.stock,
              salesVelocityPerMinute: salesPerMinute,
              estimatedDepletionHours: (minutesUntilDepletion / 60).toFixed(2),
              baselineKlDivergence: result.klDivergence,
              message: `Anomalous sales spike detected. Stock will deplete in ${(minutesUntilDepletion / 60).toFixed(1)} hours.`,
            });
            logger.info(`Fired supplier webhook for product ${product.id} to ${url}`);
          } catch (e) {
            logger.error(`Failed to fire supplier webhook to ${url}: ${e}`);
          }
        }
      }
    }
  }
}

/**
 * Get recent anomalies for the super admin dashboard.
 */
export async function getRecentAlerts(limit = 50) {
  return prisma.alert.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Get metric history for charting.
 */
export async function getMetricHistory(
  metric: string,
  hours = 24,
  storeId?: string
) {
  const from = new Date(Date.now() - hours * 3600 * 1000);
  return prisma.metricSnapshot.findMany({
    where: {
      metric,
      storeId: storeId ?? null,
      timestamp: { gte: from },
    },
    orderBy: { timestamp: 'asc' },
    select: { value: true, timestamp: true },
  });
}
