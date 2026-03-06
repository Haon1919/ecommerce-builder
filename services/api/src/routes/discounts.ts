import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requirePermission } from '../middleware/auth.permission';
import { logger } from '../utils/logger';
import { NotFoundError } from '../errors';

const router = Router();

const conditionSchema = z.object({
    type: z.enum(['MIN_CART_VALUE', 'CUSTOMER_TAG']),
    value: z.string(),
});

const discountRuleSchema = z.object({
    code: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'BUY_X_GET_Y']),
    value: z.number().or(z.string()).pipe(z.coerce.number()),
    priority: z.number().int().default(0),
    combinable: z.boolean().default(false),
    active: z.boolean().default(true),
    startDate: z.string().datetime().optional().nullable(),
    endDate: z.string().datetime().optional().nullable(),
    buyQuantity: z.number().int().optional().nullable(),
    getQuantity: z.number().int().optional().nullable(),
    buyProductId: z.string().optional().nullable(),
    getProductId: z.string().optional().nullable(),
    conditions: z.array(conditionSchema).optional(),
});

// GET /stores/:storeId/discounts - List discounts
router.get('/:storeId/discounts', requirePermission('discounts:read'), async (req: Request, res: Response): Promise<void> => {
    const { storeId } = req.params as { storeId: string };

    try {
        const discounts = await prisma.discountRule.findMany({
            where: { storeId },
            include: { conditions: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(discounts);
    } catch (err) {
        logger.error('Failed to list discounts', { error: err, storeId });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /stores/:storeId/discounts/:id - Detail view
router.get('/:storeId/discounts/:id', requirePermission('discounts:read'), async (req: Request, res: Response): Promise<void> => {
    const { storeId, id } = req.params as { storeId: string; id: string };

    try {
        const discount = await prisma.discountRule.findFirst({
            where: { id, storeId },
            include: { conditions: true },
        });

        if (!discount) {
            throw new NotFoundError('Discount not found');
        }

        res.json(discount);
    } catch (err) {
        if (err instanceof NotFoundError) {
            res.status(404).json({ error: err.message });
            return;
        }
        logger.error('Failed to get discount', { error: err, storeId, id });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /stores/:storeId/discounts - Create rule
router.post('/:storeId/discounts', requirePermission('discounts:write'), async (req: Request, res: Response): Promise<void> => {
    const { storeId } = req.params as { storeId: string };
    const parsed = discountRuleSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
        return;
    }

    const { conditions, ...ruleData } = parsed.data;

    try {
        const discount = await prisma.discountRule.create({
            data: {
                ...ruleData,
                storeId,
                conditions: {
                    create: conditions || [],
                },
            },
            include: { conditions: true },
        });

        res.status(201).json(discount);
    } catch (err) {
        logger.error('Failed to create discount', { error: err, storeId });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /stores/:storeId/discounts/:id - Update rule
router.put('/:storeId/discounts/:id', requirePermission('discounts:write'), async (req: Request, res: Response): Promise<void> => {
    const { storeId, id } = req.params as { storeId: string; id: string };
    const parsed = discountRuleSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
        return;
    }

    const { conditions, ...ruleData } = parsed.data;

    try {
        // 1. Ensure it exists
        const existing = await prisma.discountRule.findFirst({ where: { id, storeId } });
        if (!existing) {
            throw new NotFoundError('Discount not found');
        }

        // 2. Perform update (re-creating conditions for simplicity in this demo)
        const discount = await prisma.$transaction(async (tx) => {
            // Clear old conditions
            await tx.discountCondition.deleteMany({ where: { ruleId: id } });

            return tx.discountRule.update({
                where: { id },
                data: {
                    ...ruleData,
                    conditions: {
                        create: conditions || [],
                    },
                },
                include: { conditions: true },
            });
        });

        res.json(discount);
    } catch (err) {
        if (err instanceof NotFoundError) {
            res.status(404).json({ error: err.message });
            return;
        }
        logger.error('Failed to update discount', { error: err, storeId, id });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /stores/:storeId/discounts/:id
router.delete('/:storeId/discounts/:id', requirePermission('discounts:write'), async (req: Request, res: Response): Promise<void> => {
    const { storeId, id } = req.params as { storeId: string; id: string };

    try {
        const existing = await prisma.discountRule.findFirst({ where: { id, storeId } });
        if (!existing) {
            throw new NotFoundError('Discount not found');
        }

        await prisma.discountRule.delete({ where: { id } });
        res.status(204).end();
    } catch (err) {
        if (err instanceof NotFoundError) {
            res.status(404).json({ error: err.message });
            return;
        }
        logger.error('Failed to delete discount', { error: err, storeId, id });
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
