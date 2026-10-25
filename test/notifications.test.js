import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../server/database.js';
import { createApp } from '../server/app.js';
import { createEmployee } from '../server/employees.js';
import { changeStatus, readTicket, saveStaffOrder } from '../server/kitchen.js';

test('account notifications are atomic, private, persistent and independently readable', async (context) => {
  const folder = mkdtempSync(join(tmpdir(), 'luigi-notifications-'));
  const path = join(folder, 'notifications.db');
  const database = openDatabase(path);
  const employeeId = await createEmployee(database, {
    username: 'notify.cook',
    displayName: 'Private staff name',
    password: 'notification password',
  });
  const server = createApp(database).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    database.close();
    rmSync(folder, { recursive: true, force: true });
  });
  async function request(path, body, cookie = '', from = origin) {
    return fetch(origin + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Origin: from,
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  async function register(email) {
    const result = await request('/api/auth/register', {
      firstName: 'Notify',
      lastName: 'Customer',
      email,
      password: 'customer password',
    });
    assert.equal(result.status, 201);
    return result.headers.get('set-cookie').split(';')[0];
  }
  const owner = await register('notifications@example.com');
  const other = await register('other.notifications@example.com');
  const login = await request('/api/employee/auth/login', {
    username: 'notify.cook',
    password: 'notification password',
  });
  const employee = login.headers.get('set-cookie').split(';')[0];
  for (const cookie of ['', employee])
    assert.equal(
      (await request('/api/notifications', undefined, cookie)).status,
      401,
    );
  const saved = await request(
    '/api/orders',
    {
      customerName: 'Notification test',
      phoneNumber: '555-555-0100',
      serviceType: 'Pickup',
      requestId: 'notification-customer-order-001',
      items: [{ menuItemId: 1, quantity: 1, toppings: [] }],
    },
    owner,
  );
  assert.equal(saved.status, 201);
  const { orderId } = await saved.json();
  const inbox = async (cookie = owner, query = '') => {
    const response = await request(
      '/api/notifications' + query,
      undefined,
      cookie,
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return response.json();
  };
  assert.equal((await inbox()).unreadCount, 0);
  let revision = 0;
  async function change(action, reason) {
    const response = await request(
      `/api/employee/orders/${orderId}/status`,
      { action, expectedRevision: revision, reason },
      employee,
    );
    assert.equal(response.status, 200);
    revision += 1;
  }
  await change('advance');
  await change('advance');
  await change('advance');
  let result = await inbox();
  assert.deepEqual(
    result.notifications.map((n) => n.stage),
    ['Ready', 'In oven', 'Preparing'],
  );
  assert.equal(result.unreadCount, 3);
  assert.match(result.notifications[0].message, /made, cut and boxed.*pickup/);
  assert.match(result.notifications[1].message, /in the oven/);
  const firstId = result.notifications[0].notificationId;
  // A failed duplicate stage mutation cannot create another update.
  assert.equal(
    (
      await request(
        `/api/employee/orders/${orderId}/status`,
        { action: 'advance', expectedRevision: 0 },
        employee,
      )
    ).status,
    409,
  );
  assert.equal((await inbox()).total, 3);
  assert.equal((await inbox(other)).total, 0);
  assert.equal(
    (await request(`/api/notifications/${firstId}/read`, {}, other)).status,
    404,
  );
  assert.equal(
    (
      await request(
        `/api/notifications/${firstId}/read`,
        {},
        owner,
        'https://other.example',
      )
    ).status,
    403,
  );
  for (let index = 0; index < 2; index++)
    assert.equal(
      (await request(`/api/notifications/${firstId}/read`, {}, owner)).status,
      200,
    );
  assert.equal((await inbox()).unreadCount, 2);
  // Marking a displayed inbox read must not swallow an update committed afterward.
  await change('advance');
  assert.equal(
    (
      await request(
        '/api/notifications/read-all',
        { throughId: firstId },
        owner,
      )
    ).status,
    200,
  );
  result = await inbox();
  assert.equal(result.unreadCount, 1);
  assert.equal(result.notifications[0].stage, 'Completed');
  await change('recall');
  await change('cancel', 'Private kitchen cancellation note');
  await change('recall');
  result = await inbox();
  assert.equal(result.notifications[0].action, 'recall');
  assert.match(result.notifications[0].title, /Progress corrected/);
  assert.equal(result.notifications[1].stage, 'Cancelled');
  assert.doesNotMatch(
    JSON.stringify(result),
    /Private staff|Private kitchen|employeeId|reason|password|phoneNumber/,
  );
  const beforeCount = result.total;
  database.exec(
    "CREATE TRIGGER fail_notification BEFORE INSERT ON customer_notifications BEGIN SELECT RAISE(ABORT, 'test notification failure'); END",
  );
  assert.throws(
    () =>
      changeStatus(database, employeeId, orderId, {
        action: 'advance',
        expectedRevision: revision,
      }),
    /test notification failure/,
  );
  database.exec('DROP TRIGGER fail_notification');
  assert.equal(readTicket(database, orderId).revision, revision);
  assert.equal((await inbox()).total, beforeCount);
  const staff = saveStaffOrder(database, employeeId, {
    customerName: 'Phone guest',
    phoneNumber: '555-555-0100',
    source: 'Phone',
    serviceType: 'Pickup',
    requestId: 'notification-staff-order-0001',
    items: [{ menuItemId: 1, quantity: 1, toppings: [] }],
  }).order;
  changeStatus(database, employeeId, staff.orderId, {
    action: 'advance',
    expectedRevision: 0,
  });
  assert.equal((await inbox()).total, beforeCount);
  for (let index = 0; index < 22; index++) {
    const ticket = readTicket(database, orderId);
    changeStatus(database, employeeId, orderId, {
      action: ticket.orderStatus === 'Ready' ? 'advance' : 'recall',
      expectedRevision: ticket.revision,
    });
  }
  result = await inbox();
  assert.equal(result.notifications.length, 20);
  assert.equal(result.pages, 2);
  const older = await inbox(owner, '?page=2');
  assert.equal(older.notifications.length, result.total - 20);
  assert.ok(
    older.notifications.every(
      (n) => n.notificationId < result.notifications.at(-1).notificationId,
    ),
  );
  for (const path of [
    '/api/notifications?page=0',
    '/api/notifications?page=abc',
  ])
    assert.equal((await request(path, undefined, owner)).status, 400);
  assert.equal(
    (await request('/api/notifications/read-all', {}, owner)).status,
    400,
  );
  assert.equal(
    (await request('/api/notifications/abc/read', {}, owner)).status,
    400,
  );
  const reopened = openDatabase(path);
  try {
    assert.equal(
      reopened
        .prepare('SELECT COUNT(*) AS count FROM customer_notifications')
        .get().count,
      result.total,
    );
    assert.ok(
      reopened
        .prepare(
          'SELECT read_at FROM customer_notifications WHERE notification_id=?',
        )
        .get(firstId).read_at,
    );
  } finally {
    reopened.close();
  }
  await request('/api/auth/logout', {}, owner);
  assert.equal(
    (await request('/api/notifications', undefined, owner)).status,
    401,
  );
});
