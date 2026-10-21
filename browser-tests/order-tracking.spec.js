import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { TEST_EMPLOYEE } from './employee-fixture.js';

const require = createRequire(import.meta.url);

test('customer timer follows employee buttons, retains stale progress and restores saved milestones', async ({
  page,
  browser,
  baseURL,
}) => {
  const staffContext = await browser.newContext({ baseURL });
  const staff = await staffContext.newPage();
  try {
    const registered = await page.request.post('/api/auth/register', {
      headers: { Origin: baseURL },
      data: {
        firstName: 'Tracker',
        lastName: 'Customer',
        email: `${randomUUID()}@example.com`,
        password: 'tracking browser password',
      },
    });
    expect(registered.status()).toBe(201);
    const saved = await page.request.post('/api/orders', {
      headers: { Origin: baseURL },
      data: {
        customerName: 'Tracker Customer',
        phoneNumber: '555-555-0100',
        serviceType: 'Pickup',
        requestId: randomUUID(),
        items: [{ menuItemId: 1, quantity: 1, toppings: [] }],
      },
    });
    expect(saved.status()).toBe(201);
    const { orderId } = await saved.json();
    await staff.request.post('/api/employee/auth/login', {
      headers: { Origin: baseURL },
      data: TEST_EMPLOYEE,
    });
    await staff.goto('/employee.html');
    await page.goto('/order.html');
    const tracker = page.getByRole('region', {
      name: `Order #${orderId} progress`,
      exact: true,
    });
    await expect(tracker).toContainText('Time since order:');
    await expect(tracker.locator('[aria-current="step"]')).toContainText(
      'Order received',
    );
    const clock = tracker.locator('[data-order-clock]');
    const firstClock = await clock.textContent();
    await expect(clock).not.toHaveText(firstClock);
    await page.locator('#accountLink').focus();
    const focused = await page.evaluate(() => document.activeElement.id);
    expect(focused).toBe('accountLink');
    // The employee uses the same native controls available to keyboard and touch users.
    const advance = staff.locator(`#advance-${orderId}`);
    await expect(advance).toHaveText('Start preparing');
    await advance.focus();
    await staff.keyboard.press('Enter');
    await expect(tracker.locator('[aria-current="step"]')).toContainText(
      'Preparing',
    );
    await expect(advance).toHaveText('Send to oven');
    await advance.press('Enter');
    await expect(tracker.locator('[aria-current="step"]')).toContainText(
      'In the oven',
    );
    await expect(advance).toHaveText('Cut and boxed');
    await advance.press('Enter');
    await expect(tracker).toContainText('Your order is ready for pickup.');
    await expect(tracker.locator('time')).toHaveCount(4);
    expect(await page.evaluate(() => document.activeElement.id)).toBe(focused);
    await page.route('**/api/orders', (route) => route.abort());
    await expect(page.locator('#trackingConnection')).toContainText(
      'Updates interrupted',
    );
    await expect(tracker).toContainText('Your order is ready for pickup.');
    await staff.locator(`#recall-${orderId}`).click();
    await page.unroute('**/api/orders');
    await expect(tracker.locator('[aria-current="step"]')).toContainText(
      'In the oven',
    );
    await expect(tracker.locator('time')).toHaveCount(3);
    await expect(page.locator('#trackingConnection')).toContainText('Live');
    await advance.click();
    await expect(tracker).toContainText('Your order is ready for pickup.');
    await page.reload();
    await expect(tracker.locator('time')).toHaveCount(4);
    await page.setViewportSize({ width: 390, height: 844 });
    await tracker.scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    await page.evaluate(
      readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'),
    );
    const violations = await page.evaluate(async () =>
      (
        await window.axe.run('#orderHistory', {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
          },
        })
      ).violations.map((entry) => entry.id),
    );
    expect(violations).toEqual([]);
    await page.screenshot({
      path: 'test-results/order-tracking-mobile.png',
      fullPage: true,
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({
      path: 'test-results/order-tracking-desktop.png',
      fullPage: true,
    });
    await staff.screenshot({
      path: 'test-results/order-tracking-kitchen.png',
      fullPage: true,
    });
    await advance.click();
    await expect(tracker.locator('[aria-current="step"]')).toContainText(
      'Handed off',
    );
    await expect(clock).toContainText('Total time:');
    const completedClock = await clock.textContent();
    await expect(page.locator('#trackingConnection')).toContainText('Live');
    // Waiting for another polling cycle verifies terminal time does not keep increasing.
    const checked = await page.locator('#trackingConnection').textContent();
    await expect(page.locator('#trackingConnection')).not.toHaveText(checked);
    await expect(clock).toHaveText(completedClock);
  } finally {
    await staffContext.close();
  }
});

test('drink orders omit the oven and boxing milestones', async ({
  page,
  baseURL,
}) => {
  await page.request.post('/api/auth/register', {
    headers: { Origin: baseURL },
    data: {
      firstName: 'Drink',
      lastName: 'Customer',
      email: `${randomUUID()}@example.com`,
      password: 'drink tracking password',
    },
  });
  const menu = await (await page.request.get('/api/menu')).json();
  const drink = menu.find((item) => item.category === 'Drink');
  const response = await page.request.post('/api/orders', {
    headers: { Origin: baseURL },
    data: {
      customerName: 'Drink Customer',
      phoneNumber: '555-555-0100',
      serviceType: 'Dine-in',
      requestId: randomUUID(),
      items: [{ menuItemId: drink.menuItemId, quantity: 1, toppings: [] }],
    },
  });
  const { orderId } = await response.json();
  await page.goto('/order.html');
  const tracker = page.getByRole('region', {
    name: `Order #${orderId} progress`,
    exact: true,
  });
  await expect(tracker).toBeVisible();
  await expect(tracker).not.toContainText('In the oven');
  await expect(tracker).not.toContainText('Cut and boxed');
  await expect(tracker).toContainText('Ready');
});
