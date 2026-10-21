import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { TEST_EMPLOYEE } from './employee-fixture.js';

const require = createRequire(import.meta.url);
async function login(page, baseURL) {
  const response = await page.request.post('/api/employee/auth/login', {
    headers: { Origin: baseURL },
    data: TEST_EMPLOYEE,
  });
  expect(response.ok()).toBeTruthy();
  await page.goto('/employee.html');
  await expect(page.locator('#connectionStatus')).toContainText('Live');
  await expect(page.locator('#staffItemFields')).toBeEnabled();
}
async function order(page, baseURL, name = 'Kitchen Browser') {
  const response = await page.request.post('/api/employee/orders', {
    headers: { Origin: baseURL },
    data: {
      customerName: name,
      phoneNumber: '555-555-0100',
      source: 'Phone',
      serviceType: 'Pickup',
      requestId: randomUUID(),
      notes: 'Keep modifiers visible',
      items: [
        {
          menuItemId: 1,
          quantity: 2,
          sauce: 'Light',
          toppings: [{ toppingId: 1, quantity: 2 }],
        },
      ],
    },
  });
  expect(response.status()).toBe(201);
  return response.json();
}
async function accessible(page) {
  await page.evaluate(
    readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'),
  );
  const violations = await page.evaluate(async () =>
    (
      await window.axe.run(document, {
        runOnly: {
          type: 'tag',
          values: [
            'wcag2a',
            'wcag2aa',
            'wcag21aa',
            'wcag22aa',
            'best-practice',
          ],
        },
      })
    ).violations.map((item) => ({
      id: item.id,
      nodes: item.nodes.map((node) => node.target),
    })),
  );
  expect(violations).toEqual([]);
}

test('live kitchen supports two employees, focus, stage changes, cancellation and recall', async ({
  page,
  browser,
  baseURL,
}) => {
  await login(page, baseURL);
  const otherContext = await browser.newContext({ baseURL });
  const other = await otherContext.newPage();
  try {
    await login(other, baseURL);
    await page.request.post('/api/auth/register', {
      headers: { Origin: baseURL },
      data: {
        firstName: 'Kitchen',
        lastName: 'Customer',
        email: `${randomUUID()}@example.com`,
        password: 'kitchen customer password',
      },
    });
    const customerResponse = await page.request.post('/api/orders', {
      headers: { Origin: baseURL },
      data: {
        customerName: 'Incoming Website Customer',
        phoneNumber: '555-555-0100',
        serviceType: 'Pickup',
        requestId: randomUUID(),
        items: [
          {
            menuItemId: 1,
            quantity: 1,
            sauce: 'Light',
            toppings: [{ toppingId: 1, quantity: 2 }],
          },
        ],
      },
    });
    expect(customerResponse.status()).toBe(201);
    const ticket = await customerResponse.json();
    const card = page.locator(`#ticket-${ticket.orderId}`);
    await expect(card).toContainText('Double Pepperoni');
    await expect(other.locator(`#ticket-${ticket.orderId}`)).toBeVisible();
    await page.locator(`#select-${ticket.orderId}`).focus();
    await order(other, baseURL, 'Second incoming ticket');
    await expect(page.locator('#employeeStatus')).toContainText(
      'New kitchen order',
    );
    await expect(page.locator(`#select-${ticket.orderId}`)).toBeFocused();
    await page.locator(`#advance-${ticket.orderId}`).click();
    await expect(
      other.locator(`[data-lane="Preparing"] #ticket-${ticket.orderId}`),
    ).toBeVisible();
    await expect(page.locator(`#advance-${ticket.orderId}`)).toHaveText(
      'Send to oven',
    );
    await expect(page.locator(`#advance-${ticket.orderId}`)).toBeFocused();
    await page.locator(`#advance-${ticket.orderId}`).click();
    await expect(card).toContainText('In oven');
    await page.locator(`#advance-${ticket.orderId}`).click();
    await expect(page.locator(`#advance-${ticket.orderId}`)).toHaveText(
      'Complete handoff',
    );
    await page.locator(`#advance-${ticket.orderId}`).click();
    await expect(
      page.locator(`[data-lane="Ready"] #ticket-${ticket.orderId}`),
    ).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Order history', exact: true })
      .click();
    await expect(page.locator(`#ticket-${ticket.orderId}`)).toBeVisible();
    await page.locator(`#recall-${ticket.orderId}`).click();
    await page
      .getByRole('button', { name: 'Kitchen board', exact: true })
      .click();
    await expect(
      page.locator(`[data-lane="Ready"] #ticket-${ticket.orderId}`),
    ).toBeVisible();
    await page.locator(`#cancel-${ticket.orderId}`).click();
    await expect(page.locator('#cancelDialog')).toBeVisible();
    await page.locator('#cancelReason').fill('Customer cancelled');
    await page.getByRole('button', { name: 'Confirm cancellation' }).click();
    await expect(page.locator('#cancelDialog')).not.toBeVisible();
    await page
      .getByRole('button', { name: 'Order history', exact: true })
      .click();
    await page.locator('#historyStage').selectOption('Cancelled');
    await page.locator('#historySearch').fill(String(ticket.orderId));
    await page
      .getByRole('button', { name: 'Search history', exact: true })
      .click();
    await expect(page.locator(`#ticket-${ticket.orderId}`)).toBeVisible();
    await page.locator(`#recall-${ticket.orderId}`).click();
    await page
      .getByRole('button', { name: 'Kitchen board', exact: true })
      .click();
    await expect(
      page.locator(`[data-lane="Ready"] #ticket-${ticket.orderId}`),
    ).toBeVisible();
  } finally {
    await otherContext.close();
  }
});

