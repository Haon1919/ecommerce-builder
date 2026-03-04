import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireStoreAdmin, optionalAuth } from '../middleware/auth';
import { OrderService } from '../services/order.service';
import { logger } from '../utils/logger';

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
    if (err.message.includes('not found') || err.message.includes('Insufficient stock')) {
      res.status(400).json({ error: err.message });
      return;
    }
    logger.error('Create order error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /stores/:storeId/orders - admin order list
router.get('/:storeId/orders', requireStoreAdmin, async (req: Request, res: Response): Promise<void> => {
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
router.get('/:storeId/orders/:orderId', requireStoreAdmin, async (req: Request, res: Response): Promise<void> => {
  const { storeId, orderId } = req.params as { storeId: string, orderId: string };

  try {
    const order = await OrderService.getOrderById(storeId, orderId);
    res.json(order);
  } catch (err: any) {
    if (err.message === 'Order not found') {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    logger.error('Get order error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /stores/:storeId/orders/:orderId/status
router.patch('/:storeId/orders/:orderId/status', requireStoreAdmin, async (req: Request, res: Response): Promise<void> => {
  const { storeId, orderId } = req.params as { storeId: string, orderId: string };
  const { status, trackingNumber } = req.body as { status: string; trackingNumber?: string };

  try {
    const updated = await OrderService.updateOrderStatus(storeId, orderId, status, trackingNumber);
    res.json(updated);
  } catch (err: any) {
    if (err.message === 'Order not found') {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    logger.error('Update order status error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
