import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/auth.permission';
import { recordMetric } from '../services/anomaly';

const router = Router();

const variantSchema = z.object({
    name: z.string().min(1),
    weight: z.number().int().min(0).max(100),
    layout: z.any(), // JSON array of components
});

const experimentSchema = z.object({
    name: z.string().min(1),
    status: z.enum(['DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED']).optional(),
    variants: z.array(variantSchema).optional(),
});

// GET /stores/:storeId/experiments/active - get active experiments (public)
router.get('/:storeId/experiments/active', optionalAuth, async (req: Request, res: Response): Promise<void> => {
    const storeId = req.params.storeId as string;

    const experiments = await prisma.experiment.findMany({
        where: { storeId, status: 'RUNNING' },
        include: { variants: true },
    });

    res.json(experiments);
});

// POST /stores/:storeId/experiments/:experimentId/variants/:variantId/view - track view
router.post('/:storeId/experiments/:experimentId/variants/:variantId/view', optionalAuth, async (req: Request, res: Response): Promise<void> => {
    const storeId = req.params.storeId as string;
    const experimentId = req.params.experimentId as string;
    const variantId = req.params.variantId as string;

    // Verify the variant exists
    const variant = await prisma.variant.findFirst({
        where: { id: variantId, experimentId, experiment: { storeId } },
    });

    if (!variant) {
        res.status(404).json({ error: 'Variant not found' });
        return;
    }

    // Record metric
    await recordMetric('experiment_variant_view', 1, storeId, {
        experimentId,
        variantId,
    });

    res.json({ success: true });
});

// GET /stores/:storeId/experiments - list all experiments (admin)
router.get('/:storeId/experiments', requirePermission('pages:read'), async (req: Request, res: Response): Promise<void> => {
    const storeId = req.params.storeId as string;

    const experiments = await prisma.experiment.findMany({
        where: { storeId },
        include: { variants: true },
        orderBy: { createdAt: 'desc' },
    });

    res.json(experiments);
});

// GET /stores/:storeId/experiments/:experimentId - get single experiment
router.get('/:storeId/experiments/:experimentId', requirePermission('pages:read'), async (req: Request, res: Response): Promise<void> => {
    const storeId = req.params.storeId as string;
    const experimentId = req.params.experimentId as string;

    const experiment = await prisma.experiment.findFirst({
        where: { id: experimentId, storeId },
        include: { variants: true },
    });

    if (!experiment) {
        res.status(404).json({ error: 'Experiment not found' });
        return;
    }

    res.json(experiment);
});

// POST /stores/:storeId/experiments - create experiment
router.post('/:storeId/experiments', requirePermission('pages:write'), async (req: Request, res: Response): Promise<void> => {
    const storeId = req.params.storeId as string;
    const parsed = experimentSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
        return;
    }

    const { name, status, variants } = parsed.data;

    const experiment = await prisma.experiment.create({
        data: {
            storeId,
            name,
            status: status || 'DRAFT',
            variants: {
                create: variants?.map(v => ({
                    name: v.name,
                    weight: v.weight,
                    layout: JSON.stringify(v.layout) !== undefined ? v.layout : [],
                })) || [],
            },
        },
        include: { variants: true },
    });

    res.status(201).json(experiment);
});

// PUT /stores/:storeId/experiments/:experimentId - update experiment
router.put('/:storeId/experiments/:experimentId', requirePermission('pages:write'), async (req: Request, res: Response): Promise<void> => {
    const storeId = req.params.storeId as string;
    const experimentId = req.params.experimentId as string;
    const parsed = experimentSchema.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
        return;
    }

    const existing = await prisma.experiment.findFirst({
        where: { id: experimentId, storeId },
        include: { variants: true },
    });

    if (!existing) {
        res.status(404).json({ error: 'Experiment not found' });
        return;
    }

    const { name, status, variants } = parsed.data;

    // We'll run this in a transaction: update experiment, delete old variants, create new ones
    const updatedExperiment = await prisma.$transaction(async (tx: any) => {
        // 1. Update the experiment fields
        const exp = await tx.experiment.update({
            where: { id: experimentId },
            data: {
                name,
                status,
            },
        });

        // 2. If variants are provided, replace them
        if (variants) {
            await tx.variant.deleteMany({
                where: { experimentId },
            });

            if (variants.length > 0) {
                await tx.variant.createMany({
                    data: variants.map(v => ({
                        experimentId,
                        name: v.name,
                        weight: v.weight,
                        layout: v.layout || [],
                    })),
                });
            }
        }

        return await tx.experiment.findUnique({
            where: { id: experimentId },
            include: { variants: true },
        });
    });

    res.json(updatedExperiment);
});

// DELETE /stores/:storeId/experiments/:experimentId
router.delete('/:storeId/experiments/:experimentId', requirePermission('pages:write'), async (req: Request, res: Response): Promise<void> => {
    const storeId = req.params.storeId as string;
    const experimentId = req.params.experimentId as string;

    const existing = await prisma.experiment.findFirst({
        where: { id: experimentId, storeId },
    });

    if (!existing) {
        res.status(404).json({ error: 'Experiment not found' });
        return;
    }

    await prisma.experiment.delete({
        where: { id: experimentId },
    });

    res.status(204).send();
});

export default router;
