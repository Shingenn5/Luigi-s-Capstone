import { test, expect } from '@playwright/test';

const PAGE_ROOT = '/Luigi-s-Capstone';

test('Pages serves the restaurant with a working menu and draft cart under its repository URL', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${PAGE_ROOT}/`);
  await expect(page).toHaveTitle(/Luigi's Pizzeria/);
  await expect(page.locator('.navbar-brand img')).toHaveAttribute(
    'src',
    './assets/Luigis-Logo.png',
  );
  await page.getByRole('link', { name: 'Our menu', exact: true }).click();
  await expect(page.locator('#pizzaFields')).toBeEnabled();
  await page.locator('#topping-1').check();
  await page.locator('#topping-option-1').selectOption('2');
  await expect(page.locator('#pizzaPrice')).toContainText('$7.00');
  await page
    .getByRole('button', { name: 'Add pizza to order', exact: true })
    .click();
  await page
    .getByRole('link', { name: 'Review your order', exact: true })
    .click();
  await expect(page.locator('#orderSubtotal')).toHaveText('$7.00');
  await expect(page.locator('#accountStatus')).toContainText(
    'Sending orders is unavailable',
  );
  await expect(page.locator('#submitOrder')).toBeDisabled();
  await page.reload();
  await expect(page.locator('#orderSubtotal')).toHaveText('$7.00');
  expect(errors).toEqual([]);
});

test('Pages clearly marks unavailable sign-in and publishes no server or customer files', async ({
  page,
}) => {
  await page.goto(`${PAGE_ROOT}/login.html`);
  await expect(page.locator('#loginForm [type=submit]')).toBeDisabled();
  await expect(page.locator('#loginStatus')).toContainText(
    'unavailable in this preview',
  );
  await page.goto(`${PAGE_ROOT}/employee-login.html`);
  await expect(page.locator('#employeeLoginForm [type=submit]')).toBeDisabled();
  await expect(page.locator('#employeeLoginStatus')).toContainText(
    'unavailable',
  );
  for (const path of [
    'server.js',
    '.env',
    'Database/schema.sql',
    'employee.html',
    'README.md',
  ]) {
    expect((await page.request.get(`${PAGE_ROOT}/${path}`)).status()).toBe(404);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${PAGE_ROOT}/menu.html`);
  await expect(page.locator('#pizzaFields')).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
