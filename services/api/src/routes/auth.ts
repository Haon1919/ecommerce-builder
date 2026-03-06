import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db';
import { signToken, requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  storeSlug: z.string().optional(), // undefined = super admin login
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  storeSlug: z.string().min(1),
  storeName: z.string().min(1),
});

// POST /auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    return;
  }

  const { email, password, storeSlug } = parsed.data;

  try {
    // Super admin login (no storeSlug)
    if (!storeSlug) {
      const admin = await prisma.superAdmin.findUnique({ where: { email } });
      if (!admin || !admin.active) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const valid = await bcrypt.compare(password, admin.password);
      if (!valid) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const token = signToken({
        sub: admin.id,
        email: admin.email,
        role: 'SUPER_ADMIN',
        type: 'SUPER_ADMIN',
      });

      await prisma.superAdmin.update({
        where: { id: admin.id },
        data: { lastLoginAt: new Date() },
      });

      res.json({ token, user: { id: admin.id, email: admin.email, name: admin.name, role: 'SUPER_ADMIN' } });
      return;
    }

    // Store admin login
    const store = await prisma.store.findUnique({ where: { slug: storeSlug } });
    if (!store || !store.active) {
      res.status(401).json({ error: 'Store not found' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email_storeId: { email, storeId: store.id } },
      include: { role: true }
    });
    if (!user || !user.active) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = signToken({
      sub: user.id,
      email: user.email,
      role: user.roleId,
      storeId: store.id,
      type: 'USER',
    });

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role.name },
      store: { id: store.id, slug: store.slug, name: store.name, configured: store.configured },
    });
  } catch (err) {
    logger.error('Login error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/register (creates a new store + owner account)
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    return;
  }

  const { email, password, name, storeSlug, storeName } = parsed.data;

  try {
    // Check slug uniqueness
    const existing = await prisma.store.findUnique({ where: { slug: storeSlug } });
    if (existing) {
      res.status(409).json({ error: 'Store slug already taken' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const store = await prisma.store.create({
      data: {
        slug: storeSlug,
        name: storeName,
        roles: {
          create: [
            { name: 'Owner', description: 'Full access to all store resources', isStatic: true, permissions: { create: [{ action: '*:*' }] } },
            { name: 'Product Manager', description: 'Can manage products and inventory', isStatic: true, permissions: { create: [{ action: 'products:*' }] } },
            { name: 'Support', description: 'Can view orders and manage support tickets', isStatic: true, permissions: { create: [{ action: 'tickets:*' }, { action: 'orders:read' }] } }
          ]
        },
        pages: {
          createMany: {
            data: [
              { type: 'LANDING', slug: '', title: 'Home', layout: JSON.stringify(defaultLandingLayout()) },
              { type: 'PRODUCTS', slug: 'products', title: 'Products', layout: JSON.stringify(defaultProductsLayout()) },
              { type: 'CART', slug: 'cart', title: 'Cart', layout: JSON.stringify([]) },
              { type: 'CHECKOUT', slug: 'cart/checkout', title: 'Checkout', layout: JSON.stringify([]) },
              { type: 'CONFIRMATION', slug: 'cart/confirmation', title: 'Order Confirmation', layout: JSON.stringify([]) },
              { type: 'CONTACT', slug: 'contact', title: 'Contact Us', layout: JSON.stringify([]) },
            ],
          },
        },
      },
      include: { roles: true },
    });

    const ownerRole = store.roles.find(r => r.name === 'Owner');
    if (!ownerRole) throw new Error('Owner role was not created');

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        storeId: store.id,
        roleId: ownerRole.id,
      },
      include: { role: true }
    });

    const token = signToken({
      sub: user.id,
      email: user.email,
      role: user.roleId,
      storeId: store.id,
      type: 'USER',
    });

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role.name },
      store: { id: store.id, slug: store.slug, name: store.name, configured: false },
    });
  } catch (err) {
    logger.error('Registration error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /auth/me
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user?.type === 'SUPER_ADMIN') {
      const admin = await prisma.superAdmin.findUnique({
        where: { id: req.user.sub },
        select: { id: true, email: true, name: true },
      });
      res.json({ user: { ...admin, role: 'SUPER_ADMIN' } });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user?.sub },
      select: { id: true, email: true, name: true, role: true, storeId: true, store: { select: { id: true, slug: true, name: true, configured: true, theme: true, primaryColor: true } } },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user: { ...user, role: user.role?.name } });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Default page layouts for new stores
export function defaultLandingLayout() {
  return [
    {
      id: 'hero-1',
      type: 'HeroSection',
      order: 0,
      props: {
        title: 'Welcome to Our Store',
        subtitle: 'Discover our amazing collection',
        ctaText: 'Shop Now',
        ctaLink: '/products',
        backgroundImage: null,
        backgroundColor: '#6366f1',
        textColor: '#ffffff',
      },
    },
    {
      id: 'featured-1',
      type: 'FeaturedProducts',
      order: 1,
      props: { title: 'Featured Products', count: 4 },
    },
  ];
}

export function defaultProductsLayout() {
  return [
    {
      id: 'products-header',
      type: 'Heading',
      order: 0,
      props: { text: 'Our Products', level: 'h1', align: 'center' },
    },
    {
      id: 'product-grid',
      type: 'ProductGrid',
      order: 1,
      props: { columns: 3, showFilters: true },
    },
  ];
}

export default router;
