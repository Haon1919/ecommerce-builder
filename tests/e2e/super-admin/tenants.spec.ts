import { test, expect } from '@playwright/test';

test.describe('Super Admin Login Flow', () => {
    const VALID_DUMMY_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjk5OTk5OTk5OTl9.signature';

    test('should login as super admin successfully', async ({ page }) => {
        await page.route('**/api/auth/login', route => route.fulfill({
            status: 200,
            json: { token: VALID_DUMMY_TOKEN, user: { role: 'SUPER_ADMIN' } }
        }));
        await page.goto('/login');

        await page.fill('input[type="email"]', 'superadmin@example.com');
        await page.fill('input[type="password"]', 'SuperAdmin123!');
        await page.click('button[type="submit"]');

        // Verify successful login to super admin dashboard
        await expect(page).toHaveURL('/dashboard');
    });

    test('should view tenants list', async ({ page }) => {
        await page.route('**/api/auth/login', route => route.fulfill({
            status: 200,
            json: { token: VALID_DUMMY_TOKEN, user: { role: 'SUPER_ADMIN' } }
        }));
        await page.route('**/api/stores', route => route.fulfill({
            status: 200,
            json: []
        }));
        await page.goto('/login');
        await page.fill('input[type="email"]', 'superadmin@example.com');
        await page.fill('input[type="password"]', 'SuperAdmin123!');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL('/dashboard');

        await page.goto('/tenants');
        await expect(page).toHaveURL('/tenants');
        // await expect(page.locator('table')).toBeVisible();
    });
});
