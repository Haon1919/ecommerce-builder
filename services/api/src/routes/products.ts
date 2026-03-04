import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { requireStoreAdmin, optionalAuth } from '../middleware/auth';
import { ProductService } from '../services/product.service';
import { logger } from '../utils/logger';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const productSchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  price: z.number().positive(),
  comparePrice: z.number().positive().optional(),
  stock: z.number().int().min(0).default(0),
  trackStock: z.boolean().default(true),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  images: z.array(z.string().url()).default([]),
  variants: z.unknown().optional(),
  modelUrl: z.string().url().optional().nullable(),
  arEnabled: z.boolean().default(false),
  weight: z.number().positive().optional(),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
});

// GET /stores/:storeId/products - public product listing
router.get('/:storeId/products', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  const { storeId } = req.params as { storeId: string };
  const { category, search, featured, limit, offset, sort } = req.query;

  try {
    const result = await ProductService.listProducts({
      storeId,
      category,
      search,
      featured,
      limit: limit as string,
      offset: offset as string,
      sort: sort as string,
      user: req.user,
    });
    res.json(result);
  } catch (err: any) {
    logger.error('Get products error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /stores/:storeId/products/:productId
router.get('/:storeId/products/:productId', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  const { storeId, productId } = req.params as { storeId: string, productId: string };

  try {
    const product = await ProductService.getProductById(storeId, productId, req.user);
    res.json(product);
  } catch (err: any) {
    if (err.message === 'Product not found') {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    logger.error('Get product error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /stores/:storeId/products - admin create product
router.post('/:storeId/products', requireStoreAdmin, async (req: Request, res: Response): Promise<void> => {
  const { storeId } = req.params as { storeId: string };

  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    return;
  }

  try {
    const product = await ProductService.createProduct(storeId, parsed.data);
    res.status(201).json(product);
  } catch (err: any) {
    logger.error('Create product error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /stores/:storeId/products/:productId - admin update product
router.put('/:storeId/products/:productId', requireStoreAdmin, async (req: Request, res: Response): Promise<void> => {
  const { storeId, productId } = req.params as { storeId: string, productId: string };

  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    return;
  }

  try {
    const product = await ProductService.updateProduct(storeId, productId, parsed.data);
    res.json(product);
  } catch (err: any) {
    if (err.message === 'Product not found') {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    logger.error('Update product error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /stores/:storeId/products/:productId
router.delete('/:storeId/products/:productId', requireStoreAdmin, async (req: Request, res: Response): Promise<void> => {
  const { storeId, productId } = req.params as { storeId: string, productId: string };

  try {
    const result = await ProductService.deleteProduct(storeId, productId);
    res.json(result);
  } catch (err: any) {
    if (err.message === 'Product not found') {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    logger.error('Delete product error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /stores/:storeId/products/:productId/generate-3d
router.post('/:storeId/products/:productId/generate-3d', requireStoreAdmin, async (req: Request, res: Response): Promise<void> => {
  const { storeId, productId } = req.params as { storeId: string, productId: string };

  try {
    const result = await ProductService.generate3dModel(storeId, productId);
    res.status(202).json(result);
  } catch (err: any) {
    if (err.message === 'Product not found') {
      res.status(404).json({ error: 'Product not found' });
      return;
    } else if (err.message.includes('must have at least one image')) {
      res.status(400).json({ error: err.message });
      return;
    }
    logger.error('Generate 3D model error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /stores/:storeId/products/bulk-import - CSV/JSON bulk import
router.post('/:storeId/products/bulk-import', requireStoreAdmin, async (req: Request, res: Response): Promise<void> => {
  const { storeId } = req.params as { storeId: string };
  const { products } = req.body as { products: unknown[] };

  if (!Array.isArray(products) || products.length === 0) {
    res.status(400).json({ error: 'Products array required' });
    return;
  }

  const validated: z.infer<typeof productSchema>[] = [];
  const errors: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < products.length; i++) {
    const parsed = productSchema.safeParse(products[i]);
    if (parsed.success) {
      validated.push(parsed.data);
    } else {
      errors.push({ index: i, error: parsed.error.errors[0].message });
    }
  }

  try {
    const result = await ProductService.bulkImportProducts(storeId, validated);
    res.json({
      created: result.created,
      failed: errors.length,
      errors: errors.slice(0, 10),
    });
  } catch (err: any) {
    logger.error('Bulk import error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
