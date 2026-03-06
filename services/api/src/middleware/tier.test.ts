import { Request, Response, NextFunction } from 'express';
import { requireTier, SubscriptionTier } from './tier';
import { prisma } from '../db';

jest.mock('../db', () => ({
    prisma: {
        store: {
            findUnique: jest.fn(),
        },
    },
}));

jest.mock('../config', () => ({
    config: {
        ...jest.requireActual('../config').config,
        features: {
            bypassTierChecks: false,
        },
        logging: {
            level: 'info',
            structured: false,
        }
    },
}));

describe('Tier Middleware', () => {
    let req: Partial<Request & { storeId?: string }>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
        req = { params: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        next = jest.fn();
        jest.clearAllMocks();
    });

    it('blocks if storeId is missing', async () => {
        const middleware = requireTier(SubscriptionTier.GROWTH);
        await middleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Store ID is required for tier check' });
        expect(next).not.toHaveBeenCalled();
    });

    it('blocks if store is not found', async () => {
        req.params = { storeId: 'store-1' };
        (prisma.store.findUnique as jest.Mock).mockResolvedValue(null);

        const middleware = requireTier(SubscriptionTier.GROWTH);
        await middleware(req as Request, res as Response, next);

        expect(prisma.store.findUnique).toHaveBeenCalledWith({ where: { id: 'store-1' }, select: { tier: true } });
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Store not found' });
        expect(next).not.toHaveBeenCalled();
    });

    it('allows access if tier is equal to required', async () => {
        req.params = { storeId: 'store-1' };
        (prisma.store.findUnique as jest.Mock).mockResolvedValue({ tier: 'GROWTH' });

        const middleware = requireTier(SubscriptionTier.GROWTH);
        await middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('allows access if tier is higher than required', async () => {
        req.params = { storeId: 'store-1' };
        (prisma.store.findUnique as jest.Mock).mockResolvedValue({ tier: 'ENTERPRISE' });

        const middleware = requireTier(SubscriptionTier.GROWTH);
        await middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('blocks access if tier is lower than required', async () => {
        req.params = { storeId: 'store-1' };
        (prisma.store.findUnique as jest.Mock).mockResolvedValue({ tier: 'STARTER' });

        const middleware = requireTier(SubscriptionTier.GROWTH);
        await middleware(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Subscription tier too low',
            requiredTier: 'GROWTH',
            currentTier: 'STARTER',
        });
        expect(next).not.toHaveBeenCalled();
    });

    it('uses attached storeId from previous middleware if params.storeId is unavailable', async () => {
        req.params = {};
        req.storeId = 'attached-store-2';
        (prisma.store.findUnique as jest.Mock).mockResolvedValue({ tier: 'ENTERPRISE' });

        const middleware = requireTier(SubscriptionTier.GROWTH);
        await middleware(req as Request, res as Response, next);

        expect(prisma.store.findUnique).toHaveBeenCalledWith({ where: { id: 'attached-store-2' }, select: { tier: true } });
        expect(next).toHaveBeenCalled();
    });
});
