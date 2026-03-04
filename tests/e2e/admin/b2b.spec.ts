import { test, expect } from '@playwright/test';

test.describe('Admin B2B Flow', () => {
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

        // Mock companies API response
        await page.route('**/api/stores/*/companies', route => route.fulfill({
            status: 200,
            json: [
                { id: 'comp1', name: 'Acme Corp', priceListId: 'pl1' }
            ]
        }));

        await page.goto('/login');
        await page.fill('input[placeholder="my-store"]', 'demo-store');
        await page.fill('input[type="email"]', 'admin@demo-store.com');
        await page.fill('input[type="password"]', 'Admin123!');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL('/dashboard');
    });

    test('should load companies and display them in the B2B portal', async ({ page }) => {
        // Navigate to B2B companies portal
        await page.goto('/companies');

        // Verify that the mocked company is listed
        await expect(page.locator('text=Acme Corp')).toBeVisible();
    });
});
