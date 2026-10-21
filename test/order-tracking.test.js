import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../server/database.js';
import { createApp } from '../server/app.js';
import { createEmployee } from '../server/employees.js';
import { readOrderTracking } from '../server/order-tracking.js';

test('customer tracking follows employee actions, isolates customers, corrects recalls and survives reopening', async (context) => {
  const folder = mkdtempSync(join(tmpdir(), 'luigi-tracking-'));
  const path = join(folder, 'tracking.db');
  const database = openDatabase(path);
  await createEmployee(database, {
    username: 'tracker',
    displayName: 'Kitchen tracker',
    password: 'tracking password',
  });
  const server = createApp(database).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    database.close();
    rmSync(folder, { recursive: true, force: true });
  });
  const request = (path, body, cookie = '') =>
    fetch(origin + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const register = async (email) => {
    const response = await request('/api/auth/register', {
      firstName: 'Track',
      lastName: 'Customer',
      email,
      password: 'customer password',
    });
    assert.equal(response.status, 201);
    return response.headers.get('set-cookie').split(';')[0];
  };
  const customer = await register('tracking@example.com');
  const other = await register('other.tracking@example.com');
  const login = await request('/api/employee/auth/login', {
    username: 'tracker',
    password: 'tracking password',
  });
  const employee = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/api/orders')).status, 401);
  const response = await request(
    '/api/orders',
    {
      customerName: 'Track Customer',
      phoneNumber: '555-555-0100',
      serviceType: 'Pickup',
      requestId: 'customer-tracking-order-001',
      items: [{ menuItemId: 1, quantity: 1, toppings: [] }],
    },
    customer,
  );
  assert.equal(response.status, 201);
  const { orderId } = await response.json();
  const read = async () => {
    const response = await request('/api/orders', undefined, customer);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return (await response.json())[0];
  };
  let order = await read();
  const createdAt = order.tracking.createdAt;
  assert.deepEqual(order.tracking.milestones, [
    { stage: 'Pending', occurredAt: createdAt },
  ]);
  assert.deepEqual(
    await (await request('/api/orders', undefined, other)).json(),
    [],
  );
  const change = async (action, reason) => {
    const response = await request(
      `/api/employee/orders/${orderId}/status`,
      { action, expectedRevision: order.tracking.revision, reason },
      employee,
    );
    assert.equal(response.status, 200);
    order = await read();
    assert.equal(order.tracking.createdAt, createdAt);
    assert.ok(order.tracking.serverTime >= order.tracking.enteredAt);
  };
  assert.equal(
    (
      await request(
        `/api/employee/orders/${orderId}/status`,
        { action: 'advance', expectedRevision: 0 },
        customer,
      )
    ).status,
    401,
  );
  await change('advance');
  await change('advance');
  assert.equal(order.orderStatus, 'In oven');
  const ovenAt = order.tracking.milestones.at(-1).occurredAt;
  await change('advance');
  assert.equal(order.orderStatus, 'Ready');
  assert.deepEqual(
    order.tracking.milestones.map((entry) => entry.stage),
    ['Pending', 'Preparing', 'In oven', 'Ready'],
  );
  assert.ok(order.tracking.milestones.at(-1).occurredAt >= ovenAt);
  await change('recall');
  assert.equal(order.orderStatus, 'In oven');
  assert.equal(
    order.tracking.milestones.some((entry) => entry.stage === 'Ready'),
    false,
  );
  await change('cancel', 'Private employee cancellation details');
  assert.equal(order.orderStatus, 'Cancelled');
  assert.equal(JSON.stringify(order).includes('Private employee'), false);
  assert.deepEqual(Object.keys(order.tracking).sort(), [
    'createdAt',
    'enteredAt',
    'milestones',
    'revision',
    'serverTime',
  ]);
  await change('recall');
  await change('advance');
  await change('advance');
  assert.equal(order.orderStatus, 'Completed');
  // A second connection models a new server process reading the persisted SQL events.
  const reopened = openDatabase(path);
  try {
    const tracking = readOrderTracking(reopened, orderId);
    assert.equal(tracking.revision, order.tracking.revision);
    assert.equal(tracking.enteredAt, order.tracking.enteredAt);
    assert.deepEqual(tracking.milestones, order.tracking.milestones);
  } finally {
    reopened.close();
  }
});
