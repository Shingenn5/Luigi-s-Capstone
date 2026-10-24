import { test, expect } from '@playwright/test';
for (const width of [1280, 390]) {
  test(`drinks-only selection, validation and saved cart at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Shop by category' })
      .getByRole('link', { name: /^Drinks/i })
      .click();
    await expect(page.locator('#drinkFields')).toBeEnabled();
    await page.locator('#drinkType').selectOption('Cola');
    await page.locator('#drinkChoice').selectOption({ label: 'Large — $3.00' });
    await page.locator('#drinkType').selectOption('UnCola');
    await expect(page.locator('#drinkChoice option:checked')).toHaveText(
      'Large — $3.00',
    );
    await page.locator('#drinkQuantity').fill('0');
    await page
      .getByRole('button', { name: 'Add drink to order', exact: true })
      .click();
    await expect(page.locator('#drinkQuantity')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('luigis-order-v1'))?.items || [],
      ),
    ).toHaveLength(0);
    await page.locator('#drinkQuantity').fill('2');
    await expect(page.locator('#drinkPrice')).toHaveText(
      'Total for 2 drinks: $6.00',
    );
    await page
      .getByRole('button', { name: 'Add drink to order', exact: true })
      .click();
    await expect(page.locator('#drinkStatus')).toContainText(
      '2 × Large UnCola added',
    );
    await page.screenshot({
      path: `test-results/drinks-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole('link', { name: 'Review your order', exact: true })
      .click();
    await expect(page.locator('#orderItems')).toContainText('Large UnCola');
    await expect(page.locator('#orderItems')).not.toContainText('Pizza');
    await expect(page.locator('#orderSubtotal')).toHaveText('$6.00');
    await page.reload();
    await expect(page.locator('#orderSubtotal')).toHaveText('$6.00');
  });
}
test('pizza draft survives category navigation and both additions reach review', async ({
  page,
}) => {
  await page.goto('/menu.html');
  await expect(page.locator('#pizzaFields')).toBeEnabled();
  await page.locator('#topping-1').check();
  await page.locator('#topping-option-1').selectOption('2');
  await page.locator('#sauceChoice').selectOption('Light');
  const categories = page.getByRole('navigation', { name: 'Shop by category' });
  await categories.getByRole('link', { name: /^Drinks/i }).click();
  await page.locator('#drinkType').selectOption('Dr. Pepper');
  await categories.getByRole('link', { name: /^Pizza/i }).click();
  await expect(page.locator('#topping-1')).toBeChecked();
  await expect(page.locator('#sauceChoice')).toHaveValue('Light');
  await page
    .getByRole('button', { name: 'Add pizza to order', exact: true })
    .click();
  await expect(page.locator('#pizzaStatus')).toContainText('added');
  await page.getByRole('link', { name: /^Add drinks/ }).click();
  await expect(page.locator('#drinkType')).toHaveValue('Dr. Pepper');
  await page
    .getByRole('button', { name: 'Add drink to order', exact: true })
    .click();
  await page
    .getByRole('link', { name: 'Review your order', exact: true })
    .click();
  await expect(page.locator('#orderItems')).toContainText('Double Pepperoni');
  await expect(page.locator('#orderItems')).toContainText('Dr. Pepper');
  await expect(page.locator('#orderSubtotal')).toHaveText('$8.00');
});
