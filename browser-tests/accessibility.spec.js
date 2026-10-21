import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { TEST_EMPLOYEE } from './employee-fixture.js';

const require = createRequire(import.meta.url);

async function checkAccessibility(page) {
  await page.evaluate(
    readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'),
  );
  const results = await page.evaluate(async () =>
    window.axe.run(document, {
      runOnly: {
        type: 'tag',
        values: [
          'wcag2a',
          'wcag2aa',
          'wcag21a',
          'wcag21aa',
          'wcag22aa',
          'best-practice',
        ],
      },
    }),
  );
  expect(
    results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => ({
        target: node.target,
        summary: node.failureSummary,
      })),
    })),
  ).toEqual([]);
}

for (const path of [
  'index.html',
  'menu.html',
  'order.html',
  'login.html',
  'about.html',
  'visit.html',
  'employee-login.html',
]) {
  test(`${path} has no detected accessibility violations`, async ({ page }) => {
    await page.goto(`/${path}`);
    await page.waitForLoadState('networkidle');
    await checkAccessibility(page);
  });
}

test('login and registration errors stay linked to fields and receive focus', async ({
  page,
}) => {
  await page.goto('/login.html');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  const summary = page.locator('[data-error-summary]');
  await expect(summary).toBeFocused();
  await expect(page.locator('#loginIdentity')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await summary.getByRole('link', { name: /Email address/ }).click();
  await expect(page.locator('#loginIdentity')).toBeFocused();
  await checkAccessibility(page);
  await page.locator('#registerMode').click();
  await expect(page.locator('#firstName')).toBeFocused();
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(summary).toBeFocused();
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(4);
  await checkAccessibility(page);
});

test('pizza options, registration, checkout and history work by keyboard', async ({
  page,
}) => {
  await page.goto('/menu.html');
  await expect(page.locator('#pizzaFields')).toBeEnabled();
  await page.locator('#topping-1').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#topping-1')).toBeChecked();
  await page.keyboard.press('Tab');
  await expect(page.locator('#topping-option-1')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.locator('#sauceChoice').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#pizzaPrice')).toContainText('$7.00');
  await page
    .getByRole('button', { name: 'Add pizza to order', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await page
    .getByRole('link', { name: 'Review your order', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#orderItems')).toContainText(
    'Double Pepperoni, Light sauce',
  );
  await page.locator('#quantity-0').focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText('0');
  await page.keyboard.press('Tab');
  await expect(page.locator('#quantity-0')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(page.locator('#quantity-0-error')).toBeVisible();
  await page.locator('#quantity-0').focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText('1');
  await page.keyboard.press('Tab');
  await expect(page.locator('#orderSubtotal')).toHaveText('$7.00');
  await page.locator('#accountStatus a').focus();
  await page.keyboard.press('Enter');
  await page.locator('#registerMode').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.insertText('Keyboard');
  await page.keyboard.press('Tab');
  await page.keyboard.insertText('Customer');
  await page.keyboard.press('Tab');
  await page.keyboard.insertText(`keyboard-${Date.now()}@example.com`);
  await page.keyboard.press('Tab');
  await page.keyboard.insertText('accessible keyboard password');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/order.html$/);
  await expect(page.locator('#checkoutFields')).toBeEnabled();
  await page
    .getByRole('button', { name: 'Save pending order', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-error-summary]')).toBeFocused();
  await checkAccessibility(page);
  await page.locator('#phoneNumber').focus();
  await page.keyboard.insertText('(555) 555-0100');
  await page
    .getByRole('button', { name: 'Save pending order', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#orderStatus')).toContainText('saved as Pending');
  await expect(page.locator('#orderHistory')).toContainText(
    'Double Pepperoni, Light sauce',
  );
  await expect(page.locator('#orderStatus')).toBeFocused();
  await checkAccessibility(page);
});

test('small-screen reflow, skip link, navigation and reduced motion remain usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const path of [
    'index.html',
    'menu.html',
    'order.html',
    'login.html',
    'about.html',
    'visit.html',
  ]) {
    await page.goto(`/${path}`);
    await page.waitForLoadState('networkidle');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await checkAccessibility(page);
  }
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  await page.getByRole('button', { name: 'Toggle navigation' }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Toggle navigation' }),
  ).toHaveAttribute('aria-expanded', 'true');
  await checkAccessibility(page);
});

test('forced colors preserve keyboard controls and selected toppings', async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/menu.html');
  await expect(page.locator('#pizzaFields')).toBeEnabled();
  await page.locator('#topping-1').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#topping-1')).toBeChecked();
  await page.keyboard.press('Tab');
  await expect(page.locator('#topping-option-1')).toBeFocused();
  await expect(page.locator('#topping-option-1')).toBeVisible();
  await checkAccessibility(page);
});

test('employee sign-in protects orders and supports keyboard access and logout', async ({
  page,
}) => {
  await page.goto('/employee.html');
  await expect(page).toHaveURL(/employee-login.html$/);
  const origin = new URL(page.url()).origin;
  await page.request.post('/api/auth/register', {
    headers: { Origin: origin },
    data: {
      firstName: 'Employee',
      lastName: 'Browser Customer',
      email: `employee-order-${Date.now()}@example.com`,
      password: 'customer browser password',
    },
  });
  expect((await page.request.get('/api/employee/orders')).status()).toBe(401);
  const order = await page.request.post('/api/orders', {
    headers: { Origin: origin },
    data: {
      customerName: 'Employee Browser Customer',
      phoneNumber: '555-555-0100',
      serviceType: 'Pickup',
      requestId: `employee-browser-order-${Date.now()}`,
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
  expect(order.status()).toBe(201);
  await page
    .getByRole('button', { name: 'Employee login', exact: true })
    .click();
  await expect(page.locator('[data-error-summary]')).toBeFocused();
  await checkAccessibility(page);
  await page.locator('#employeeUsername').fill(TEST_EMPLOYEE.username);
  await page.locator('#employeePassword').fill('incorrect password');
  await page.locator('#employeePassword').press('Enter');
  await expect(page.locator('#employeeLoginStatus')).toContainText('incorrect');
  await expect(page.locator('#employeeLoginStatus')).toBeFocused();
  await page.locator('#employeePassword').fill(TEST_EMPLOYEE.password);
  await page.locator('#employeePassword').press('Enter');
  await expect(page).toHaveURL(/employee.html$/);
  await expect(page.locator('#employeeIdentity')).toContainText(
    TEST_EMPLOYEE.displayName,
  );
  await expect(page.locator('#employeeOrders')).toHaveAttribute(
    'aria-busy',
    'false',
  );
  await expect(page.locator('#employeeOrders')).toContainText(
    'Employee Browser Customer',
  );
  await expect(page.locator('#employeeOrders')).toContainText(
    'Double Pepperoni, Light sauce',
  );
  await checkAccessibility(page);
  await page
    .getByRole('button', { name: 'Refresh orders', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#employeeStatus')).toContainText('pending');
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await checkAccessibility(page);
  await page
    .getByRole('button', { name: 'Employee logout', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/employee-login.html$/);
  await page.goto('/employee.html');
  await expect(page).toHaveURL(/employee-login.html$/);
});
