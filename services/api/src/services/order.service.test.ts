import { OrderService } from './order.service';
import { prisma } from '../db';
import { NotFoundError, InsufficientStockError } from '../errors';
import { PaymentService } from './payment';

jest.mock('../db', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    product: { findMany: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    storeSettings: { findUnique: jest.fn() },
    order: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    location: { findMany: jest.fn() },
    stock: { update: jest.fn() },
    metricSnapshot: { create: jest.fn() },
    vendor: { findMany: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn((cb) => cb(prisma)),
  },
}));

jest.mock('./payment', () => ({
  PaymentService: {
    processSplitPayout: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('./encryption', () => ({
  encrypt: jest.fn((v: string) => `enc:${v}`),
  decrypt: jest.fn((v: string) => v.replace('enc:', '')),
  encryptJson: jest.fn((v: object) => `enc:${JSON.stringify(v)}`),
  decryptJson: jest.fn((v: string) => {
    try { return JSON.parse(v.replace('enc:', '')); } catch { return null; }
  }),
}));

jest.mock('./anomaly', () => ({
  recordMetric: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./discount', () => ({
  discountService: {
    calculateBestDiscounts: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const mockPrisma = prisma as any;

const baseOrderData = {
  storeId: 'store1',
  customerEmail: 'jane@example.com',
  customerName: 'Jane Doe',
  customerPhone: '555-0100',
  shippingAddress: { street: '123 Main St', city: 'Springfield' },
  items: [{ productId: 'p1', quantity: 2 }],
};

const mockProduct = {
  id: 'p1',
  name: 'Widget',
  price: 10,
  stock: 5,
  trackStock: true,
  storeId: 'store1',
  active: true,
};

const mockCreatedOrder = {
  id: 'ord-cuid-abc123',
  status: 'PENDING',
  subtotal: 20,
  tax: 2,
  shipping: 5,
  total: 27,
  items: [],
};

describe('OrderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.storeSettings.findUnique.mockResolvedValue({
      taxRate: 10,
      flatShippingRate: 5,
      freeShippingAbove: null,
    });
    mockPrisma.metricSnapshot.create.mockResolvedValue({});
    mockPrisma.order.update.mockResolvedValue({
      ...mockCreatedOrder,
      orderNumber: 'ORD-2026-ABC123',
    });
    mockPrisma.location.findMany.mockResolvedValue([
      { id: 'loc1', priority: 1, active: true, stocks: [{ quantity: 100 }] }
    ]);
  });

  describe('createOrder', () => {
    it('creates an order and decrements stock from locations', async () => {
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
      mockPrisma.order.create.mockResolvedValue(mockCreatedOrder);
      mockPrisma.stock.update.mockResolvedValue({});
      mockPrisma.product.update.mockResolvedValue({});

      const result = await OrderService.createOrder('store1', baseOrderData, undefined);

      expect(result.total).toBe(27);
      expect(mockPrisma.order.create).toHaveBeenCalled();
      expect(mockPrisma.stock.update).toHaveBeenCalledWith({
        where: { productId_locationId: { productId: 'p1', locationId: 'loc1' } },
        data: { quantity: { decrement: 2 } },
      });
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { stock: { decrement: 2 } },
      });
    });

    describe('Multi-Location Stock Deduction', () => {
      it('deducts stock from highest priority location first', async () => {
        const product = { ...mockProduct, id: 'p1', trackStock: true };
        mockPrisma.product.findMany.mockResolvedValue([product]);

        const locHigh = { id: 'loc-high', priority: 10, stocks: [{ quantity: 10 }] };
        const locLow = { id: 'loc-low', priority: 5, stocks: [{ quantity: 10 }] };
        mockPrisma.location.findMany.mockResolvedValue([locHigh, locLow]);

        mockPrisma.order.create.mockResolvedValue(mockCreatedOrder);
        mockPrisma.stock.update.mockResolvedValue({});

        await OrderService.createOrder('store1', baseOrderData, undefined);

        // Should take 2 from loc-high
        expect(mockPrisma.stock.update).toHaveBeenCalledWith(expect.objectContaining({
          where: { productId_locationId: { productId: 'p1', locationId: 'loc-high' } },
        }));
        expect(mockPrisma.stock.update).not.toHaveBeenCalledWith(expect.objectContaining({
          where: { productId_locationId: { productId: 'p1', locationId: 'loc-low' } }
        }));
      });

      it('splits fulfillment across multiple locations if primary location has insufficient stock', async () => {
        const product = { ...mockProduct, id: 'p1', trackStock: true };
        mockPrisma.product.findMany.mockResolvedValue([product]);

        const loc1 = { id: 'loc1', priority: 10, stocks: [{ quantity: 1 }] };
        const loc2 = { id: 'loc2', priority: 5, stocks: [{ quantity: 10 }] };
        mockPrisma.location.findMany.mockResolvedValue([loc1, loc2]);

        mockPrisma.order.create.mockResolvedValue(mockCreatedOrder);

        // Request 2 units (baseOrderData has quantity 2)
        await OrderService.createOrder('store1', baseOrderData, undefined);

        // Should take 1 from loc1 and 1 from loc2
        expect(mockPrisma.stock.update).toHaveBeenCalledWith(expect.objectContaining({
          where: { productId_locationId: { productId: 'p1', locationId: 'loc1' } },
          data: { quantity: { decrement: 1 } }
        }));
        expect(mockPrisma.stock.update).toHaveBeenCalledWith(expect.objectContaining({
          where: { productId_locationId: { productId: 'p1', locationId: 'loc2' } },
          data: { quantity: { decrement: 1 } }
        }));
      });

      it('throws InsufficientStockError if total stock across all locations is too low', async () => {
        const product = { ...mockProduct, id: 'p1', trackStock: true };
        mockPrisma.product.findMany.mockResolvedValue([product]);

        const loc1 = { id: 'loc1', priority: 10, stocks: [{ quantity: 0 }] };
        const loc2 = { id: 'loc2', priority: 5, stocks: [{ quantity: 1 }] };
        mockPrisma.location.findMany.mockResolvedValue([loc1, loc2]);

        // Request 2 units
        await expect(
          OrderService.createOrder('store1', baseOrderData, undefined)
        ).rejects.toThrow(InsufficientStockError);
      });
    });

    it('creates sub-orders and processes split payouts for multi-vendor carts', async () => {
      const p1 = { ...mockProduct, id: 'p1', vendorId: 'v1', price: 10 };
      const p2 = { ...mockProduct, id: 'p2', vendorId: 'v2', price: 20 };
      mockPrisma.product.findMany.mockResolvedValue([p1, p2]);

      const mockedVendors = [
        { id: 'v1', payoutEnabled: true, stripeAccountIdEnc: 'enc:acct_1' },
        { id: 'v2', payoutEnabled: true, stripeAccountIdEnc: 'enc:acct_2' },
      ];
      mockPrisma.vendor.findMany.mockResolvedValue(mockedVendors);

      const parentOrder = { ...mockCreatedOrder, id: 'parent-123' };
      const subOrder1 = { ...mockCreatedOrder, id: 'sub-1' };
      const subOrder2 = { ...mockCreatedOrder, id: 'sub-2' };

      mockPrisma.order.create
        .mockResolvedValueOnce(parentOrder)
        .mockResolvedValueOnce(subOrder1)
        .mockResolvedValueOnce(subOrder2);

      const splitData = {
        ...baseOrderData,
        items: [
          { productId: 'p1', quantity: 1 },
          { productId: 'p2', quantity: 2 },
        ],
      };

      await OrderService.createOrder('store1', splitData, undefined);

      // Verify 3 orders created: 1 parent + 2 subs
      expect(mockPrisma.order.create).toHaveBeenCalledTimes(3);

      expect(PaymentService.processSplitPayout).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ vendorStripeAccountId: 'acct_1', amount: 1100 }), // 10 + 1 tax
          expect.objectContaining({ vendorStripeAccountId: 'acct_2', amount: 4400 }), // 40 + 4 tax
        ])
      );
    });
  });

  describe('listOrders', () => {
    const encryptedOrder = {
      id: 'ord-1',
      orderNumber: 'ORD-2026-ABC',
      status: 'PENDING',
      customerEmailEnc: 'enc:jane@example.com',
      customerNameEnc: 'enc:Jane Doe',
      customerPhoneEnc: 'enc:555-0100',
      shippingAddrEnc: 'enc:{"street":"123 Main St"}',
      items: [],
    };

    it('returns decrypted orders with pagination metadata', async () => {
      mockPrisma.order.findMany.mockResolvedValue([encryptedOrder]);
      mockPrisma.order.count.mockResolvedValue(1);

      const result = await OrderService.listOrders('store1');

      expect(result.total).toBe(1);
      expect(result.orders[0].customerEmail).toBe('jane@example.com');
      expect(result.orders[0].customerName).toBe('Jane Doe');
      expect(result.orders[0].customerEmailEnc).toBeUndefined();
    });
  });

  describe('getOrderById', () => {
    it('returns a decrypted order when found', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'ord-1',
        storeId: 'store1',
        customerEmailEnc: 'enc:jane@example.com',
        customerNameEnc: 'enc:Jane Doe',
        customerPhoneEnc: null,
        shippingAddrEnc: 'enc:{"street":"123 Main St"}',
        items: [],
      });

      const result = await OrderService.getOrderById('store1', 'ord-1');

      expect(result.customerEmail).toBe('jane@example.com');
      expect(result.customerPhone).toBeNull();
    });
  });

  describe('updateOrderStatus', () => {
    it('updates status and returns id, status, and trackingNumber', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({ id: 'ord-1', storeId: 'store1' });
      mockPrisma.order.update.mockResolvedValue({
        id: 'ord-1',
        status: 'CONFIRMED',
        trackingNumber: null,
      });

      const result = await OrderService.updateOrderStatus('store1', 'ord-1', 'CONFIRMED');

      expect(result.status).toBe('CONFIRMED');
    });
  });
});
