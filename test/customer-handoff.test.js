import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../server/database.js';
import { createApp } from '../server/app.js';
import { createEmployee } from '../server/employees.js';
import { readTicket } from '../server/kitchen.js';

test('customer instructions reach staff, remain private to the account and persist with activity', async (context) => {
  const folder = mkdtempSync(join(tmpdir(), 'luigi-handoff-'));
  const path = join(folder, 'orders.db');
  const database = openDatabase(path);
  await createEmployee(database, {
    username: 'handoff',
    displayName: 'Handoff Employee',
    password: 'handoff test password',
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
    const result = await request('/api/auth/register', {
      firstName: 'Handoff',
      lastName: 'Customer',
      email,
      password: 'customer test password',
    });
    assert.equal(result.status, 201);
    return result.headers.get('set-cookie').split(';')[0];
  };
  const customer = await register('handoff@example.com');
  const otherCustomer = await register('other.handoff@example.com');
  const draft = {
    customerName: 'Handoff Customer',
    phoneNumber: '555-555-0100',
    serviceType: 'Dine-in',
    tableName: '  12  ',
    notes: '  Cut into squares. <b>Not markup</b>  ',
    requestId: 'customer-handoff-order-001',
    items: [{ menuItemId: 1, quantity: 1, toppings: [] }],
  };
  for (const invalid of [
    { tableName: 'a'.repeat(41) },
    { tableName: 12 },
    { serviceType: 'Pickup', tableName: '12' },
    { notes: 'a'.repeat(501) },
    { notes: [] },
  ]) {
    assert.equal(
      (await request('/api/orders', { ...draft, ...invalid }, customer)).status,
      400,
    );
  }
  assert.equal(
    database.prepare('SELECT COUNT(*) AS count FROM Orders').get().count,
    0,
  );
  const saved = await request('/api/orders', draft, customer);
  assert.equal(saved.status, 201);
  const { orderId } = await saved.json();
  assert.equal(
    (await (await request('/api/orders', draft, customer)).json()).orderId,
    orderId,
  );
  assert.equal(
    database.prepare('SELECT COUNT(*) AS count FROM Orders').get().count,
    1,
  );
  const activityPath = `/api/employee/orders/${orderId}/activity`;
  assert.equal((await request(activityPath)).status, 401);
  assert.equal((await request(activityPath, undefined, customer)).status, 401);
  const login = await request('/api/employee/auth/login', {
    username: 'handoff',
    password: 'handoff test password',
  });
  const employee = login.headers.get('set-cookie').split(';')[0];
  const kitchen = await (
    await request('/api/employee/kitchen', undefined, employee)
  ).json();
  assert.equal(kitchen.orders[0].tableName, '12');
  assert.equal(kitchen.orders[0].notes, draft.notes.trim());
  assert.equal(kitchen.orders[0].source, 'Website');
  const advance = await request(
    `/api/employee/orders/${orderId}/status`,
    { action: 'advance', expectedRevision: 0 },
    employee,
  );
  assert.equal(advance.status, 200);
  const eventsResponse = await request(activityPath, undefined, employee);
  assert.equal(eventsResponse.headers.get('cache-control'), 'no-store');
  const events = await eventsResponse.json();
  assert.deepEqual(
    events.map((event) => event.stage),
    ['Pending', 'Preparing'],
  );
  assert.equal(events[1].employeeName, 'Handoff Employee');
  assert.equal(
    (await request('/api/employee/orders/nope/activity', undefined, employee))
      .status,
    400,
  );
  assert.equal(
    (await request('/api/employee/orders/99999/activity', undefined, employee))
      .status,
    404,
  );
  const receipt = (
    await (await request('/api/orders', undefined, customer)).json()
  )[0];
  assert.equal(receipt.tableName, '12');
  assert.equal(receipt.notes, draft.notes.trim());
  assert.equal(JSON.stringify(receipt).includes('Handoff Employee'), false);
  assert.deepEqual(
    await (await request('/api/orders', undefined, otherCustomer)).json(),
    [],
  );
  const reopened = openDatabase(path);
  try {
    const ticket = readTicket(reopened, orderId);
    assert.equal(ticket.tableName, '12');
    assert.equal(ticket.notes, draft.notes.trim());
    assert.equal(ticket.orderStatus, 'Preparing');
  } finally {
    reopened.close();
  }
});

test('customer details migration preserves existing website orders with empty optional fields', () => {
  const folder = mkdtempSync(join(tmpdir(), 'luigi-details-migration-'));
  const path = join(folder, 'migration.db');
  let database;
  try {
    database = openDatabase(path);
    database.exec(`
      ALTER TABLE order_details DROP COLUMN table_name;
      ALTER TABLE order_details DROP COLUMN notes;
      DELETE FROM schema_migrations WHERE version = 6;
      INSERT INTO Customer(firstName, lastName, email, passwordHash) VALUES('Legacy', 'Customer', 'legacy@example.com', 'unused');
      INSERT INTO Orders(customerID, customerName, phoneNumber, totalCents) VALUES(1, 'Legacy Customer', '5555550100', 500);
      INSERT INTO order_details(order_id, request_id, customer_id, service_type) VALUES(1, 'legacy-customer-order', 1, 'Pickup');
    `);
    database.close();
    database = openDatabase(path);
    const ticket = readTicket(database, 1);
    assert.equal(ticket.customerName, 'Legacy Customer');
    assert.equal(ticket.totalCents, 500);
    assert.equal(ticket.tableName, '');
    assert.equal(ticket.notes, '');
    assert.equal(ticket.revision, 0);
  } finally {
    database?.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
