import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { encrypt, encryptJson } from '../src/services/encryption';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ---------------------------------------------------------------------------
  // Credentials MUST come from environment — never fall back to hardcoded values
  // ---------------------------------------------------------------------------
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
  const demoAdminEmail = process.env.DEMO_STORE_ADMIN_EMAIL;
  const demoAdminPassword = process.env.DEMO_STORE_ADMIN_PASSWORD;

  const missing = [
    !superAdminEmail && 'SUPER_ADMIN_EMAIL',
    !superAdminPassword && 'SUPER_ADMIN_PASSWORD',
    !demoAdminEmail && 'DEMO_STORE_ADMIN_EMAIL',
    !demoAdminPassword && 'DEMO_STORE_ADMIN_PASSWORD',
  ].filter(Boolean);

  if (missing.length > 0) {
    console.error(`Seed aborted. Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  const existing = await prisma.superAdmin.findUnique({ where: { email: superAdminEmail! } });
  if (!existing) {
    await prisma.superAdmin.create({
      data: {
        email: superAdminEmail!,
        password: await bcrypt.hash(superAdminPassword!, 12),
        name: 'Super Admin',
      },
    });
    console.log(`Created super admin: ${superAdminEmail}`);
  }

  // Create demo store
  const demoSlug = 'demo-store';
  const demoStore = await prisma.store.findUnique({ where: { slug: demoSlug } });

  if (!demoStore) {
    const store = await prisma.store.create({
      data: {
        slug: demoSlug,
        name: 'Demo Store',
        description: 'A demonstration e-commerce store',
        primaryColor: '#6366f1',
        configured: true,
        settings: {
          create: {
            contactEmail: demoAdminEmail!,
            currency: 'USD',
            taxRate: 8.5,
            flatShippingRate: 5.99,
            freeShippingAbove: 50,
            shippingPolicy: 'Free shipping on orders over $50. Standard shipping in 3-5 business days.',
            returnPolicy: '30-day returns on all items in original condition.',
            aboutText: 'Welcome to our demo store! We offer a curated selection of quality products.',
          },
        },
        users: {
          create: {
            email: demoAdminEmail!,
            password: await bcrypt.hash(demoAdminPassword!, 12),
            name: 'Store Admin',
            role: 'OWNER',
          },
        },
        pages: {
          createMany: {
            data: [
              {
                type: 'LANDING', slug: '', title: 'Home', published: true, layout: JSON.stringify([
                  { id: 'hero-1', type: 'HeroSection', order: 0, props: { title: 'Welcome to Demo Store', subtitle: 'Discover amazing products', ctaText: 'Shop Now', ctaLink: '/products', backgroundColor: '#6366f1', textColor: '#ffffff' } },
                  { id: 'featured-1', type: 'FeaturedProducts', order: 1, props: { title: 'Featured Products', count: 4 } },
                ])
              },
              {
                type: 'PRODUCTS', slug: 'products', title: 'Products', published: true, layout: JSON.stringify([
                  { id: 'h1', type: 'Heading', order: 0, props: { text: 'All Products', level: 'h1', align: 'center' } },
                  { id: 'grid-1', type: 'ProductGrid', order: 1, props: { columns: 3, showFilters: true } },
                ])
              },
              { type: 'CART', slug: 'cart', title: 'Cart', published: true, layout: JSON.stringify([]) },
              { type: 'CHECKOUT', slug: 'cart/checkout', title: 'Checkout', published: true, layout: JSON.stringify([]) },
              { type: 'CONFIRMATION', slug: 'cart/confirmation', title: 'Order Confirmation', published: true, layout: JSON.stringify([]) },
              { type: 'CONTACT', slug: 'contact', title: 'Contact Us', published: true, layout: JSON.stringify([]) },
            ],
          },
        },
        products: {
          createMany: {
            data: [
              { id: 'prod_ar', name: 'Future Chair', description: 'Future Chair 3D Model', price: 199.99, stock: 50, category: 'Furniture', tags: ['3d', 'ar', 'chair'], arEnabled: true, modelUrl: 'https://example.com/assets/chair.glb', images: [] },
              { name: 'Wireless Earbuds Pro', description: 'Premium wireless earbuds with active noise cancellation', price: 79.99, comparePrice: 99.99, stock: 50, category: 'Electronics', tags: ['audio', 'wireless', 'earbuds'], images: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500'], featured: true },
              { name: 'Leather Wallet', description: 'Slim genuine leather bifold wallet', price: 29.99, stock: 100, category: 'Accessories', tags: ['leather', 'wallet', 'men'], images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500'] },
              { name: 'Yoga Mat Premium', description: 'Non-slip premium yoga mat, 6mm thick', price: 45.00, stock: 75, category: 'Sports', tags: ['yoga', 'fitness', 'mat'], images: ['https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500'] },
              { name: 'Scented Candle Set', description: 'Set of 3 hand-poured soy candles', price: 34.99, stock: 60, category: 'Home', tags: ['candle', 'home', 'scented', 'gift'], images: ['https://images.unsplash.com/photo-1603006905003-be475563bc59?w=500'], featured: true },
              { name: 'Bamboo Water Bottle', description: 'Eco-friendly insulated bamboo water bottle 32oz', price: 24.99, comparePrice: 35.00, stock: 200, category: 'Kitchen', tags: ['bottle', 'eco', 'bamboo', 'hydration'], images: ['https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500'] },
              { name: 'Minimalist Watch', description: 'Clean design Japanese movement watch', price: 149.00, stock: 30, category: 'Accessories', tags: ['watch', 'minimalist', 'style'], images: ['https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=500'], featured: true },
            ],
          },
        },
        companies: {
          create: [{ name: 'Acme Corp' }]
        },
      },
    });
    console.log(`Created demo store: ${store.slug}`);
  }

  // --- Seed Demo Orders ---
  const activeStore = await prisma.store.findUnique({ where: { slug: demoSlug } });
  if (activeStore) {
    const existingOrdersCount = await prisma.order.count({ where: { storeId: activeStore.id } });
    if (existingOrdersCount === 0) {
      const products = await prisma.product.findMany({ where: { storeId: activeStore.id } });
      if (products.length >= 2) {
        const demoCustomers = [
          { name: 'Alice Smith', email: 'alice@example.com', phone: '555-0101', address: { line1: '123 Apple St', city: 'Cupertino', state: 'CA', zip: '95014', country: 'US' } },
          { name: 'Bob Jones', email: 'bob@example.com', phone: '555-0102', address: { line1: '456 Banana Ave', city: 'Atlanta', state: 'GA', zip: '30301', country: 'US' } },
          { name: 'Charlie Brown', email: 'charlie@example.com', phone: '555-0103', address: { line1: '789 Cherry Blvd', city: 'Chicago', state: 'IL', zip: '60601', country: 'US' } },
          { name: 'Diana Prince', email: 'diana@example.com', phone: '555-0104', address: { line1: '101 Date Way', city: 'Austin', state: 'TX', zip: '73301', country: 'US' } },
          { name: 'Evan Wright', email: 'evan@example.com', phone: '555-0105', address: { line1: '202 Elderberry Ln', city: 'Denver', state: 'CO', zip: '80201', country: 'US' } },
        ];

        const statuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

        console.log('Seeding 15 demo orders...');
        for (let i = 1; i <= 15; i++) {
          const customer = demoCustomers[i % demoCustomers.length];
          const status = statuses[i % statuses.length];

          const orderItems = [];
          let subtotal = 0;
          const itemCount = (i % 2) + 1; // 1 or 2 items

          for (let j = 0; j < itemCount; j++) {
            const product = products[(i + j) % products.length];
            const quantity = (j % 2) + 1; // 1 or 2 qty
            const pPrice = Number(product.price);
            orderItems.push({
              productId: product.id,
              productName: product.name,
              quantity,
              price: product.price,
            });
            subtotal += pPrice * quantity;
          }

          const tax = subtotal * 0.085;
          const shipping = subtotal > 50 ? 0 : 5.99;
          const total = subtotal + tax + shipping;

          const createdAt = new Date();
          createdAt.setDate(createdAt.getDate() - (30 - (i * 2)));

          await prisma.order.create({
            data: {
              storeId: activeStore.id,
              orderNumber: `ORD-DEMO-${1000 + i}`,
              status,
              customerNameEnc: encrypt(customer.name) || '',
              customerEmailEnc: encrypt(customer.email) || '',
              customerPhoneEnc: encrypt(customer.phone) || '',
              shippingAddrEnc: encryptJson(customer.address) || '',
              subtotal,
              tax,
              shipping,
              total,
              createdAt,
              items: {
                create: orderItems,
              },
            },
          });
        }
        console.log('Orders seeded successfully.');
      }
    }
  }

  // Create default alert rules
  const existingRules = await prisma.alertRule.count();
  if (existingRules === 0) {
    await prisma.alertRule.createMany({
      data: [
        { metric: 'error_rate', threshold: 0.3, windowMinutes: 5, enabled: true },
        { metric: 'response_time_ms', threshold: 0.5, windowMinutes: 5, enabled: true },
        { metric: 'order_count', threshold: 0.8, windowMinutes: 15, enabled: true },
      ],
    });
    console.log('Created default alert rules');
  }

  console.log('Seed complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
