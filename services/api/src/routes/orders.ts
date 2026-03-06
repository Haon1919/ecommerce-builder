import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { optionalAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/auth.permission';
import { OrderService } from '../services/order.service';
import { logger } from '../utils/logger';
import { NotFoundError, InsufficientStockError } from '../errors';
import { discountService, Cart } from '../services/discount';
import { prisma } from '../db';
import { taxService } from '../services/tax';

const router = Router();

const createOrderSchema = z.object({
  storeId: z.string(),
  customerEmail: z.string().email(),
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  shippingAddress: z.object({
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string().default('US'),
  }),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
    variantInfo: z.unknown().optional(),
  })),
  notes: z.string().optional(),
  paymentTerms: z.string().optional(),
  shippingCost: z.number().optional(),
});

const calculateCartSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
  })),
  userTags: z.array(z.string()).optional(),
  providedCodes: z.array(z.string()).optional(),
});

// POST /orders - create order (public)
router.post('/', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    return;
  }

  try {
    const order = await OrderService.createOrder(parsed.data.storeId, parsed.data, req.user);
    res.status(201).json(order);
  } catch (err: any) {
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof InsufficientStockError) {
      res.status(400).json({ error: err.message });
      return;
    }
    logger.error('Create order error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /stores/:storeId/cart/calculate
router.post('/:storeId/cart/calculate', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  const { storeId } = req.params as { storeId: string };
  const parsed = calculateCartSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    return;
  }

  try {
    const products = await prisma.product.findMany({
      where: {
        id: { in: parsed.data.items.map(i => i.productId) },
        storeId,
        active: true,
      },
      select: { id: true, price: true }
    });

    const productMap = new Map((products as any[]).map(p => [p.id, Number(p.price)]));

    let subtotal = 0;
    const cartItems = parsed.data.items.map(item => {
      const price = productMap.get(item.productId) || 0;
      subtotal += price * item.quantity;
      return { productId: item.productId, quantity: item.quantity, price };
    });

    const userTags = parsed.data.userTags || [];
    if (req.user && req.user.type === 'USER') {
      const dbUser = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { tags: true } });
      if (dbUser?.tags) {
        userTags.push(...dbUser.tags);
      }
    }

    const codes = parsed.data.providedCodes || [];

    const cart: Cart = { items: cartItems, subtotal };
    const appliedDiscounts = await discountService.calculateBestDiscounts(
      storeId,
      cart,
      Array.from(new Set(userTags)),
      Array.from(new Set(codes))
    );

    const totalDiscount = appliedDiscounts.reduce((sum, d) => sum + d.amount, 0);
    const discountedSubtotal = Math.max(0, subtotal - totalDiscount);

    const settings = await prisma.storeSettings.findUnique({ where: { storeId } });
    const taxRate = settings?.taxRate ?? 0;
    const flatShipping = settings?.flatShippingRate ?? 0;
    const freeShippingAbove = settings?.freeShippingAbove;

    const taxResult = await taxService.calculateTax(storeId, undefined, discountedSubtotal);
    const tax = taxResult.amount;
    const shipping = freeShippingAbove && discountedSubtotal >= freeShippingAbove ? 0 : flatShipping;
    const total = discountedSubtotal + tax + shipping;

    res.json({
      subtotal,
      totalDiscount,
      discountedSubtotal,
      tax,
      shipping,
      total,
      appliedDiscounts,
      currency: settings?.currency || 'USD'
    });
  } catch (err: any) {
    logger.error('Cart calculation error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /stores/:storeId/orders - admin order list
router.get('/:storeId/orders', requirePermission('orders:read'), async (req: Request, res: Response): Promise<void> => {
  const { storeId } = req.params as { storeId: string };
  const { status, limit, offset } = req.query;

  try {
    const result = await OrderService.listOrders(storeId, status as string, limit as string, offset as string);
    res.json(result);
  } catch (err: any) {
    logger.error('List orders error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /stores/:storeId/orders/:orderId - admin order detail
router.get('/:storeId/orders/:orderId', requirePermission('orders:read'), async (req: Request, res: Response): Promise<void> => {
  const { storeId, orderId } = req.params as { storeId: string, orderId: string };

  try {
    const order = await OrderService.getOrderById(storeId, orderId);
    res.json(order);
  } catch (err: any) {
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    logger.error('Get order error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED']),
  trackingNumber: z.string().optional(),
});

// PATCH /stores/:storeId/orders/:orderId/status
router.patch('/:storeId/orders/:orderId/status', requirePermission('orders:write'), async (req: Request, res: Response): Promise<void> => {
  const { storeId, orderId } = req.params as { storeId: string, orderId: string };

  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    return;
  }

  const { status, trackingNumber } = parsed.data;

  try {
    const updated = await OrderService.updateOrderStatus(storeId, orderId, status, trackingNumber);
    res.json(updated);
  } catch (err: any) {
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    logger.error('Update order status error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
