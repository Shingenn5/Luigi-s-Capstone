import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { TEST_EMPLOYEE } from './employee-fixture.js';
const require = createRequire(import.meta.url);

for (const width of [1280, 390]) {
  test(`customer account receives saved kitchen notifications at ${width}px`, async ({
    page,
    browser,
    baseURL,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const staffContext = await browser.newContext({ baseURL });
    const staff = await staffContext.newPage();
    const account = {
      firstName: 'Updates',
      lastName: 'Customer',
      email: `${randomUUID()}@example.com`,
      password: 'notification browser password',
    };
    try {
      const registered = await page.request.post('/api/auth/register', {
        headers: { Origin: baseURL },
        data: account,
      });
      expect(registered.status()).toBe(201);
      const menu = await (await page.request.get('/api/menu')).json();
      const menuItem =
        width === 1280
          ? menu.find((item) => item.category === 'Pizza')
          : menu.find((item) => item.category === 'Drink');
      const saved = await page.request.post('/api/orders', {
        headers: { Origin: baseURL },
        data: {
          customerName: 'Account update test',
          phoneNumber: '555-555-0100',
          serviceType: width === 1280 ? 'Pickup' : 'Dine-in',
          requestId: randomUUID(),
          items: [
            { menuItemId: menuItem.menuItemId, quantity: 1, toppings: [] },
          ],
        },
      });
      expect(saved.status()).toBe(201);
      const { orderId } = await saved.json();
      await staff.request.post('/api/employee/auth/login', {
        headers: { Origin: baseURL },
        data: TEST_EMPLOYEE,
      });
      await staff.goto('/employee.html');
      await page.goto('/index.html');
      const toggle = page.locator('#notificationsToggle');
      await expect(toggle).toBeVisible();
      await expect(page.locator('#notificationCount')).toHaveText('0');
      await toggle.click();
      await expect(page.locator('#notificationList')).toContainText(
        'No order updates yet',
      );
      await toggle.focus();
      await staff.locator(`#advance-${orderId}`).click();
      await expect(page.locator('#notificationCount')).toHaveText('1');
      await expect(page.locator('#notificationAnnouncement')).toContainText(
        'preparing',
      );
      await expect(page.locator('#notificationList')).toContainText(
        'The kitchen is preparing your order.',
      );
      expect(await page.evaluate(() => document.activeElement.id)).toBe(
        'notificationsToggle',
      );
      if (width === 1280) {
        await staff.locator(`#advance-${orderId}`).click();
        await expect(page.locator('#notificationCount')).toHaveText('2');
        await expect(page.locator('#notificationList')).toContainText(
          'Your pizza is in the oven.',
        );
      }
      await staff.locator(`#advance-${orderId}`).click();
      const total = width === 1280 ? 3 : 2;
      await expect(page.locator('#notificationCount')).toHaveText(
        String(total),
      );
      await expect(page.locator('#notificationList li').first()).toContainText(
        width === 1280 ? 'made, cut and boxed' : 'ready for service',
      );
      expect(
        await page.locator('#notificationList').textContent(),
      ).not.toContain('Private staff');
      await page.goto('/menu.html');
      await expect(page.locator('#notificationCount')).toHaveText(
        String(total),
      );
      await page.locator('#notificationsToggle').click();
      await expect(page.locator('#notificationList li')).toHaveCount(total);
      await page
        .locator('#notificationList li')
        .first()
        .getByRole('button', { name: /Mark update/ })
        .click();
      await expect(page.locator('#notificationCount')).toHaveText(
        String(total - 1),
      );
      expect(
        await page.evaluate(() => document.activeElement === document.body),
      ).toBe(false);
      await page.reload();
      await expect(page.locator('#notificationCount')).toHaveText(
        String(total - 1),
      );
      await page.locator('#notificationsToggle').click();
      await page.locator('#notificationsReadAll').click();
      await expect(page.locator('#notificationCount')).toHaveText('0');
      await expect(page.locator('#notificationsReadAll')).toBeDisabled();
      await page.evaluate(
        readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'),
      );
      const violations = await page.evaluate(async () =>
        (
          await window.axe.run(document, {
            runOnly: {
              type: 'tag',
              values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
            },
          })
        ).violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      );
      expect(violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`account-updates-${width}.png`),
        fullPage: true,
      });
      await page.request.post('/api/auth/logout', {
        headers: { Origin: baseURL },
        data: {},
      });
      await expect(page.locator('#notificationsToggle')).toBeHidden();
      await expect(page.locator('#notificationsPanel')).toBeHidden();
      await expect(page.locator('#notificationList li')).toHaveCount(0);
      await page.request.post('/api/auth/login', {
        headers: { Origin: baseURL },
        data: account,
      });
      await page.goto('/order.html');
      await expect(page.locator('#notificationCount')).toHaveText('0');
      await page.locator('#notificationsToggle').click();
      await expect(page.locator('#notificationList li')).toHaveCount(total);
      await expect(page.locator('#notificationList')).not.toContainText(
        'Unread',
      );
    } finally {
      await staffContext.close();
    }
  });
}
