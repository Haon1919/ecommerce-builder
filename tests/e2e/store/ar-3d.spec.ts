import { test, expect } from '@playwright/test';

test.describe('Storefront AR/3D Product Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Mock product API response with arEnabled and modelUrl
        await page.route('**/api/stores/*/products/*', route => route.fulfill({
            status: 200,
            json: {
                id: 'prod_ar',
                name: 'Future Chair',
                price: 199.99,
                arEnabled: true,
                modelUrl: 'https://example.com/assets/chair.glb',
                images: []
            }
        }));
    });

    test('should render the 3D model viewer when AR is enabled', async ({ page }) => {
        // Navigate to product detail page
        await page.goto('/demo-store/products/prod_ar');

        // Click the 3D & AR toggle button
        await page.getByRole('button', { name: '3D & AR' }).click();

        // Verify the 3D model viewer is present
        await expect(page.locator('model-viewer')).toBeVisible();

        // Verify the source URL is correct
        await expect(page.locator('model-viewer[src="https://example.com/assets/chair.glb"]')).toBeAttached();
    });
});
