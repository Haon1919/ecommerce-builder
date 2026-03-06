import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireStoreAdmin, optionalAuth } from '../middleware/auth';

const router = Router();

const componentSchema = z.object({
  id: z.string(),
  type: z.string(),
  order: z.number(),
  props: z.record(z.unknown()),
});

const pageSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-/]*$/),
  title: z.string().min(1),
  type: z.enum(['LANDING', 'PRODUCTS', 'PRODUCT_DETAIL', 'CART', 'CHECKOUT', 'CONFIRMATION', 'CONTACT', 'ABOUT', 'CUSTOM']).optional(),
  layout: z.array(componentSchema).default([]),
  seoTitle: z.string().optional(),
  seoDesc: z.string().optional(),
  published: z.boolean().default(false),
});

// GET /stores/:storeId/pages - combined endpoint
// Admin users get the full page list; unauthenticated storefront requests
// get just the root/landing page (empty slug).
router.get('/:storeId/pages', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  const storeId = req.params.storeId as string;
  const isAdmin = req.user?.storeId === storeId || req.user?.type === 'SUPER_ADMIN';

  if (isAdmin) {
    // Admin: return the full page list
    const pages = await prisma.page.findMany({
      where: { storeId },
      orderBy: { type: 'asc' },
      select: { id: true, slug: true, title: true, type: true, published: true, updatedAt: true },
    });
    res.json(pages);
    return;
  }

  // Public: return the root landing page
  const page = await prisma.page.findFirst({
    where: { storeId, slug: '', published: true },
  });

  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }

  res.json(page);
});

// GET /stores/:storeId/pages/:slug - get page by slug (public)
router.get('/:storeId/pages/:slug(*)', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  const storeId = req.params.storeId as string;
  const slug = (req.params.slug as string) || '';
  const isAdmin = req.user?.storeId === storeId || req.user?.type === 'SUPER_ADMIN';

  const page = await prisma.page.findFirst({
    where: {
      storeId,
      slug,
      ...(isAdmin ? {} : { published: true }),
    },
  });

  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }

  res.json(page);
});

// POST /stores/:storeId/pages - create page
router.post('/:storeId/pages', requireStoreAdmin, async (req: Request, res: Response): Promise<void> => {
  const storeId = req.params.storeId as string;
  const parsed = pageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    return;
  }

  const existing = await prisma.page.findFirst({ where: { storeId, slug: parsed.data.slug } });
  if (existing) {
    res.status(409).json({ error: 'A page with this slug already exists' });
    return;
  }

  const page = await prisma.page.create({
    data: {
      ...parsed.data,
      storeId,
      layout: JSON.stringify(parsed.data.layout),
    },
  });

  res.status(201).json(page);
});

// PUT /stores/:storeId/pages/:pageId - update page layout
router.put('/:storeId/pages/:pageId', requireStoreAdmin, async (req: Request, res: Response): Promise<void> => {
  const storeId = req.params.storeId as string;
  const pageId = req.params.pageId as string;

  const parsed = pageSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    return;
  }

  const existing = await prisma.page.findFirst({ where: { id: pageId, storeId } });
  if (!existing) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }

  const updates: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.layout !== undefined) {
    updates.layout = JSON.stringify(parsed.data.layout);
  }

  const page = await prisma.page.update({ where: { id: pageId }, data: updates });
  res.json(page);
});

// POST /stores/:storeId/pages/:pageId/publish
router.post('/:storeId/pages/:pageId/publish', requireStoreAdmin, async (req: Request, res: Response): Promise<void> => {
  const storeId = req.params.storeId as string;
  const pageId = req.params.pageId as string;
  const { published } = req.body as { published: boolean };

  const existing = await prisma.page.findFirst({ where: { id: pageId, storeId } });
  if (!existing) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }

  const page = await prisma.page.update({ where: { id: pageId }, data: { published } });
  res.json(page);
});

// POST /stores/:storeId/configure - mark store as configured
router.post('/:storeId/configure', requireStoreAdmin, async (req: Request, res: Response): Promise<void> => {
  const storeId = req.params.storeId as string;

  await prisma.store.update({ where: { id: storeId }, data: { configured: true } });
  res.json({ success: true });
});

export default router;
