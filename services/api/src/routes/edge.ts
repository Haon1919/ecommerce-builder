import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { ProductService } from '../services/product.service';
import { OrderService } from '../services/order.service';
import { logger } from '../utils/logger';
import { NotFoundError, InsufficientStockError } from '../errors';

const router = Router();

// Middleware to require API Key
async function requireApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'API Key required' });
        return;
    }

    const key = header.slice(7);

    try {
        const apiKey = await prisma.apiKey.findUnique({
            where: { key },
            select: { storeId: true, store: { select: { active: true } } },
        });

        if (!apiKey || !apiKey.store.active) {
            res.status(401).json({ error: 'Invalid or inactive API Key' });
            return;
        }

        // Async update to lastUsedAt to avoid blocking the high-performance edge read
        prisma.apiKey.update({ where: { key }, data: { lastUsedAt: new Date() } }).catch((err: any) => {
            logger.error('Failed to update API key lastUsedAt', { error: err });
        });

        // Attach storeId to req
        (req as any).storeId = apiKey.storeId;
        next();
    } catch (err) {
        logger.error('API Key validation error', { error: err });
        res.status(500).json({ error: 'Internal server error' });
    }
}

router.use(requireApiKey);

// GET /api/edge/products
router.get('/products', async (req: Request, res: Response): Promise<void> => {
    const storeId = (req as any).storeId;
    const { category, search, featured, limit, offset, sort } = req.query;

    try {
        const result = await ProductService.listProducts({
            storeId,
            category: category as string,
            search: search as string,
            featured: featured as string,
            limit: limit as string,
            offset: offset as string,
            sort: sort as string,
        });
        res.json(result);
    } catch (err: any) {
        logger.error('Edge: Get products error', { error: err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/edge/products/:productId
router.get('/products/:productId', async (req: Request, res: Response): Promise<void> => {
    const storeId = (req as any).storeId;
    const productId = req.params.productId as string;

    try {
        const product = await ProductService.getProductById(storeId, productId, undefined);
        res.json(product);
    } catch (err: any) {
        if (err instanceof NotFoundError) {
            res.status(404).json({ error: err.message });
            return;
        }
        logger.error('Edge: Get product error', { error: err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

const createOrderSchema = z.object({
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

// POST /api/edge/checkout
router.post('/checkout', async (req: Request, res: Response): Promise<void> => {
    const storeId = (req as any).storeId;

    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
        return;
    }

    // Ensure storeId is included in the payload
    const orderData = { ...parsed.data, storeId };

    try {
        const order = await OrderService.createOrder(storeId, orderData, undefined);
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
        logger.error('Edge: Create order error', { error: err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
