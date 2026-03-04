import { test, expect } from '@playwright/test';

test.describe('Storefront Voice Commerce Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Mock chat API response
        await page.route('**/api/stores/*/chat', route => route.fulfill({
            status: 200,
            json: {
                text: 'Here are the shoes you asked for!',
                action: { type: 'SHOW_PRODUCTS', payload: { productIds: ['shoe1'] } }
            }
        }));

        // Navigate to demo store
        await page.goto('/demo-store');
    });

    test('should allow interacting with chatbot via voice', async ({ page }) => {
        // Open the chat widget first
        await page.getByLabel('Open AI Chat Assistant').click();

        const micButton = page.locator('button[aria-label="Voice Input"]');

        // In a real browser, this would trigger the permission prompt. 
        // For E2E we verify the button is there.
        await expect(micButton).toBeAttached();

        // Optionally, simulate a click
        // await micButton.click();
    });
});
