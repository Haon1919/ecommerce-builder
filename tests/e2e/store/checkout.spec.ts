import { test, expect } from '@playwright/test';

test.describe('Storefront Checkout Flow', () => {
    const storeSlug = 'test-store'; // Replace with an actual seed store slug

    test('should add item to cart and checkout', async ({ page }) => {
        // 1. Browse products
        await page.goto(`/${storeSlug}/products`);

        // 2. View a product (assuming there's a link to a product detail page)
        const productLinks = page.locator('a[href*="/products/"]');
        if (await productLinks.count() > 0) {
            await productLinks.first().click();

            // 3. Add to cart (assuming standard add to cart button)
            const addToCartBtn = page.locator('button', { hasText: /Add to Cart/i });
            if (await addToCartBtn.isVisible()) {
                await addToCartBtn.click();

                // 4. Go to cart
                await page.goto(`/${storeSlug}/cart`);

                // 5. Proceed to checkout
                const checkoutBtn = page.locator('a[href*="/cart/checkout"]');
                if (await checkoutBtn.isVisible()) {
                    await checkoutBtn.click();
                    await expect(page).toHaveURL(/cart\/checkout\/?/);

                    // 6. Complete checkout (this heavily depends on the actual checkout form)
                    // await page.fill('input[name="email"]', 'customer@example.com');
                    // await page.click('button[type="submit"]');
                    // await expect(page).toHaveURL(`/${storeSlug}/cart/confirmation`);
                }
            }
        }
    });
});
