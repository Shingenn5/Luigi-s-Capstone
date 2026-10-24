import { test, expect } from '@playwright/test';
for (const width of [1280, 390]) {
  test(`supplied category graphics navigate at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByText('Choose options', { exact: true })).toHaveCount(
      0,
    );
    await expect(page.locator('[data-pizza-size], [data-filter]')).toHaveCount(
      0,
    );
    expect(
      await page
        .locator('main img')
        .evaluateAll((images) => images.every((image) => image.closest('a'))),
    ).toBe(true);
    const categories = page.getByRole('navigation', {
      name: 'Shop by category',
    });
    for (const img of await categories.locator('img').all()) {
      await expect(img).toBeVisible();
      expect(
        await img.evaluate(
          (image) => image.complete && image.naturalWidth === 480,
        ),
      ).toBe(true);
    }
    await categories.getByRole('link', { name: /^Pizza/i }).click();
    await expect(page).toHaveURL(/menu.html#pizzaSizes$/);
    await expect(page.locator('#pizzaFields')).toBeEnabled();
    await page
      .getByRole('navigation', { name: 'Shop by category' })
      .getByRole('link', { name: /^Drinks/i })
      .click();
    await expect(page).toHaveURL(/menu.html#drinkTitle$/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/supplied-menu-${width}.png`,
      fullPage: true,
    });
    await page.goto('/');
    await page.screenshot({
      path: `test-results/supplied-home-${width}.png`,
      fullPage: true,
    });
  });
}
