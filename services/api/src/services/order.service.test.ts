import { OrderService } from './order.service';
import { prisma } from '../db';
import { NotFoundError, InsufficientStockError } from '../errors';

jest.mock('../db', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    product: { findMany: jest.fn(), update: jest.fn() },
    storeSettings: { findUnique: jest.fn() },
    order: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    metricSnapshot: { create: jest.fn() },
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

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
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
  });

  describe('createOrder', () => {
    it('creates an order, updates the order number, and decrements stock', async () => {
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
      mockPrisma.order.create.mockResolvedValue(mockCreatedOrder);
      mockPrisma.product.update.mockResolvedValue({});

      const result = await OrderService.createOrder('store1', baseOrderData, undefined);

      expect(result.total).toBe(27);
      expect(mockPrisma.order.create).toHaveBeenCalled();
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: mockCreatedOrder.id } })
      );
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { stock: { decrement: 2 } },
      });
    });

    it('throws NotFoundError when a product in the order does not exist', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);

      await expect(
        OrderService.createOrder('store1', baseOrderData, undefined)
      ).rejects.toThrow(NotFoundError);
    });

    it('throws InsufficientStockError when requested quantity exceeds stock', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { ...mockProduct, stock: 1, trackStock: true },
      ]);

      await expect(
        OrderService.createOrder(
          'store1',
          { ...baseOrderData, items: [{ productId: 'p1', quantity: 5 }] },
          undefined
        )
      ).rejects.toThrow(InsufficientStockError);
    });

    it('does not decrement stock for products with trackStock=false', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { ...mockProduct, trackStock: false, stock: 0 },
      ]);
      mockPrisma.order.create.mockResolvedValue(mockCreatedOrder);

      await OrderService.createOrder('store1', baseOrderData, undefined);

      expect(mockPrisma.product.update).not.toHaveBeenCalled();
    });

    it('calculates subtotal, tax, and shipping correctly', async () => {
      mockPrisma.storeSettings.findUnique.mockResolvedValue({
        taxRate: 10,
        flatShippingRate: 5,
        freeShippingAbove: null,
      });
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
      mockPrisma.order.create.mockResolvedValue(mockCreatedOrder);

      await OrderService.createOrder('store1', baseOrderData, undefined);

      const createCall = mockPrisma.order.create.mock.calls[0][0];
      expect(createCall.data.subtotal).toBe(20); // 10 * 2
      expect(createCall.data.tax).toBe(2);       // 20 * 10%
      expect(createCall.data.shipping).toBe(5);
    });

    it('applies free shipping when subtotal meets the free shipping threshold', async () => {
      mockPrisma.storeSettings.findUnique.mockResolvedValue({
        taxRate: 0,
        flatShippingRate: 10,
        freeShippingAbove: 15,
      });
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
      mockPrisma.order.create.mockResolvedValue(mockCreatedOrder);

      await OrderService.createOrder('store1', baseOrderData, undefined);

      const createCall = mockPrisma.order.create.mock.calls[0][0];
      expect(createCall.data.shipping).toBe(0); // subtotal 20 >= threshold 15
    });

    it('encrypts customer PII before storing', async () => {
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
      mockPrisma.order.create.mockResolvedValue(mockCreatedOrder);

      await OrderService.createOrder('store1', baseOrderData, undefined);

      const createCall = mockPrisma.order.create.mock.calls[0][0];
      expect(createCall.data.customerEmailEnc).toBe('enc:jane@example.com');
      expect(createCall.data.customerNameEnc).toBe('enc:Jane Doe');
    });

    it('applies B2B price override from user company price list', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        companyId: 'company1',
        company: { priceList: { prices: { p1: 8 } } },
      });
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
      mockPrisma.order.create.mockResolvedValue(mockCreatedOrder);

      const user = { sub: 'u1', email: 'test@test.com', role: 'USER', type: 'USER' as const };
      await OrderService.createOrder('store1', baseOrderData, user);

      const createCall = mockPrisma.order.create.mock.calls[0][0];
      expect(createCall.data.subtotal).toBe(16); // 8 * 2
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

    it('decrypts phone and address when present', async () => {
      mockPrisma.order.findMany.mockResolvedValue([encryptedOrder]);
      mockPrisma.order.count.mockResolvedValue(1);

      const result = await OrderService.listOrders('store1');

      expect(result.orders[0].customerPhone).toBe('555-0100');
      expect((result.orders[0] as any).shippingAddress).toEqual({ street: '123 Main St' });
    });

    it('handles null phone gracefully', async () => {
      mockPrisma.order.findMany.mockResolvedValue([
        { ...encryptedOrder, customerPhoneEnc: null },
      ]);
      mockPrisma.order.count.mockResolvedValue(1);

      const result = await OrderService.listOrders('store1');

      expect(result.orders[0].customerPhone).toBeNull();
    });

    it('filters by status when provided', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await OrderService.listOrders('store1', 'SHIPPED');

      const call = mockPrisma.order.findMany.mock.calls[0][0];
      expect(call.where.status).toBe('SHIPPED');
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
      expect((result as any).customerEmailEnc).toBeUndefined();
    });

    it('throws NotFoundError when the order does not exist', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(OrderService.getOrderById('store1', 'missing')).rejects.toThrow(NotFoundError);
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

    it('sets shippedAt timestamp when status is SHIPPED', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({ id: 'ord-1', storeId: 'store1' });
      mockPrisma.order.update.mockResolvedValue({
        id: 'ord-1',
        status: 'SHIPPED',
        trackingNumber: 'TRK123',
      });

      await OrderService.updateOrderStatus('store1', 'ord-1', 'SHIPPED', 'TRK123');

      const updateCall = mockPrisma.order.update.mock.calls[0][0];
      expect(updateCall.data.shippedAt).toBeInstanceOf(Date);
      expect(updateCall.data.trackingNumber).toBe('TRK123');
    });

    it('sets deliveredAt timestamp when status is DELIVERED', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({ id: 'ord-1', storeId: 'store1' });
      mockPrisma.order.update.mockResolvedValue({
        id: 'ord-1',
        status: 'DELIVERED',
        trackingNumber: null,
      });

      await OrderService.updateOrderStatus('store1', 'ord-1', 'DELIVERED');

      const updateCall = mockPrisma.order.update.mock.calls[0][0];
      expect(updateCall.data.deliveredAt).toBeInstanceOf(Date);
    });

    it('does not set shippedAt or deliveredAt for other statuses', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({ id: 'ord-1', storeId: 'store1' });
      mockPrisma.order.update.mockResolvedValue({
        id: 'ord-1',
        status: 'PROCESSING',
        trackingNumber: null,
      });

      await OrderService.updateOrderStatus('store1', 'ord-1', 'PROCESSING');

      const updateCall = mockPrisma.order.update.mock.calls[0][0];
      expect(updateCall.data.shippedAt).toBeUndefined();
      expect(updateCall.data.deliveredAt).toBeUndefined();
    });

    it('throws NotFoundError when the order does not exist', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(
        OrderService.updateOrderStatus('store1', 'missing', 'SHIPPED')
      ).rejects.toThrow(NotFoundError);
    });
  });
});
