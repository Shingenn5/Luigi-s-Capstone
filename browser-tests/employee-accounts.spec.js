import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { TEST_EMPLOYEE } from './employee-fixture.js';

const require = createRequire(import.meta.url);

for (const width of [1280, 390]) {
  test(`admin creates staff accounts at ${width}px`, async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const login = await page.request.post('/api/employee/auth/login', {
      headers: { Origin: baseURL },
      data: { ...TEST_EMPLOYEE, username: 'browser.admin' },
    });
    expect(login.ok()).toBeTruthy();
    await page.goto('/employee.html');
    await page
      .getByRole('button', { name: 'Staff accounts', exact: true })
      .click();
    const username = `staff.${randomUUID().slice(0, 8)}`;
    await page
      .getByLabel('Display name', { exact: true })
      .fill('New Team Member');
    await page.getByLabel('Username', { exact: true }).fill(username);
    await page
      .getByLabel('Role', { exact: true })
      .selectOption(width === 1280 ? 'admin' : 'employee');
    await page
      .getByLabel('Password', { exact: true })
      .fill('private test password');
    await page
      .getByLabel('Confirm password', { exact: true })
      .fill('wrong password');
    await page
      .getByRole('button', { name: 'Create account', exact: true })
      .click();
    await expect(page.locator('#accountConfirmation')).toBeFocused();
    expect(
      await page
        .locator('#accountConfirmation')
        .evaluate((node) => node.validationMessage),
    ).toBe('Passwords do not match.');
    await page
      .getByLabel('Confirm password', { exact: true })
      .fill('private test password');
    await page.getByLabel('Confirm password', { exact: true }).press('Enter');
    await expect(page.locator('#accountStatus')).toContainText(
      `account ${username} created`,
    );
    await expect(page.locator('#accountStatus')).toBeFocused();
    await expect(page.locator('#accountPassword')).toHaveValue('');
    await expect(page.locator('#accountUsername')).toHaveValue('');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(
      readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'),
    );
    expect(
      await page.evaluate(async () =>
        (await window.axe.run(document)).violations.map((item) => item.id),
      ),
    ).toEqual([]);
    await page.screenshot({
      path: `test-results/staff-accounts-${width}.png`,
      fullPage: true,
    });
    // A duplicate must report the conflict and retain the identity fields for correction.
    await page.getByLabel('Display name', { exact: true }).fill('Duplicate');
    await page
      .getByLabel('Username', { exact: true })
      .fill(username.toUpperCase());
    await page
      .getByLabel('Password', { exact: true })
      .fill('private test password');
    await page
      .getByLabel('Confirm password', { exact: true })
      .fill('private test password');
    await page
      .getByRole('button', { name: 'Create account', exact: true })
      .click();
    await expect(page.locator('#accountStatus')).toContainText(
      'already exists',
    );
    await expect(page.locator('#accountUsername')).toHaveValue(
      username.toUpperCase(),
    );
    await expect(page.locator('#accountPassword')).toHaveValue('');
    await page
      .getByRole('button', { name: 'Employee logout', exact: true })
      .click();
    await expect(page).toHaveURL(/employee-login.html$/);
    const newLogin = await page.request.post('/api/employee/auth/login', {
      headers: { Origin: baseURL },
      data: { username, password: 'private test password' },
    });
    expect(newLogin.ok()).toBeTruthy();
    await page.goto('/employee.html');
    await expect(page.locator('#employeeIdentity')).toContainText(
      'New Team Member',
    );
    if (width === 1280)
      await expect(page.locator('#staffAccountsButton')).toBeVisible();
    else await expect(page.locator('#staffAccountsButton')).toBeHidden();
  });
}
