import { test, expect } from '@playwright/test';

test.describe('Storefront Checkout Flow with Shipping Rates', () => {
    const storeSlug = 'demo-store';

    test('should complete checkout with shipping rate selection', async ({ page }) => {
        // 1. Mock API Responses
        await page.route('**/api/checkout/shipping-rates', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([
                    { carrier: 'UPS', service: 'Ground', rate: 12.50, currency: 'USD', estimatedDays: 5 },
                    { carrier: 'FedEx', service: 'Overnight', rate: 45.00, currency: 'USD', estimatedDays: 1 }
                ])
            });
        });

        await page.route('**/api/orders', async route => {
            await route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({ orderNumber: 'ORD-TEST-123' })
            });
        });

        await page.route('**/api/stores/slug/*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ id: 'test-store-id', name: 'Test Store', settings: { taxRate: 10 } })
            });
        });

        await page.route('**/api/stores/*/products*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    products: [{ id: 'prod-1', name: 'Test Product', price: 10, images: [] }],
                    total: 1
                })
            });
        });

        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
        page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

        await page.goto(`/${storeSlug}/products`);
        try {
            const productLink = page.locator('a[href*="/products/"]').first();
            await productLink.waitFor({ state: 'visible', timeout: 10000 });
            await productLink.click();
            await page.click('button:has-text("Add to Cart")');
        } catch (e) {
            await page.screenshot({ path: 'fail-screenshot.png', fullPage: true });
            throw e;
        }

        await page.goto(`/${storeSlug}/cart`);
        await page.click('a:has-text("Checkout")');

        // 3. Step 0: Contact Info
        await expect(page.locator('h2')).toContainText('Contact Information');
        await page.fill('#email', 'customer@example.com');
        await page.fill('#name', 'John Doe');
        await page.click('button:has-text("Continue")');

        // 4. Step 1: Shipping Address & Rates
        await expect(page.locator('h2')).toContainText('Shipping Address');
        await page.fill('#line1', '123 E2E St');
        await page.fill('#city', 'Seattle');
        await page.fill('#state', 'WA');
        await page.fill('#zip', '98101');

        // Wait for rates to load (mocked above)
        await page.waitForSelector('text=UPS Ground');
        await expect(page.locator('text=$12.50')).toBeVisible();
        await expect(page.locator('text=$45.00')).toBeVisible();

        // Select UPS Ground
        await page.click('text=UPS Ground');

        // Verify Order Summary updated (Total = Items + Shipping + Tax)
        // For simplicity, just check shipping cost appeared in summary
        await expect(page.locator('div:has-text("Shipping")').nth(1)).toContainText('$12.50');

        await page.click('button:has-text("Continue")');

        // 5. Step 2: Payment
        await expect(page.locator('h2')).toContainText('Payment');
        await page.click('button:has-text("Place Order")');

        // 6. Confirmation
        await expect(page).toHaveURL(/confirmation/);
        await expect(page.locator('h1')).toContainText('Order Confirmed!');
    });
});
