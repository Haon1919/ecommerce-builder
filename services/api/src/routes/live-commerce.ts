import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/auth.permission';
import { requireTier, SubscriptionTier } from '../middleware/tier';
import { LiveCommerceService } from '../services/live-commerce.service';
import { logger } from '../utils/logger';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('video/')) {
            cb(new Error('Only video files are allowed'));
            return;
        }
        cb(null, true);
    },
});

const uploadSchema = z.object({
    title: z.string().min(1).max(200),
    productIds: z.string().optional() // JSON stringified array of ids
});

// POST /stores/:storeId/videos
router.post(
    '/:storeId/videos',
    requirePermission('products:write'),
    requireTier(SubscriptionTier.GROWTH),
    upload.single('video'),
    async (req: Request, res: Response): Promise<void> => {
        const storeId = req.params.storeId as string;

        if (!req.file) {
            res.status(400).json({ error: 'Video file is required' });
            return;
        }

        const parsed = uploadSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
            return;
        }

        let parsedProductIds: string[] = [];
        if (parsed.data.productIds) {
            try {
                parsedProductIds = JSON.parse(parsed.data.productIds);
                if (!Array.isArray(parsedProductIds)) throw new Error('Must be array');
            } catch {
                res.status(400).json({ error: 'productIds must be a JSON array of strings' });
                return;
            }
        }

        try {
            const video = await LiveCommerceService.uploadVideo(storeId, req.file, parsed.data.title, parsedProductIds);
            res.status(201).json(video);
        } catch (err: any) {
            logger.error('Upload video error', { error: err });
            res.status(500).json({ error: err.message || 'Internal server error' });
        }
    }
);

// GET /stores/:storeId/videos
router.get('/:storeId/videos', optionalAuth, async (req: Request, res: Response): Promise<void> => {
    const storeId = req.params.storeId as string;
    const { limit } = req.query;

    try {
        const videos = await LiveCommerceService.getVideos(storeId, limit ? parseInt(limit as string) : 20);
        res.json(videos);
    } catch (err: any) {
        logger.error('Get videos error', { error: err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
