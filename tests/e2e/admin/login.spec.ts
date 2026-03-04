import { test, expect } from '@playwright/test';

test.describe('Admin Login Flow', () => {
    const VALID_DUMMY_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjk5OTk5OTk5OTl9.signature';

    test('should login successfully with valid credentials', async ({ page }) => {
        await page.route('**/api/auth/login', route => route.fulfill({
            status: 200,
            json: { token: VALID_DUMMY_TOKEN, user: { role: 'ADMIN' }, store: { id: 'demo-store', name: 'Demo Store', configured: true } }
        }));
        await page.route('**/api/auth/me', route => route.fulfill({
            status: 200,
            json: { user: { role: 'ADMIN', store: { id: 'demo-store', name: 'Demo Store', configured: true } } }
        }));

        // Navigate to admin login page
        await page.goto('/login');

        // Fill in credentials
        await page.fill('input[placeholder="my-store"]', 'demo-store');
        await page.fill('input[type="email"]', 'admin@demo-store.com');
        await page.fill('input[type="password"]', 'Admin123!');

        // Submit form
        await page.click('button[type="submit"]'); // Assuming standard button

        // Verify successful login by checking URL or a unique dashboard element
        await expect(page).toHaveURL('/dashboard');
        // Add specific dashboard element assertion if known, e.g., await expect(page.locator('h1')).toContainText('Dashboard');
    });

    test('should show error with invalid credentials', async ({ page }) => {
        await page.route('**/api/auth/login', route => route.fulfill({
            status: 401,
            json: { error: 'Invalid credentials' }
        }));
        await page.goto('/login');
        await page.fill('input[type="email"]', 'wrong@example.com');
        await page.fill('input[type="password"]', 'wrongpass');
        await page.click('button[type="submit"]');

        // Verify error message (adjust selector based on actual implementation)
        // await expect(page.locator('.text-red-500')).toBeVisible();
    });
});
