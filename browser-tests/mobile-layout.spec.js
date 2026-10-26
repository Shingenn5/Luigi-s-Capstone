import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { TEST_EMPLOYEE } from './employee-fixture.js';
import { createApp } from '../server/app.js';
import { openDatabase } from '../server/database.js';
import { createEmployee } from '../server/employees.js';

async function fits(page) {
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    )
    .toBeLessThanOrEqual(1);
}

for (const width of [320, 375, 390, 768, 1024, 1280]) {
  test(`restaurant pages and signed-in ordering fit at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 850 });
    for (const path of [
      'index.html',
      'about.html',
      'visit.html',
      'login.html',
      'employee-login.html',
      'menu.html',
      'order.html',
    ]) {
      await page.goto(`/${path}`);
      await expect(page.locator('#accountLink')).toBeVisible();
      await fits(page);
    }
    // Layout cases share no authentication quota with end-to-end checkout tests.
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({
        json: { customer: { firstName: 'Mobile', lastName: 'Layout' } },
      }),
    );
    await page.route('**/api/notifications?*', (route) =>
      route.fulfill({
        json: { notifications: [], unreadCount: 0, page: 1, pages: 1 },
      }),
    );
    await page.route('**/api/orders', (route) => route.fulfill({ json: [] }));
    await page.goto('/menu.html');
    await expect(page.locator('#notificationsToggle')).toBeVisible();
    await expect(page.locator('[data-pizza-size="large"]')).toBeEnabled();
    await fits(page);
    if (width < 992) {
      await page.getByRole('button', { name: 'Toggle navigation' }).click();
      await expect(page.locator('#mainNav')).toBeVisible();
      await fits(page);
      await page.getByRole('button', { name: 'Toggle navigation' }).click();
    }
    await page.locator('[data-pizza-size="large"]').click();
    await expect(page.locator('#buildTitle')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#pizzaSize')).toBeFocused();
    await page.locator('#topping-1').check();
    await page.locator('#topping-option-1').selectOption('2');
    await page
      .getByRole('button', { name: 'Add pizza to order', exact: true })
      .click();
    await fits(page);
    if (width <= 390) {
      const controls = await page
        .locator('#pizzaSize, #pizzaQuantity, #topping-option-1')
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getBoundingClientRect().height),
        );
      expect(controls.every((height) => height >= 44)).toBeTruthy();
      const cards = await page
        .locator('[data-pizza-size]')
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getBoundingClientRect().height),
        );
      expect(cards.every((height) => height < 230)).toBeTruthy();
    }
    await page.screenshot({
      path: testInfo.outputPath('menu.png'),
      fullPage: true,
    });
    await page.goto('/order.html');
    await expect(page.locator('#orderItems')).toContainText('Large Pizza');
    await fits(page);
    await page.locator('#notificationsToggle').click();
    await expect(page.locator('#notificationsPanel')).toBeVisible();
    await fits(page);
    await page.screenshot({
      path: testInfo.outputPath('order.png'),
      fullPage: true,
    });
    if (width === 375) {
      await page.setViewportSize({ width: 812, height: 375 });
      await fits(page);
      await page.evaluate(
        () => (document.documentElement.style.fontSize = '200%'),
      );
      await fits(page);
    }
  });
}

test('small-phone staff views and cancellation handle long order details', async ({
  page,
}, testInfo) => {
  // Separate storage and login quotas keep this fixture out of other suites.
  const database = openDatabase(':memory:');
  await createEmployee(database, {
    ...TEST_EMPLOYEE,
    username: 'browser.admin',
    role: 'admin',
  });
  const server = createApp(database).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const baseURL = 'http://127.0.0.1:' + server.address().port;
  try {
    await page.setViewportSize({ width: 320, height: 850 });
    await page.request.post(baseURL + '/api/employee/auth/login', {
      headers: { Origin: baseURL },
      data: { ...TEST_EMPLOYEE, username: 'browser.admin' },
    });
    const saved = await page.request.post(baseURL + '/api/employee/orders', {
      headers: { Origin: baseURL },
      data: {
        customerName: 'MobileLayout'.repeat(10),
        phoneNumber: '555-555-0100',
        source: 'Phone',
        serviceType: 'Dine-in',
        tableName: 'Table'.repeat(8),
        notes: 'LongKitchenInstructions'.repeat(20),
        requestId: randomUUID(),
        items: [
          {
            menuItemId: 1,
            quantity: 20,
            toppings: [{ toppingId: 1, quantity: 2 }],
          },
        ],
      },
    });
    expect(saved.status()).toBe(201);
    const { orderId } = await saved.json();
    await page.goto(baseURL + '/employee.html');
    await expect(page.locator(`#cancel-${orderId}`)).toBeVisible();
    await fits(page);
    await page.screenshot({
      path: testInfo.outputPath('staff-board.png'),
      fullPage: true,
    });
    await page.locator(`#cancel-${orderId}`).click();
    await expect(page.locator('#cancelDialog')).toBeVisible();
    await fits(page);
    await page.locator('#keepOrder').click();
    for (const view of ['entry', 'history', 'accounts', 'timed-out']) {
      await page.locator(`[data-view="${view}"]`).click();
      await fits(page);
      await page.screenshot({
        path: testInfo.outputPath(`staff-${view}.png`),
        fullPage: true,
      });
    }
  } finally {
    await page.goto('about:blank');
    await new Promise((resolve) => server.close(resolve));
    database.close();
  }
});
