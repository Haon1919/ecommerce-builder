import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireStoreAdmin } from '../middleware/auth';
import { requireTier, SubscriptionTier } from '../middleware/tier';
import { logger } from '../utils/logger';
import { encrypt, decrypt } from '../services/encryption';

const router = Router();

// Only ENTERPRISE stores can access the Vendor APIs
router.use(requireStoreAdmin);
router.use(requireTier(SubscriptionTier.ENTERPRISE));

const vendorSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    logoUrl: z.string().url().optional().nullable(),
    payoutEnabled: z.boolean().optional(),
    stripeAccountId: z.string().optional().nullable(),
    active: z.boolean().optional(),
});

function mapVendorForClient(vendor: any) {
    let maskedId = null;
    if (vendor.stripeAccountIdEnc) {
        const decrypted = decrypt(vendor.stripeAccountIdEnc);
        if (decrypted.length > 8) {
            maskedId = decrypted.substring(0, 5) + '*****' + decrypted.substring(decrypted.length - 4);
        } else {
            maskedId = '*****';
        }
    }
    const { stripeAccountIdEnc, ...rest } = vendor;
    return { ...rest, stripeAccountId: maskedId };
}

// GET /stores/:storeId/vendors
router.get('/:storeId/vendors', async (req: Request, res: Response): Promise<void> => {
    try {
        const storeId = req.params.storeId as string;
        const vendors = await prisma.vendor.findMany({
            where: { storeId: storeId },
            orderBy: { createdAt: 'desc' },
        });
        res.json(vendors.map(mapVendorForClient));
    } catch (err: any) {
        logger.error('List vendors error', { error: err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /stores/:storeId/vendors
router.post('/:storeId/vendors', async (req: Request, res: Response): Promise<void> => {
    try {
        const storeId = req.params.storeId as string;
        const parsed = vendorSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
            return;
        }

        const { stripeAccountId, ...restData } = parsed.data;
        const dataToSave: any = { ...restData, storeId };
        if (stripeAccountId) {
            dataToSave.stripeAccountIdEnc = encrypt(stripeAccountId);
        }

        const vendor = await prisma.vendor.create({
            data: dataToSave,
        });

        res.status(201).json(mapVendorForClient(vendor));
    } catch (err: any) {
        logger.error('Create vendor error', { error: err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /stores/:storeId/vendors/:vendorId
router.get('/:storeId/vendors/:vendorId', async (req: Request, res: Response): Promise<void> => {
    try {
        const storeId = req.params.storeId as string;
        const vendorId = req.params.vendorId as string;
        const vendor = await prisma.vendor.findFirst({
            where: { id: vendorId, storeId },
        });

        if (!vendor) {
            res.status(404).json({ error: 'Vendor not found' });
            return;
        }

        res.json(mapVendorForClient(vendor));
    } catch (err: any) {
        logger.error('Get vendor error', { error: err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /stores/:storeId/vendors/:vendorId
router.put('/:storeId/vendors/:vendorId', async (req: Request, res: Response): Promise<void> => {
    try {
        const storeId = req.params.storeId as string;
        const vendorId = req.params.vendorId as string;
        const parsed = vendorSchema.partial().safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
            return;
        }

        const { stripeAccountId, ...restData } = parsed.data;
        const dataToUpdate: any = { ...restData };
        if (stripeAccountId !== undefined) {
            if (stripeAccountId === null || stripeAccountId.trim() === '') {
                dataToUpdate.stripeAccountIdEnc = null;
            } else if (!stripeAccountId.includes('*****')) {
                dataToUpdate.stripeAccountIdEnc = encrypt(stripeAccountId);
            }
        }

        const vendorIdStr = Array.isArray(vendorId) ? vendorId[0] : vendorId;
        const storeIdStr = Array.isArray(storeId) ? storeId[0] : storeId;
        const vendor = await prisma.vendor.update({
            where: { id: vendorIdStr, storeId: storeIdStr },
            data: dataToUpdate,
        });

        res.json(mapVendorForClient(vendor));
    } catch (err: any) {
        if (err.code === 'P2025') {
            res.status(404).json({ error: 'Vendor not found' });
            return;
        }
        logger.error('Update vendor error', { error: err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
