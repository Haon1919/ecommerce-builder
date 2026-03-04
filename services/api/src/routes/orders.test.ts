import express from 'express';
import request from 'supertest';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import orderRouter from './orders';
import { prisma } from '../db';
import * as encryption from '../services/encryption';
import * as anomaly from '../services/anomaly';
import { logger } from '../utils/logger';

// --- Mocks ---
jest.mock('../db', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

jest.mock('../middleware/auth', () => ({
  requireStoreAdmin: (req: any, res: any, next: any) => next(),
  optionalAuth: (req: any, res: any, next: any) => next(),
}));

jest.mock('../services/encryption');
jest.mock('../services/anomaly');
jest.mock('../utils/logger');

jest.mock('../config', () => ({
  config: {
    encryption: {
      key: 'a-test-key-that-is-at-least-32-bytes-long-for-testing',
    },
    jwt: {
      secret: 'test-secret',
    },
    logging: {
      level: 'info',
      structured: false,
    }
  },
}));

// --- Test Setup ---
const app = express();
app.use(express.json());
app.use('/', orderRouter);

const mockedPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockedEncryption = encryption as jest.Mocked<typeof encryption>;
const mockedAnomaly = anomaly as jest.Mocked<typeof anomaly>;

describe('Order Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const storeId = 'cl-store-123';
  const sampleProduct = { id: 'prod-1', name: 'Test Item', price: 10, stock: 100, trackStock: true } as any;
  const sampleOrderData = {
    storeId,
    customerEmail: 'customer@test.com',
    customerName: 'Test Customer',
    shippingAddress: { line1: '123 Main St', city: 'Anytown', state: 'CA', zip: '12345', country: 'US' },
    items: [{ productId: sampleProduct.id, quantity: 2 }],
  };

  // --- POST / ---
  describe('POST / (Create Order)', () => {
    it('should create an order with valid data', async () => {
      // Setup mocks
      mockedPrisma.product.findMany.mockResolvedValue([sampleProduct] as any);
      mockedPrisma.storeSettings.findUnique.mockResolvedValue({ taxRate: 10, flatShippingRate: 5 } as any);
      mockedPrisma.order.count.mockResolvedValue(98);
      const createdOrder = {
        id: 'order-1',
        orderNumber: 'ORD-2024-00099',
        status: 'PENDING',
        ...sampleOrderData,
        subtotal: 20,
        tax: 2,
        shipping: 5,
        total: 27,
        items: [],
      };
      mockedPrisma.order.create.mockResolvedValue(createdOrder as any);
      mockedPrisma.product.update.mockResolvedValue({} as any);

      const res = await request(app).post('/').send(sampleOrderData);

      // Assertions
      expect(res.status).toBe(201);
      expect(mockedEncryption.encrypt).toHaveBeenCalledWith(sampleOrderData.customerEmail);
      expect(mockedEncryption.encryptJson).toHaveBeenCalledWith(sampleOrderData.shippingAddress);
      expect(mockedPrisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          subtotal: 20, // 2 * 10
          tax: 2,       // 10% of 20
          shipping: 5,
          total: 27,
        }),
      }));
      expect(mockedPrisma.product.update).toHaveBeenCalledWith({
        where: { id: sampleProduct.id },
        data: { stock: { decrement: 2 } },
      });
      expect(mockedAnomaly.recordMetric).toHaveBeenCalledWith('order_count', 1, storeId);
      expect(res.body.total).toBe(27);
    });

    it('should return 400 for insufficient stock', async () => {
      const lowStockProduct = { ...sampleProduct, stock: 1 };
      mockedPrisma.product.findMany.mockResolvedValue([lowStockProduct] as any);
      const res = await request(app).post('/').send(sampleOrderData);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Insufficient stock');
    });

    it('should return 400 for invalid input', async () => {
      const res = await request(app).post('/').send({ ...sampleOrderData, customerEmail: 'not-an-email' });
      expect(res.status).toBe(400);
    });
  });

  // --- GET /:storeId/orders ---
  describe('GET /:storeId/orders (Admin List)', () => {
    it('should return a list of decrypted orders', async () => {
      const encryptedOrder = {
        id: 'order-1',
        customerEmailEnc: 'enc-email',
        customerNameEnc: 'enc-name',
        shippingAddrEnc: 'enc-addr',
      };
      mockedPrisma.order.findMany.mockResolvedValue([encryptedOrder] as any);
      mockedPrisma.order.count.mockResolvedValue(1);
      mockedEncryption.decrypt.mockImplementation((val) => `decrypted-${val}`);
      mockedEncryption.decryptJson.mockImplementation((val) => ({ line1: `decrypted-${val}` }));

      const res = await request(app).get(`/${storeId}/orders`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      const order = res.body.orders[0];
      expect(order.customerEmail).toBe('decrypted-enc-email');
      expect(order.customerName).toBe('decrypted-enc-name');
      expect(order.shippingAddress.line1).toBe('decrypted-enc-addr');
      expect(order.customerEmailEnc).toBeUndefined(); // Ensure encrypted fields are removed
    });
  });

  // --- GET /:storeId/orders/:orderId ---
  describe('GET /:storeId/orders/:orderId (Admin Detail)', () => {
    it('should return a single decrypted order', async () => {
      const encryptedOrder = { id: 'order-1', customerEmailEnc: 'enc-email' };
      mockedPrisma.order.findFirst.mockResolvedValue(encryptedOrder as any);
      mockedEncryption.decrypt.mockReturnValue('decrypted-email');

      const res = await request(app).get(`/${storeId}/orders/order-1`);

      expect(res.status).toBe(200);
      expect(res.body.customerEmail).toBe('decrypted-email');
    });

    it('should return 404 if order not found', async () => {
      mockedPrisma.order.findFirst.mockResolvedValue(null);
      const res = await request(app).get(`/${storeId}/orders/order-not-found`);
      expect(res.status).toBe(404);
    });
  });

  // --- PATCH /:storeId/orders/:orderId/status ---
  describe('PATCH /:storeId/orders/:orderId/status (Admin Update)', () => {
    it('should update an order status', async () => {
      mockedPrisma.order.findFirst.mockResolvedValue({ id: 'order-1' } as any);
      mockedPrisma.order.update.mockResolvedValue({ id: 'order-1', status: 'SHIPPED' } as any);

      const res = await request(app).patch(`/${storeId}/orders/order-1/status`).send({ status: 'SHIPPED' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SHIPPED');
      expect(mockedPrisma.order.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'SHIPPED', shippedAt: expect.any(Date) }),
      }));
    });
  });
});
