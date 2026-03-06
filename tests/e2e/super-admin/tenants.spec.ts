import { test, expect } from '@playwright/test';

test.describe('Super Admin Login Flow', () => {
    const VALID_DUMMY_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjk5OTk5OTk5OTl9.signature';

    test('should login as super admin successfully', async ({ page }) => {
        await page.route('**/api/auth/login', route => route.fulfill({
            status: 200,
            json: { token: VALID_DUMMY_TOKEN, user: { role: 'SUPER_ADMIN' } }
        }));
        await page.route('**/api/auth/me', route => route.fulfill({
            status: 200,
            json: { user: { role: 'SUPER_ADMIN' } }
        }));
        await page.route('**/api/analytics/super/overview*', route => route.fulfill({
            status: 200, json: { activeStores: 0, newStoresToday: 0, totalRevenue: 0, activeUsers: 0 }
        }));
        await page.route('**/api/tickets*', route => route.fulfill({
            status: 200, json: { data: [], total: 0 }
        }));
        await page.goto('/login');

        await page.fill('input[type="email"]', 'superadmin@example.com');
        await page.fill('input[type="password"]', 'SuperAdmin123!');
        await page.click('button[type="submit"]');

        // Verify successful login to super admin dashboard
        await expect(page).not.toHaveURL(/login/);
    });

    test('should view tenants list', async ({ page }) => {
        await page.route('**/api/auth/login', route => route.fulfill({
            status: 200,
            json: { token: VALID_DUMMY_TOKEN, user: { role: 'SUPER_ADMIN' } }
        }));
        await page.route('**/api/auth/me', route => route.fulfill({
            status: 200,
            json: { user: { role: 'SUPER_ADMIN' } }
        }));
        await page.route('**/api/analytics/super/overview*', route => route.fulfill({
            status: 200, json: { activeStores: 0, newStoresToday: 0, totalRevenue: 0, activeUsers: 0 }
        }));
        await page.route('**/api/tickets*', route => route.fulfill({
            status: 200, json: { data: [], total: 0 }
        }));
        await page.route('**/api/stores', route => route.fulfill({
            status: 200,
            json: []
        }));
        await page.goto('/login');
        await page.fill('input[type="email"]', 'superadmin@example.com');
        await page.fill('input[type="password"]', 'SuperAdmin123!');
        await page.click('button[type="submit"]');
        await expect(page).not.toHaveURL(/login/);

        await page.goto('/tenants');
        await expect(page).toHaveURL(/\/tenants\/?/);
    });

    test('should create a new store', async ({ page }) => {
        await page.route('**/api/auth/me', route => route.fulfill({
            status: 200, json: { user: { role: 'SUPER_ADMIN' } }
        }));

        let storeRequests = 0;
        await page.route('**/api/stores*', route => {
            if (route.request().method() === 'POST') {
                return route.fulfill({
                    status: 201,
                    json: { store: { id: 'new-1', name: 'New E2E Store', slug: 'new-e2e', active: true } }
                });
            }
            if (route.request().method() === 'GET') {
                storeRequests++;
                return route.fulfill({
                    status: 200,
                    json: {
                        stores: storeRequests > 1 ? [{ id: 'new-1', name: 'New E2E Store', slug: 'new-e2e', _count: { products: 0, orders: 0, users: 1 }, active: true, theme: 'TAILWIND', createdAt: new Date().toISOString() }] : [],
                        total: storeRequests > 1 ? 1 : 0
                    }
                });
            }
            return route.continue();
        });

        // Set token to bypass login page
        await page.addInitScript(token => {
            localStorage.setItem('super_admin_token', token);
        }, VALID_DUMMY_TOKEN);

        await page.goto('/tenants');

        // Open modal
        await page.click('button:has-text("Create Store")');
        await expect(page.locator('h2:has-text("Create New Store")')).toBeVisible();

        // Fill form
        await page.locator('input').nth(1).fill('New E2E Store'); // Store Name
        await page.locator('input').nth(2).fill('new-e2e-store'); // Store Slug
        await page.locator('input').nth(3).fill('E2E Owner'); // Owner Name
        await page.locator('input').nth(4).fill('e2e@example.com'); // Owner Email
        await page.locator('input').nth(5).fill('Password123!'); // Owner Password

        // Submit
        await page.click('button[type="submit"]');

        // Modal should close and list should update
        await expect(page.locator('h2:has-text("Create New Store")')).not.toBeVisible();
        await expect(page.locator('text="New E2E Store"').first()).toBeVisible();
    });
});
