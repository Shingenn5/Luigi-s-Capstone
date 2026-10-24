import { test, expect } from '@playwright/test';
for (const width of [1280, 390]) {
  test(`pizza image selection at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/menu.html');
    const large = page.locator('[data-pizza-size="large"]');
    await expect(large).toBeEnabled();
    await large.locator('img').click();
    await expect(large).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#pizzaSize option:checked')).toContainText(
      'Large',
    );
    await expect(page.locator('#pizzaPrice')).toContainText('$9.00');
    await expect(page.locator('#buildTitle')).toBeFocused();
    await page
      .locator('#pizzaSize')
      .selectOption({ label: 'Small Pizza — $5.00' });
    await expect(page.locator('[data-pizza-size="small"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await large.focus();
    await page.keyboard.press('Enter');
    await expect(large).toHaveAttribute('aria-pressed', 'true');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/menu-${width}.png`,
      fullPage: true,
    });
    await page.goto('/index.html');
    await page
      .getByRole('navigation', { name: 'Shop by category' })
      .getByRole('link', { name: /^Pizza/i })
      .click();
    await page.locator('[data-pizza-size="medium"] img').click();
    await expect(page.locator('[data-pizza-size="medium"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
}
