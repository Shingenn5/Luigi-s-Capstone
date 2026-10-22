import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { TEST_EMPLOYEE } from './employee-fixture.js';

const require = createRequire(import.meta.url);

async function buildOrder(page) {
  await page.goto('/menu.html');
  await expect(page.locator('#pizzaFields')).toBeEnabled();
  await page.locator('#topping-1').check();
  await page.locator('#topping-option-1').selectOption('2');
  await page.locator('#sauceChoice').selectOption('Light');
  await page
    .getByRole('button', { name: 'Add pizza to order', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Add drink to order', exact: true })
    .click();
  await page
    .getByRole('link', { name: 'Review your order', exact: true })
    .click();
}

async function register(page) {
  const account = {
    email: `${randomUUID()}@example.com`,
    password: 'checkout test password',
  };
  await page.locator('#accountStatus a').click();
  await page.locator('#registerMode').click();
  await page.locator('#firstName').fill('Checkout');
  await page.locator('#lastName').fill('Tester');
  await page.locator('#loginIdentity').fill(account.email);
  await page.locator('#loginPassword').fill(account.password);
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(page.locator('#checkoutFields')).toBeEnabled();
  return account;
}

for (const serviceType of ['Pickup', 'Dine-in']) {
  test(`mobile ${serviceType} checkout reaches the kitchen and safely retries a lost response`, async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await buildOrder(page);
    await register(page);
    await expect(page.locator('#orderItems')).toContainText(
      'Double Pepperoni, Light sauce',
    );
    await expect(page.locator('#orderSubtotal')).toHaveText('$8.00');
    await page.locator('#phoneNumber').fill('555-555-0100');
    await page.locator('#serviceType').selectOption(serviceType);
    await page
      .locator('#kitchenNotes')
      .fill('Cut into squares. <b>Plain text</b>');
    if (serviceType === 'Dine-in') {
      await page.locator('#tableName').fill('12');
      await page.locator('#serviceType').selectOption('Pickup');
      await expect(page.locator('#tableName')).toBeDisabled();
      await expect(page.locator('#tableName')).toHaveValue('');
      await page.locator('#serviceType').selectOption('Dine-in');
      await page.locator('#tableName').fill('12');
    }
    await page.screenshot({
      path: `test-results/checkout-${serviceType}-mobile.png`,
      fullPage: true,
    });
    let savedOrder;
    let firstPost = true;
    await page.route('**/api/orders', async (route) => {
      if (route.request().method() !== 'POST' || !firstPost)
        return route.continue();
      firstPost = false;
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      savedOrder = await response.json();
      // The server committed, but the browser never received its confirmation.
      await route.abort('failed');
    });
    await page
      .getByRole('button', { name: 'Place order', exact: true })
      .click();
    await expect(page.locator('#orderStatus')).toContainText(
      'Cannot reach the server',
    );
    await expect(page.locator('#orderSubtotal')).toHaveText('$8.00');
    await page
      .getByRole('button', { name: 'Place order', exact: true })
      .click();
    await expect(page.locator('#orderStatus')).toContainText(
      `Order #${savedOrder.orderId} sent to the kitchen`,
    );
    await expect(page.locator('#orderSubtotal')).toHaveText('$0.00');
    await page.getByRole('link', { name: 'Track your latest order' }).click();
    await expect(page.locator(`#order-${savedOrder.orderId}`)).toBeFocused();
    const orders = await (await page.request.get('/api/orders')).json();
    expect(orders).toHaveLength(1);
    expect(orders[0].totalCents).toBe(800);
    await page.reload();
    await expect(page.locator('#orderHistory')).toContainText(
      `Order #${savedOrder.orderId}`,
    );
    await expect(page.locator('#orderHistory')).toContainText(
      'Your kitchen instructions: Cut into squares. <b>Plain text</b>',
    );
    await expect(page.locator('#orderHistory b')).toHaveCount(0);
    await page.screenshot({
      path: `test-results/receipt-${serviceType}-mobile.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.request.post('/api/employee/auth/login', {
      headers: { Origin: baseURL },
      data: TEST_EMPLOYEE,
    });
    await page.goto('/employee.html');
    const ticket = page.locator(`#ticket-${savedOrder.orderId}`);
    await expect(ticket).toContainText(serviceType);
    await expect(ticket).toContainText('Double Pepperoni');
    await expect(ticket).toContainText('Light sauce');
    await expect(ticket).toContainText(
      'Kitchen notes: Cut into squares. <b>Plain text</b>',
    );
    if (serviceType === 'Dine-in')
      await expect(ticket).toContainText('Table 12');
    await ticket
      .getByText('Contact and order details', { exact: true })
      .click();
    await expect(ticket).toContainText('Order activity');
    await expect(ticket).toContainText('Received: New');
    await page.locator(`#advance-${savedOrder.orderId}`).click();
    await expect(ticket).toContainText('Advanced: Preparing');
    await expect(ticket).toContainText('Browser Employee');
    await page.evaluate(
      readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'),
    );
    const violations = await page.evaluate(async () =>
      (
        await window.axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
          },
        })
      ).violations.map((entry) => entry.id),
    );
    expect(violations).toEqual([]);
    await page.screenshot({
      path: `test-results/handoff-${serviceType}-mobile.png`,
      fullPage: true,
    });
    await expect(ticket).toContainText('$8.00');
  });
}

for (const during of ['tracking', 'submission']) {
  test(`expired session during ${during} provides a login link and preserves the cart`, async ({
    page,
    baseURL,
  }) => {
    await buildOrder(page);
    const account = await register(page);
    await page.locator('#phoneNumber').fill('555-555-0100');
    // Block history polling only for the submission case, to exercise its 401 handler.
    if (during === 'submission')
      await page.route('**/api/orders', (route) =>
        route.request().method() === 'GET'
          ? route.fulfill({ json: [] })
          : route.continue(),
      );
    await page.request.post('/api/auth/logout', {
      headers: { Origin: baseURL },
      data: {},
    });
    if (during === 'tracking')
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
    else
      await page
        .getByRole('button', { name: 'Place order', exact: true })
        .click();
    await expect(page.locator('#accountStatus')).toContainText(
      'Your session expired',
    );
    await expect(page.locator('#submitOrder')).toBeDisabled();
    await expect(page.locator('#orderSubtotal')).toHaveText('$8.00');
    await page.unroute('**/api/orders');
    await page.getByRole('link', { name: 'Log in again', exact: true }).click();
    await page.locator('#loginIdentity').fill(account.email);
    await page.locator('#loginPassword').fill(account.password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page.locator('#checkoutFields')).toBeEnabled();
    await expect(page.locator('#orderSubtotal')).toHaveText('$8.00');
    expect(await (await page.request.get('/api/orders')).json()).toEqual([]);
  });
}
