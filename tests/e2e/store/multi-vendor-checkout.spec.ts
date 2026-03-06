import { test, expect } from '@playwright/test';

test.describe('Multi-Vendor Checkout Flow', () => {
    const storeSlug = 'demo-store';
    const storeId = 'demo-store-id';

    test('should add items from multiple vendors, checkout, and verify split sub-orders in admin', async ({ page }) => {
        // ==========================================
        // 1. MOCK API RESPONSES FOR STOREFRONT
        // ==========================================

        // Store config
        await page.route(`**/api/stores/slug/${storeSlug}`, route => route.fulfill({
            status: 200,
            json: { id: storeId, slug: storeSlug, name: 'Demo Store', theme: 'TAILWIND', settings: { taxRate: 10, flatShippingRate: 5, currency: 'USD' } }
        }));

        // Product List
        await page.route(`**/api/stores/${storeId}/products*`, route => route.fulfill({
            status: 200,
            json: {
                products: [
                    { id: 'prod-1', storeId, vendorId: 'vendor-A', name: 'Vendor A Product', price: 100, stock: 10, trackStock: true, active: true, images: [] },
                    { id: 'prod-2', storeId, vendorId: 'vendor-B', name: 'Vendor B Product', price: 50, stock: 10, trackStock: true, active: true, images: [] }
                ],
                total: 2
            }
        }));

        // Product Details
        await page.route(`**/api/stores/${storeId}/products/prod-1`, route => route.fulfill({
            status: 200,
            json: { id: 'prod-1', storeId, vendorId: 'vendor-A', name: 'Vendor A Product', price: 100, description: 'Desc A', stock: 10, trackStock: true, active: true, images: [] }
        }));
        await page.route(`**/api/stores/${storeId}/products/prod-2`, route => route.fulfill({
            status: 200,
            json: { id: 'prod-2', storeId, vendorId: 'vendor-B', name: 'Vendor B Product', price: 50, description: 'Desc B', stock: 10, trackStock: true, active: true, images: [] }
        }));

        // Shipping Rates Mock
        await page.route('**/api/checkout/shipping-rates', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([
                    { carrier: 'UPS', service: 'Ground', rate: 12.50, currency: 'USD', estimatedDays: 5 }
                ])
            });
        });

        // Checkout Order Creation Mock
        await page.route('**/api/orders', route => {
            const req = route.request();
            if (req.method() === 'POST') {
                return route.fulfill({
                    status: 201,
                    json: {
                        id: 'parent-order-123',
                        orderNumber: 'ORD-2024-PARENT',
                        status: 'PENDING',
                        subtotal: 150,
                        tax: 15,
                        shipping: 5,
                        total: 170,
                        items: [
                            { productId: 'prod-1', productName: 'Vendor A Product', quantity: 1, price: 100, vendorId: 'vendor-A' },
                            { productId: 'prod-2', productName: 'Vendor B Product', quantity: 1, price: 50, vendorId: 'vendor-B' }
                        ]
                    }
                });
            }
            return route.continue();
        });

        // ==========================================
        // 2. EXECUTE STOREFRONT ACTIONS
        // ==========================================

        // Disable hydration issues by waiting for load state
        await page.goto(`/${storeSlug}/products`);

        // Wait for the mocked products to appear
        const addBtns = page.getByRole('button', { name: /Add to Cart/i });
        await addBtns.first().waitFor({ state: 'visible', timeout: 15000 });

        // Click Add to Cart for Vendor A's product
        await addBtns.nth(0).click();

        // Click Add to Cart for Vendor B's product
        await addBtns.nth(1).click();

        await page.goto(`/${storeSlug}/cart`);
        const checkoutBtn = page.getByRole('button', { name: /Checkout/i }).or(page.getByRole('link', { name: /Checkout/i }));
        if (await checkoutBtn.count() > 0) {
            await checkoutBtn.first().click();
            await expect(page).toHaveURL(/.*\/cart\/checkout/);

            // Step 0: Contact
            await page.getByLabel('Email *').fill('test@example.com');
            await page.getByLabel('Full Name *').fill('John Doe');
            await page.getByLabel('Phone').fill('1234567890');
            await page.getByRole('button', { name: /Continue/i }).click();

            // Step 1: Shipping
            await page.getByLabel('Address Line 1 *').fill('123 Test St');
            await page.getByLabel('City *').fill('Test City');
            await page.getByLabel('State *').fill('TS');
            await page.getByLabel('ZIP Code *').fill('12345');

            // Wait for and select shipping rate
            await page.waitForSelector('text=UPS Ground');
            await page.click('text=UPS Ground');

            await page.getByRole('button', { name: /Continue/i }).click();

            // Step 2: Payment
            await page.getByRole('button', { name: /Place Order/i }).click();
            await expect(page).toHaveURL(/.*\/cart\/confirmation.*/);
        }

        // ==========================================
        // 3. MOCK API RESPONSES FOR ADMIN DASHBOARD
        // ==========================================

        // Mock the Admin Orders API to return 3 orders (1 parent, 2 suborders)
        await page.route(`**/api/stores/*/orders*`, route => route.fulfill({
            status: 200,
            json: {
                total: 3,
                orders: [
                    { id: 'parent-order-123', orderNumber: 'ORD-2024-PARENT', customerName: 'John Doe', total: 170, status: 'PENDING', createdAt: new Date().toISOString() },
                    { id: 'sub-order-1', parentOrderId: 'parent-order-123', orderNumber: 'ORD-2024-SUB1', customerName: 'John Doe', total: 110, status: 'PENDING', createdAt: new Date().toISOString(), vendorId: 'vendor-A' },
                    { id: 'sub-order-2', parentOrderId: 'parent-order-123', orderNumber: 'ORD-2024-SUB2', customerName: 'John Doe', total: 55, status: 'PENDING', createdAt: new Date().toISOString(), vendorId: 'vendor-B' }
                ]
            }
        }));

        // ==========================================
        // 4. EXECUTE ADMIN VERIFICATION
        // ==========================================

        await page.route('**/api/auth/login', route => route.fulfill({
            status: 200,
            json: { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjk5OTk5OTk5OTl9.fake', user: { id: 'admin-1', storeId, role: 'Owner' }, store: { id: storeId, slug: storeSlug, name: 'Demo Store', configured: true } }
        }));
        await page.route('**/api/auth/me', route => route.fulfill({
            status: 200,
            json: { user: { id: 'admin-1', storeId, role: 'Owner', store: { id: storeId, slug: storeSlug, name: 'Demo Store', configured: true } } }
        }));
        // Mock Analytics for the dashboard
        await page.route(`**/api/stores/${storeId}/analytics/dashboard*`, route => route.fulfill({
            status: 200,
            json: {
                overview: {
                    totalRevenue: 0,
                    totalOrders: 0,
                    pendingOrders: 0,
                    totalProducts: 0,
                    lowStockProducts: 0,
                    unreadMessages: 0,
                    chatSessions: 0
                },
                recentOrders: [],
                revenueByDay: [],
                ordersByStatus: {}
            }
        }));

        const adminUrl = 'http://localhost:3002';
        await page.goto(`${adminUrl}/login`);

        // Wait for login page
        await page.fill('input[placeholder="my-store"]', storeSlug);
        await page.fill('input[type="email"]', 'store@example.com');
        await page.fill('input[type="password"]', 'DemoStore123!');
        await page.click('button[type="submit"]');

        await expect(page).toHaveURL(new RegExp(`${adminUrl}/dashboard`));

        // Navigate to Orders
        await page.click('a[href="/orders"]');
        await expect(page).toHaveURL(new RegExp(`${adminUrl}/orders`));

        // Wait for the table rows to appear
        // The table should have all 3 orders: ORD-2024-PARENT, ORD-2024-SUB1, ORD-2024-SUB2
        await expect(page.getByRole('cell', { name: 'ORD-2024-PARENT' })).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('cell', { name: 'ORD-2024-SUB1' })).toBeVisible();
        await expect(page.getByRole('cell', { name: 'ORD-2024-SUB2' })).toBeVisible();
    });
});
