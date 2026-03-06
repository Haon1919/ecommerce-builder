import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../db';
import { requireStoreAdmin, requireSuperAdmin } from '../middleware/auth';
import { encrypt, decrypt } from '../services/encryption';
import { processAdminChat } from '../services/admin-gemini';

const router = Router();

const storeSettingsSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  logoUrl: z.string().url().optional().nullable(),
  faviconUrl: z.string().url().optional().nullable(),
  theme: z.enum(['TAILWIND', 'BOOTSTRAP', 'BULMA', 'PICO']).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  gaId: z.string().optional().nullable(),
  customDomain: z.string().optional().nullable(),
});

const storeSettingsExtSchema = z.object({
  contactEmail: z.string().email().optional(),
  shippingPolicy: z.string().optional(),
  returnPolicy: z.string().optional(),
  privacyPolicy: z.string().optional(),
  aboutText: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  currency: z.string().length(3).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  freeShippingAbove: z.number().positive().optional().nullable(),
  flatShippingRate: z.number().min(0).optional(),
  stripePublicKey: z.string().optional(),
  stripeSecretKey: z.string().optional(), // Will be encrypted
  geminiApiKey: z.string().optional(), // Will be encrypted
});

// GET /stores/:storeId - get store info (public)
router.get('/:storeId', async (req: Request, res: Response): Promise<void> => {
  const storeId = req.params.storeId as string;

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      id: true, slug: true, name: true, description: true,
      logoUrl: true, faviconUrl: true, theme: true, primaryColor: true,
      configured: true, gaId: true, customDomain: true, active: true, tier: true,
      settings: {
        select: {
          contactEmail: true, shippingPolicy: true, returnPolicy: true,
          privacyPolicy: true, aboutText: true, metaTitle: true,
          metaDescription: true, currency: true, taxRate: true,
          freeShippingAbove: true, flatShippingRate: true, stripePublicKey: true,
        },
      },
    },
  });

  if (!store || !store.active) {
    res.status(404).json({ error: 'Store not found' });
    return;
  }

  res.json(store);
});

// GET /stores/slug/:slug - get store by slug (public)
router.get('/slug/:slug', async (req: Request, res: Response): Promise<void> => {
  const slug = req.params.slug as string;

  const store = await prisma.store.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, name: true, description: true,
      logoUrl: true, faviconUrl: true, theme: true, primaryColor: true,
      configured: true, gaId: true, customDomain: true, tier: true,
      settings: {
        select: {
          contactEmail: true, currency: true, taxRate: true,
          freeShippingAbove: true, flatShippingRate: true,
          stripePublicKey: true, metaTitle: true, metaDescription: true,
        },
      },
    },
  });

  if (!store) {
    res.status(404).json({ error: 'Store not found' });
    return;
  }

  res.json(store);
});

// PUT /stores/:storeId - update store (admin)
router.put('/:storeId', requireStoreAdmin, async (req: Request, res: Response): Promise<void> => {
  const storeId = req.params.storeId as string;
  const parsed = storeSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    return;
  }

  const store = await prisma.store.update({
    where: { id: storeId },
    data: parsed.data,
  });

  res.json(store);
});

// PUT /stores/:storeId/settings - update store settings
router.put('/:storeId/settings', requireStoreAdmin, async (req: Request, res: Response): Promise<void> => {
  const storeId = req.params.storeId as string;
  const parsed = storeSettingsExtSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    return;
  }

  const data: Record<string, unknown> = { ...parsed.data };

  // Encrypt sensitive keys before storage
  if (parsed.data.stripeSecretKey) {
    data.stripeSecretKey = encrypt(parsed.data.stripeSecretKey);
  }
  if (parsed.data.geminiApiKey) {
    data.geminiApiKeyEnc = encrypt(parsed.data.geminiApiKey);
    delete data.geminiApiKey;
  }

  const settings = await prisma.storeSettings.upsert({
    where: { storeId },
    create: { storeId, ...data },
    update: data,
  });

  // Return settings without encrypted values
  res.json({
    ...settings,
    stripeSecretKey: settings.stripeSecretKey ? '***configured***' : null,
    geminiApiKeyEnc: settings.geminiApiKeyEnc ? '***configured***' : null,
  });
});

// POST /stores/:storeId/admin-chat - admin chat with store context
router.post('/:storeId/admin-chat', requireStoreAdmin, async (req: Request, res: Response): Promise<void> => {
  const storeId = req.params.storeId as string;
  const { message, history = [] } = req.body;

  if (!message) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  // Retrieve gemini API key (if custom one is set)
  const storeSettings = await prisma.storeSettings.findUnique({
    where: { storeId },
    select: { geminiApiKeyEnc: true },
  });

  const storeGeminiKey = storeSettings?.geminiApiKeyEnc ? decrypt(storeSettings.geminiApiKeyEnc) : undefined;

  const result = await processAdminChat(storeId, message, history, storeGeminiKey);

  res.json(result);
});

// GET /stores - super admin list all stores
router.get('/', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { limit = '20', offset = '0', active } = req.query;

  const where: Record<string, unknown> = {};
  if (active !== undefined) where.active = active === 'true';

  const [stores, total] = await Promise.all([
    prisma.store.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      select: {
        id: true, slug: true, name: true, active: true, configured: true,
        theme: true, tier: true, customDomain: true, createdAt: true,
        _count: { select: { products: true, orders: true, users: true } },
      },
    }),
    prisma.store.count({ where: where as any }),
  ]);

  res.json({ stores, total });
});

// PATCH /stores/:storeId/active - super admin toggle store active
router.patch('/:storeId/active', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const storeId = req.params.storeId as string;
  const { active } = req.body as { active: boolean };

  const store = await prisma.store.update({
    where: { id: storeId },
    data: { active },
    select: { id: true, slug: true, name: true, active: true },
  });

  res.json(store);
});

// ==================== API KEYS (EDGE API) ====================

// GET /stores/:storeId/api-keys - list api keys
router.get('/:storeId/api-keys', requireStoreAdmin, async (req: Request, res: Response): Promise<void> => {
  const storeId = req.params.storeId as string;

  const keys = await prisma.apiKey.findMany({
    where: { storeId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, key: true, lastUsedAt: true, createdAt: true },
  });

  // Mask keys for display: reveal only last 4 chars
  const maskedKeys = keys.map(k => ({
    ...k,
    key: `••••••••••••${k.key.slice(-4)}`,
  }));

  res.json(maskedKeys);
});

// POST /stores/:storeId/api-keys - generate a new api key
router.post('/:storeId/api-keys', requireStoreAdmin, async (req: Request, res: Response): Promise<void> => {
  const storeId = req.params.storeId as string;
  const { name } = req.body;

  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { tier: true },
  });

  if (!store || (store.tier !== 'GROWTH' && store.tier !== 'ENTERPRISE')) {
    res.status(403).json({ error: 'API Keys require GROWTH tier or higher' });
    return;
  }

  const rawKey = `edge_live_${crypto.randomBytes(24).toString('hex')}`;

  const apiKey = await prisma.apiKey.create({
    data: {
      storeId,
      name,
      key: rawKey,
    },
  });

  res.status(201).json(apiKey);
});

// DELETE /stores/:storeId/api-keys/:id - revoke an api key
router.delete('/:storeId/api-keys/:id', requireStoreAdmin, async (req: Request, res: Response): Promise<void> => {
  const { storeId, id } = req.params as { storeId: string; id: string };

  try {
    await prisma.apiKey.delete({
      where: { id, storeId },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(404).json({ error: 'API Key not found or does not belong to this store' });
  }
});

export default router;