test('staff order draft persists separately and submits authoritative modifiers and dine-in details', async ({
  page,
  baseURL,
}) => {
  await login(page, baseURL);
  await page.evaluate(() =>
    localStorage.setItem(
      'luigis-order-v1',
      JSON.stringify({ items: [], requestId: 'untouched-customer-draft' }),
    ),
  );
  await page.getByRole('button', { name: 'New order', exact: true }).click();
  await page.locator('#staffItem').selectOption('1');
  await page.locator('#staff-topping-1').check();
  await page.locator('#staff-coverage-1').selectOption('2');
  await page.locator('#staffSauce').selectOption('Light');
  await expect(page.locator('#staffItemPrice')).toContainText('$7.00');
  await page.getByRole('button', { name: 'Add item to staff order' }).click();
  await page
    .getByRole('button', { name: 'Send to kitchen', exact: true })
    .click();
  await expect(page.locator('#staffName')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(
    page.locator('#staffCheckout [data-error-summary]'),
  ).toBeFocused();
  await accessible(page);
  await page.locator('#staffName').fill('Staff Dine-in Browser');
  await page.locator('#staffService').selectOption('Dine-in');
  await page.locator('#staffTable').fill('12');
  await page.locator('#staffNotes').fill('Table service test');
  await page.reload();
  await expect(page.locator('#staffItemFields')).toBeEnabled();
  await page.getByRole('button', { name: 'New order', exact: true }).click();
  await expect(page.locator('#staffName')).toHaveValue('Staff Dine-in Browser');
  await expect(page.locator('#staffTotal')).toContainText('$7.00');
  await accessible(page);
  await page
    .getByRole('button', { name: 'Send to kitchen', exact: true })
    .click();
  await expect(page.locator('#boardView')).toBeVisible();
  const ticket = page
    .locator('article')
    .filter({ hasText: 'Staff Dine-in Browser' });
  await expect(ticket).toContainText('Table 12');
  await expect(ticket).toContainText('Double Pepperoni');
  await expect(ticket).toContainText('Light sauce');
  await expect(ticket).toContainText('$7.00');
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('luigis-order-v1')).requestId,
    ),
  ).toBe('untouched-customer-draft');
});

test('connection failures retain tickets and pause actions; themes, keyboard and mobile remain accessible', async ({
  page,
  baseURL,
}) => {
  await login(page, baseURL);
  const ticket = await order(page, baseURL, 'Reconnect Browser');
  await expect(page.locator(`#ticket-${ticket.orderId}`)).toBeVisible();
  await page.route('**/api/employee/kitchen?**', (route) => route.abort());
  await expect(page.locator('#connectionStatus')).toContainText(
    'Connection interrupted',
  );
  await expect(page.locator(`#advance-${ticket.orderId}`)).toBeDisabled();
  await expect(page.locator(`#ticket-${ticket.orderId}`)).toContainText(
    'Reconnect Browser',
  );
  await page.unroute('**/api/employee/kitchen?**');
  await page
    .getByRole('button', { name: 'Refresh orders', exact: true })
    .click();
  await expect(page.locator('#connectionStatus')).toContainText('Live');
  await expect(page.locator(`#advance-${ticket.orderId}`)).toBeEnabled();
  await page.locator(`#select-${ticket.orderId}`).focus();
  await page.keyboard.press('Home');
  await expect(page.locator('[data-ticket-select]').first()).toBeFocused();
  await accessible(page);
  await page.getByRole('button', { name: 'Use light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'light');
  await accessible(page);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'light');
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(page.locator('#connectionStatus')).toContainText('Live');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await accessible(page);
});

test('a committed staff order with a lost response is reconciled without duplicate submission', async ({
  page,
  baseURL,
}) => {
  await login(page, baseURL);
  await page.getByRole('button', { name: 'New order', exact: true }).click();
  await page.getByRole('button', { name: 'Add item to staff order' }).click();
  await page.locator('#staffName').fill('Lost Response Customer');
  await page.locator('#staffPhone').fill('555-555-0100');
  let posts = 0;
  await page.route('**/api/employee/orders', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    posts++;
    const committed = await route.fetch();
    expect(committed.status()).toBe(201);
    await route.abort();
  });
  await page
    .getByRole('button', { name: 'Send to kitchen', exact: true })
    .click();
  await expect(page.locator('#staffStatus')).toContainText('Draft locked');
  await expect(page.locator('#staffName')).toBeDisabled();
  await page
    .getByRole('button', {
      name: 'Check and retry same submission',
      exact: true,
    })
    .click();
  await expect(page.locator('#boardView')).toBeVisible();
  await expect(
    page.locator('article').filter({ hasText: 'Lost Response Customer' }),
  ).toHaveCount(1);
  expect(posts).toBe(1);
});
