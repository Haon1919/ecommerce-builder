import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/auth.permission';
import { logger } from '../utils/logger';

const router = Router();

const companySchema = z.object({
    name: z.string().min(1),
    taxId: z.string().optional(),
    creditLimit: z.number().optional(),
    priceListId: z.string().optional(),
});

// GET /stores/:storeId/companies
router.get('/:storeId/companies', requirePermission('b2b:read'), async (req: Request, res: Response) => {
    try {
        const companies = await prisma.company.findMany({
            where: { storeId: req.params.storeId as string },
            include: { priceList: true },
            orderBy: { name: 'asc' },
        });
        res.json(companies);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /stores/:storeId/companies
router.post('/:storeId/companies', requirePermission('b2b:write'), async (req: Request, res: Response): Promise<void> => {
    const parsed = companySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
        return;
    }

    try {
        const company = await prisma.company.create({
            data: {
                ...parsed.data,
                storeId: req.params.storeId as string,
            },
            include: { priceList: true },
        });
        res.status(201).json(company);
    } catch (err) {
        logger.error('Create company error', { error: err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /stores/:storeId/companies/:id
router.put('/:storeId/companies/:id', requirePermission('b2b:write'), async (req: Request, res: Response): Promise<void> => {
    const parsed = companySchema.partial().safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
        return;
    }

    try {
        const existing = await prisma.company.findFirst({
            where: { id: req.params.id as string, storeId: req.params.storeId as string }
        });
        if (!existing) {
            res.status(404).json({ error: 'Company not found' });
            return;
        }

        const company = await prisma.company.update({
            where: { id: req.params.id as string },
            data: parsed.data,
            include: { priceList: true },
        });
        res.json(company);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /stores/:storeId/companies/:id
router.delete('/:storeId/companies/:id', requirePermission('b2b:write'), async (req: Request, res: Response): Promise<void> => {
    try {
        const existing = await prisma.company.findFirst({
            where: { id: req.params.id as string, storeId: req.params.storeId as string }
        });
        if (!existing) {
            res.status(404).json({ error: 'Company not found' });
            return;
        }

        await prisma.company.delete({ where: { id: req.params.id as string } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
