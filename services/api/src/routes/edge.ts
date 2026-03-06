import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { ProductService } from '../services/product.service';
import { OrderService } from '../services/order.service';
import { logger } from '../utils/logger';
import { NotFoundError, InsufficientStockError } from '../errors';
import { discountService, Cart } from '../services/discount';
import { shippingService, ShippingRequest, PackageDimensions } from '../services/shipping';

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

const calculateCartSchema = z.object({
    items: z.array(z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
    })),
    userTags: z.array(z.string()).optional(),
});

const shippingRatesSchema = z.object({
    items: z.array(z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
    })),
    address: z.object({
        line1: z.string(),
        line2: z.string().optional(),
        city: z.string(),
        state: z.string(),
        zip: z.string(),
        country: z.string().default('US'),
    }),
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

// POST /api/edge/checkout/shipping-rates
router.post('/checkout/shipping-rates', async (req: Request, res: Response): Promise<void> => {
    const storeId = (req as any).storeId;

    const parsed = shippingRatesSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
        return;
    }

    try {
        const productIds = parsed.data.items.map(i => i.productId);
        const products = await prisma.product.findMany({
            where: { id: { in: productIds }, storeId },
            select: { id: true, weight: true, length: true, width: true, height: true } as any
        });

        const productMap = new Map((products as any[]).map(p => [p.id, p]));

        const packages: PackageDimensions[] = [];
        for (const item of parsed.data.items) {
            const product = productMap.get(item.productId);
            if (product) {
                // For simplicity, we assume each item is its own package, 
                // but in a real system we'd use a box-packing algorithm.
                for (let i = 0; i < item.quantity; i++) {
                    packages.push({
                        length: product.length || 10,  // Defaults if not set
                        width: product.width || 10,
                        height: product.height || 10,
                        weight: product.weight || 0.5,
                    });
                }
            }
        }

        const shippingRequest: ShippingRequest = {
            origin: {
                line1: 'Store HQ', city: 'Seattle', state: 'WA', zip: '98101', country: 'US'
            }, // In real app, fetch from store settings
            destination: parsed.data.address,
            packages
        };

        const rates = await shippingService.getAllRates(shippingRequest);
        res.json(rates);
    } catch (err: any) {
        logger.error('Edge: Shipping rates error', { error: err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/edge/cart/calculate
router.post('/cart/calculate', async (req: Request, res: Response): Promise<void> => {
    const storeId = (req as any).storeId;

    const parsed = calculateCartSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
        return;
    }

    try {
        // Fetch product prices to build the Cart object
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

        const cart: Cart = { items: cartItems, subtotal };
        const appliedDiscounts = await discountService.calculateBestDiscounts(storeId, cart, parsed.data.userTags || []);

        const totalDiscount = appliedDiscounts.reduce((sum, d) => sum + d.amount, 0);
        const discountedSubtotal = Math.max(0, subtotal - totalDiscount);

        // Fetch settings for tax/shipping
        const settings = await prisma.storeSettings.findUnique({ where: { storeId } });
        const taxRate = settings?.taxRate ?? 0;
        const flatShipping = settings?.flatShippingRate ?? 0;
        const freeShippingAbove = settings?.freeShippingAbove;

        const tax = discountedSubtotal * (taxRate / 100);
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
        logger.error('Edge: Cart calculation error', { error: err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
