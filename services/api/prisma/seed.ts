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

    const args = process.argv.slice(2);
    const storeArg = args.find(a => a.startsWith('--store='));
    const targetStoreSlug = storeArg ? storeArg.split('=')[1] : 'demo-store';

    const defaultProducts = [
        { id: 'prod_ar', name: 'Future Chair', description: 'Future Chair 3D Model', price: 199.99, stock: 50, category: 'Furniture', tags: ['3d', 'ar', 'chair'], arEnabled: true, modelUrl: 'https://example.com/assets/chair.glb', images: [] },
        { name: 'Wireless Earbuds Pro', description: 'Premium wireless earbuds with active noise cancellation', price: 79.99, comparePrice: 99.99, stock: 50, category: 'Electronics', tags: ['audio', 'wireless', 'earbuds'], images: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500'], featured: true },
        { name: 'Leather Wallet', description: 'Slim genuine leather bifold wallet', price: 29.99, stock: 100, category: 'Accessories', tags: ['leather', 'wallet', 'men'], images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500'] },
        { name: 'Yoga Mat Premium', description: 'Non-slip premium yoga mat, 6mm thick', price: 45.00, stock: 75, category: 'Sports', tags: ['yoga', 'fitness', 'mat'], images: ['https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500'] },
        { name: 'Scented Candle Set', description: 'Set of 3 hand-poured soy candles', price: 34.99, stock: 60, category: 'Home', tags: ['candle', 'home', 'scented', 'gift'], images: ['https://images.unsplash.com/photo-1603006905003-be475563bc59?w=500'], featured: true },
        { name: 'Bamboo Water Bottle', description: 'Eco-friendly insulated bamboo water bottle 32oz', price: 24.99, comparePrice: 35.00, stock: 200, category: 'Kitchen', tags: ['bottle', 'eco', 'bamboo', 'hydration'], images: ['https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500'] },
        { name: 'Minimalist Watch', description: 'Clean design Japanese movement watch', price: 149.00, stock: 30, category: 'Accessories', tags: ['watch', 'minimalist', 'style'], images: ['https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=500'], featured: true },
    ];

    const jauntyLadyProducts = [
        { name: 'Organic Cotton Maxi Dress', description: 'Flowy, sustainable maxi dress perfect for summer.', price: 89.99, stock: 15, category: 'Dresses', tags: ['sustainable', 'cotton', 'summer', 'dress'], images: ['https://images.unsplash.com/photo-1572804013309-8c98e252Bdf0?w=500'], featured: true },
        { name: 'Linen Button-Up Blouse', description: 'Breathable slow fashion linen top.', price: 65.00, stock: 20, category: 'Tops', tags: ['linen', 'blouse', 'breathable'], images: ['https://images.unsplash.com/photo-1551163943-3f6a855d1153?w=500'] },
        { name: 'Wide Leg Trousers', description: 'Comfortable high-waisted wide leg pants.', price: 110.00, stock: 10, category: 'Bottoms', tags: ['pants', 'trousers', 'chic'], images: ['https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=500'] },
        { name: 'Hand-Knit Wool Sweater', description: 'Cozy artisan-made wool sweater.', price: 145.00, stock: 5, category: 'Outerwear', tags: ['wool', 'knit', 'sweater', 'winter'], images: ['https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=500'], featured: true },
        { name: 'Upcycled Denim Jacket', description: 'Unique upcycled denim jacket with vintage patches.', price: 130.00, stock: 8, category: 'Outerwear', tags: ['denim', 'upcycled', 'jacket'], images: ['https://images.unsplash.com/photo-1576878931215-625baf06fb21?w=500'] },
    ];

    const ivyRoseProducts = [
        { name: 'Floral Wrap Dress', description: 'Beautiful floral print wrap dress.', price: 54.99, stock: 25, category: 'Dresses', tags: ['dress', 'floral', 'wrap'], images: ['https://images.unsplash.com/photo-1601287664654-e69956d47b66?w=500'], featured: true },
        { name: 'Distressed Skinny Jeans', description: 'Classic distressed denim.', price: 68.00, stock: 30, category: 'Bottoms', tags: ['jeans', 'denim', 'distressed'], images: ['https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=500'] },
        { name: 'Off-the-Shoulder Top', description: 'Cute and casual off-shoulder blouse.', price: 38.00, stock: 40, category: 'Tops', tags: ['top', 'blouse', 'casual'], images: ['https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=500'] },
        { name: 'Faux Leather Leggings', description: 'Sleek faux leather leggings for a night out.', price: 42.99, stock: 20, category: 'Bottoms', tags: ['leggings', 'leather', 'night'], images: ['https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=500'] },
        { name: 'Oversized Cardigan', description: 'Chunky knit oversized cardigan.', price: 59.99, stock: 15, category: 'Outerwear', tags: ['cardigan', 'knit', 'cozy'], images: ['https://images.unsplash.com/photo-1434389674669-e69b4cf1b8ee?w=500'], featured: true },
    ];

    const countryCharmProducts = [
        { name: 'Rustic Farmhouse Sign', description: 'Hand-painted wooden sign for your home.', price: 45.00, stock: 12, category: 'Home Decor', tags: ['rustic', 'sign', 'wood', 'farmhouse'], images: ['https://images.unsplash.com/photo-1584589167171-541ce45f1eea?w=500'], featured: true },
        { name: 'Mason Jar Centerpiece', description: '3 painted mason jars in a wooden carriage.', price: 35.00, stock: 20, category: 'Home Decor', tags: ['jar', 'centerpiece', 'decor'], images: ['https://images.unsplash.com/photo-1582260654760-44ec4cc39fc4?w=500'] },
        { name: 'Woven Throw Blanket', description: 'Cozy throw blanket with fringe.', price: 65.00, stock: 15, category: 'Textiles', tags: ['blanket', 'throw', 'cozy'], images: ['https://images.unsplash.com/photo-1580828343064-fde4cad202d5?w=500'] },
        { name: 'Scented Soy Candle in Tin', description: 'Lavender infused locally made soy candle.', price: 18.00, stock: 50, category: 'Home Fragrance', tags: ['candle', 'soy', 'lavender'], images: ['https://images.unsplash.com/photo-1608181114410-bfaaece29e50?w=500'] },
        { name: 'Vintage Inspired Wall Clock', description: 'Large rustic iron wall clock.', price: 89.00, stock: 5, category: 'Home Decor', tags: ['clock', 'vintage', 'wall'], images: ['https://images.unsplash.com/photo-1509048191080-d2984bad6ae5?w=500'], featured: true },
    ];

    const heidijhaleProducts = [
        { name: 'Custom Name Necklace', description: 'Sterling silver custom stamped name necklace.', price: 75.00, stock: 100, category: 'Necklaces', tags: ['necklace', 'silver', 'custom', 'name'], images: ['https://images.unsplash.com/photo-1599643478524-fb524b071bc8?w=500'], featured: true },
        { name: 'Hammered Silver Cuff', description: 'Hand-hammered sterling silver cuff bracelet.', price: 120.00, stock: 15, category: 'Bracelets', tags: ['bracelet', 'cuff', 'silver', 'hammered'], images: ['https://images.unsplash.com/photo-1611591437281-46013a774f30?w=500'] },
        { name: 'Tiny initial Studs', description: '14k gold filled tiny initial stud earrings.', price: 45.00, stock: 40, category: 'Earrings', tags: ['earrings', 'gold', 'studs', 'initial'], images: ['https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=500'] },
        { name: 'Birthstone Stacking Ring', description: 'Delicate ring featuring a natural gemstone.', price: 55.00, stock: 30, category: 'Rings', tags: ['ring', 'stacking', 'birthstone', 'gemstone'], images: ['https://images.unsplash.com/photo-1605100804763-247f67b4548e?w=500'], featured: true },
        { name: 'Engraved Tie Clip', description: 'Personalized sterling silver tie clip.', price: 65.00, stock: 25, category: 'Men\'s', tags: ['tie clip', 'mens', 'engraved', 'silver'], images: ['https://images.unsplash.com/photo-1620601550993-9097746cb5b1?w=500'] },
    ];

    const storesConfig: Record<string, any> = {
        'demo-store': {
            name: 'Demo Store',
            description: 'A demonstration e-commerce store',
            primaryColor: '#6366f1',
            products: defaultProducts,
            aboutText: 'Welcome to our demo store! We offer a curated selection of quality products.',
        },
        'the-jaunty-lady': {
            name: 'The Jaunty Lady',
            description: 'Slow fashion clothing boutique in Muncie, IN',
            primaryColor: '#c27b7f', // dusty rose
            products: jauntyLadyProducts,
            aboutText: 'The Jaunty Lady is Muncie\'s premier slow fashion destination, offering sustainable and beautifully crafted clothing.',
        },
        'ivy-rose-boutique': {
            name: 'Ivy Rose Boutique',
            description: 'Trendy women\'s clothing and accessories in Muncie.',
            primaryColor: '#e0b0ff', // mauve/rose
            products: ivyRoseProducts,
            aboutText: 'Shop Ivy Rose Boutique for the latest trends in women\'s fashion right here in downtown Muncie.',
        },
        'country-charm-boutique': {
            name: 'Country Charm Boutique',
            description: 'Clothing, Home Decor, and Gifts.',
            primaryColor: '#8b5a2b', // rustic brown
            products: countryCharmProducts,
            aboutText: 'Discover unique home decor, cozy apparel, and perfect gifts with that special country charm.',
        },
        'heidijhale-designs': {
            name: 'HeidiJHale Designs',
            description: 'Handmade custom jewelry.',
            primaryColor: '#c0c0c0', // silver
            products: heidijhaleProducts,
            aboutText: 'Every piece is handmade locally in our downtown Muncie studio. Custom stamped and uniquely yours.',
        }
    };

    const storeConfig = storesConfig[targetStoreSlug];
    if (!storeConfig) {
        console.error(`Unknown store configuration slug: ${targetStoreSlug}`);
        process.exit(1);
    }

    // Create or Update targeted store
    let activeStore = await prisma.store.findUnique({ where: { slug: targetStoreSlug } });

    if (!activeStore) {
        activeStore = await prisma.store.create({
            data: {
                slug: targetStoreSlug,
                name: storeConfig.name,
                description: storeConfig.description,
                primaryColor: storeConfig.primaryColor,
                configured: true,
                settings: {
                    create: {
                        contactEmail: demoAdminEmail!,
                        currency: 'USD',
                        taxRate: 7.0, // Indiana tax rate 7%
                        flatShippingRate: 5.99,
                        freeShippingAbove: 50,
                        shippingPolicy: 'Free shipping on orders over $50. Standard shipping in 3-5 business days.',
                        returnPolicy: '30-day returns on all items in original condition.',
                        aboutText: storeConfig.aboutText,
                    },
                },
                users: {
                    create: {
                        email: demoAdminEmail!,
                        password: await bcrypt.hash(demoAdminPassword!, 12),
                        name: `${storeConfig.name} Admin`,
                        role: 'OWNER',
                    },
                },
                pages: {
                    createMany: {
                        data: [
                            {
                                type: 'LANDING', slug: '', title: 'Home', published: true, layout: JSON.stringify([
                                    { id: 'hero-1', type: 'HeroSection', order: 0, props: { title: `Welcome to ${storeConfig.name}`, subtitle: storeConfig.description, ctaText: 'Shop Now', ctaLink: '/products', backgroundColor: storeConfig.primaryColor, textColor: '#ffffff' } },
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
                        data: storeConfig.products,
                    },
                },
                companies: {
                    create: [{ name: storeConfig.name }]
                },
            },
        });
        console.log(`Created store: ${activeStore.slug}`);
    } else {
        console.log(`Store ${activeStore.slug} already exists; skipping store creation.`);
    }

    // --- Seed Demo Orders ---
    const existingOrdersCount = await prisma.order.count({ where: { storeId: activeStore.id } });
    if (existingOrdersCount === 0) {
        const products = await prisma.product.findMany({ where: { storeId: activeStore.id } });
        if (products.length >= 2) {
            const demoCustomers = [
                { name: 'Alice Smith', email: 'alice@example.com', phone: '555-0101', address: { line1: '123 Apple St', city: 'Muncie', state: 'IN', zip: '47304', country: 'US' } },
                { name: 'Bob Jones', email: 'bob@example.com', phone: '555-0102', address: { line1: '456 Banana Ave', city: 'Muncie', state: 'IN', zip: '47305', country: 'US' } },
                { name: 'Charlie Brown', email: 'charlie@example.com', phone: '555-0103', address: { line1: '789 Cherry Blvd', city: 'Indianapolis', state: 'IN', zip: '46204', country: 'US' } },
                { name: 'Diana Prince', email: 'diana@example.com', phone: '555-0104', address: { line1: '101 Date Way', city: 'Fishers', state: 'IN', zip: '46037', country: 'US' } },
                { name: 'Evan Wright', email: 'evan@example.com', phone: '555-0105', address: { line1: '202 Elderberry Ln', city: 'Carmel', state: 'IN', zip: '46032', country: 'US' } },
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

                const tax = subtotal * 0.07; // Indiana tax
                const shipping = subtotal > 50 ? 0 : 5.99;
                const total = subtotal + tax + shipping;

                const createdAt = new Date();
                createdAt.setDate(createdAt.getDate() - (30 - (i * 2)));

                await prisma.order.create({
                    data: {
                        storeId: activeStore.id,
                        orderNumber: `ORD-${targetStoreSlug.substring(0, 3).toUpperCase()}-${1000 + i}`,
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
        } else {
            console.log('Not enough products to seed orders.');
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
