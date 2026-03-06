import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { shippingService, ShippingRequest, PackageDimensions } from '../services/shipping';
import { logger } from '../utils/logger';

const router = Router();

const shippingRatesSchema = z.object({
    storeId: z.string(),
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

// POST /api/checkout/shipping-rates
router.post('/shipping-rates', async (req: Request, res: Response): Promise<void> => {
    const parsed = shippingRatesSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
        return;
    }

    const { storeId, items, address } = parsed.data;

    try {
        const productIds = items.map(i => i.productId);
        const products = await prisma.product.findMany({
            where: { id: { in: productIds }, storeId },
            select: { id: true, weight: true, length: true, width: true, height: true } as any
        });

        const productMap = new Map((products as any[]).map(p => [p.id, p]));

        const packages: PackageDimensions[] = [];
        for (const item of items) {
            const product = productMap.get(item.productId);
            if (product) {
                for (let i = 0; i < item.quantity; i++) {
                    packages.push({
                        length: product.length || 10,
                        width: product.width || 10,
                        height: product.height || 10,
                        weight: product.weight || 0.5,
                    });
                }
            }
        }

        const shippingRequest: ShippingRequest = {
            origin: { line1: 'Store HQ', city: 'Seattle', state: 'WA', zip: '98101', country: 'US' },
            destination: address,
            packages
        };

        const rates = await shippingService.getAllRates(shippingRequest);
        res.json(rates);
    } catch (err: any) {
        logger.error('Checkout: Shipping rates error', { error: err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
