import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireStoreAdmin } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

const priceListSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    prices: z.record(z.string(), z.number()).optional(),
});

// GET /stores/:storeId/pricelists
router.get('/:storeId/pricelists', requireStoreAdmin, async (req: Request, res: Response) => {
    try {
        const lists = await prisma.priceList.findMany({
            where: { storeId: req.params.storeId as string },
            orderBy: { name: 'asc' },
        });
        res.json(lists);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /stores/:storeId/pricelists/:id
router.get('/:storeId/pricelists/:id', requireStoreAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const list = await prisma.priceList.findFirst({
            where: { id: req.params.id as string, storeId: req.params.storeId as string },
        });
        if (!list) {
            res.status(404).json({ error: 'PriceList not found' });
            return;
        }
        res.json(list);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /stores/:storeId/pricelists
router.post('/:storeId/pricelists', requireStoreAdmin, async (req: Request, res: Response): Promise<void> => {
    const parsed = priceListSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
        return;
    }

    try {
        const list = await prisma.priceList.create({
            data: {
                ...parsed.data,
                storeId: req.params.storeId as string,
                prices: parsed.data.prices ?? {},
            },
        });
        res.status(201).json(list);
    } catch (err) {
        logger.error('Create pricelist error', { error: err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /stores/:storeId/pricelists/:id
router.put('/:storeId/pricelists/:id', requireStoreAdmin, async (req: Request, res: Response): Promise<void> => {
    const parsed = priceListSchema.partial().safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
        return;
    }

    try {
        const existing = await prisma.priceList.findFirst({
            where: { id: req.params.id as string, storeId: req.params.storeId as string }
        });
        if (!existing) {
            res.status(404).json({ error: 'PriceList not found' });
            return;
        }

        const list = await prisma.priceList.update({
            where: { id: req.params.id as string },
            data: parsed.data,
        });
        res.json(list);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /stores/:storeId/pricelists/:id
router.delete('/:storeId/pricelists/:id', requireStoreAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
        const existing = await prisma.priceList.findFirst({
            where: { id: req.params.id as string, storeId: req.params.storeId as string }
        });
        if (!existing) {
            res.status(404).json({ error: 'PriceList not found' });
            return;
        }

        await prisma.priceList.delete({ where: { id: req.params.id as string } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
