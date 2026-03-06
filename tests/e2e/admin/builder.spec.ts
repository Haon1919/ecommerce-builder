import { test, expect } from '@playwright/test';

test.describe('Admin Builder Flow', () => {
    const VALID_DUMMY_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjk5OTk5OTk5OTl9.signature';

    test.beforeEach(async ({ page }) => {
        await page.route('**/api/auth/login', route => route.fulfill({
            status: 200,
            json: { token: VALID_DUMMY_TOKEN, user: { role: 'ADMIN' }, store: { id: 'demo-store', name: 'Demo Store', configured: true } }
        }));
        await page.route('**/api/auth/me', route => route.fulfill({
            status: 200,
            json: { user: { role: 'ADMIN', store: { id: 'demo-store', name: 'Demo Store', configured: true } } }
        }));
        await page.route('**/api/stores/*/analytics/dashboard*', route => route.fulfill({
            status: 200, json: { overview: { totalRevenue: 0, totalOrders: 0, pendingOrders: 0, totalProducts: 0, lowStockProducts: 0, unreadMessages: 0, chatSessions: 0 } }
        }));
        // Ideally use API for fast authentication in setup
        // For now, doing UI login setup
        await page.goto('/login');
        await page.fill('input[placeholder="my-store"]', 'demo-store');
        await page.fill('input[type="email"]', 'admin@demo-store.com');
        await page.fill('input[type="password"]', 'Admin123!');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/\/dashboard\/?/);
    });

    test('should access and load the store builder', async ({ page }) => {
        // Navigate to builder
        await page.goto('/builder');

        // Verify builder interface loads
        await expect(page).toHaveURL(/\/builder\/?/);
        // Assuming there is a canvas or toolbar
        // await expect(page.locator('[data-testid="builder-canvas"]')).toBeVisible();
    });
});
