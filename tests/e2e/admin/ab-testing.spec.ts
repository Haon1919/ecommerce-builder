import { test, expect } from '@playwright/test';

test.describe('Admin A/B Testing Flow', () => {
    const VALID_DUMMY_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjk5OTk5OTk5OTl9.signature';

    test.beforeEach(async ({ page }) => {
        // Mock authentication
        await page.route('**/api/auth/login', route => route.fulfill({
            status: 200,
            json: { token: VALID_DUMMY_TOKEN, user: { role: 'ADMIN' }, store: { id: 'demo-store', name: 'Demo Store', configured: true } }
        }));
        await page.route('**/api/auth/me', route => route.fulfill({
            status: 200,
            json: { user: { role: 'ADMIN', store: { id: 'demo-store', name: 'Demo Store', configured: true } } }
        }));

        // Mock experiments API response
        await page.route('**/api/stores/*/experiments', route => route.fulfill({
            status: 200,
            json: [
                { id: 'exp1', name: 'Homepage Test', status: 'RUNNING', variants: [{ name: 'A', weight: 50 }, { name: 'B', weight: 50 }] }
            ]
        }));

        await page.goto('/login');
        await page.fill('input[placeholder="my-store"]', 'demo-store');
        await page.fill('input[type="email"]', 'admin@demo-store.com');
        await page.fill('input[type="password"]', 'Admin123!');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL('/dashboard/');
    });

    test('should load experiments in the A/B testing dashboard', async ({ page }) => {
        // Navigate to A/B testing dashboard
        await page.goto('/experiments');

        // Verify that the mocked experiment is listed
        await expect(page.locator('text=Homepage Test')).toBeVisible();
        await expect(page.locator('text=RUNNING')).toBeVisible();
    });
});
