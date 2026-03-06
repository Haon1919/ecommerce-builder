import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { logger } from '../utils/logger';
import { config } from '../config';

export enum SubscriptionTier {
    STARTER = 'STARTER',
    GROWTH = 'GROWTH',
    ENTERPRISE = 'ENTERPRISE',
}

const TIER_LEVELS: Record<SubscriptionTier, number> = {
    [SubscriptionTier.STARTER]: 0,
    [SubscriptionTier.GROWTH]: 1,
    [SubscriptionTier.ENTERPRISE]: 2,
};

export function requireTier(minimumTier: SubscriptionTier) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (config.features.bypassTierChecks) {
                next();
                return;
            }

            // Store ID can be in params or attached by previous middleware like requireStoreAdmin
            const rawStoreId = req.params.storeId || (req as Request & { storeId?: string }).storeId;
            const requestStoreId = Array.isArray(rawStoreId) ? rawStoreId[0] : rawStoreId;

            if (!requestStoreId) {
                res.status(400).json({ error: 'Store ID is required for tier check' });
                return;
            }

            const store = await prisma.store.findUnique({
                where: { id: requestStoreId },
                select: { tier: true },
            });

            if (!store) {
                res.status(404).json({ error: 'Store not found' });
                return;
            }

            // Safe cast back to SubscriptionTier string in case Prisma returns the literal union type
            const currentTier = store.tier as unknown as SubscriptionTier;

            const currentTierLevel = TIER_LEVELS[currentTier];
            const requiredTierLevel = TIER_LEVELS[minimumTier];

            if (currentTierLevel < requiredTierLevel) {
                res.status(403).json({
                    error: 'Subscription tier too low',
                    requiredTier: minimumTier,
                    currentTier: currentTier,
                });
                return;
            }

            next();
        } catch (error) {
            logger.error('Tier check failed', { error });
            res.status(500).json({ error: 'Internal server error during tier check' });
        }
    };
}
