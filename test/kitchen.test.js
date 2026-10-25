import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/database.js';
import { createEmployee } from '../server/employees.js';
import { changeStatus, readTicket, saveStaffOrder } from '../server/kitchen.js';
import { createApp } from '../server/app.js';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const draft = (requestId = 'staff-kitchen-test-0001', menuItemId = 1) => ({
  customerName: 'Kitchen Test',
  phoneNumber: '555-555-0100',
  source: 'Phone',
  serviceType: 'Pickup',
  requestId,
  notes: 'Light bake',
  items: [
    {
      menuItemId,
      quantity: 1,
      sauce: 'Light',
      toppings: menuItemId === 1 ? [{ toppingId: 1, quantity: 2 }] : [],
    },
  ],
});

test('kitchen workflow enforces revisions, recall, cancellation and drink routing with audit events', async () => {
  const database = openDatabase(':memory:');
  try {
    const employee = await createEmployee(database, {
      username: 'cook',
      displayName: 'Cook',
      password: 'kitchen test password',
    });
    const saved = saveStaffOrder(database, employee, draft());
    assert.equal(saved.order.totalCents, 700);
    assert.equal(saved.order.source, 'Phone');
    assert.equal(saveStaffOrder(database, employee, draft()).created, false);
    assert.throws(
      () =>
        saveStaffOrder(database, employee, { ...draft(), notes: 'Changed' }),
      { status: 409 },
    );
    let ticket = saved.order;
    const act = (action, reason = '') =>
      (ticket = changeStatus(database, employee, ticket.orderId, {
        action,
        expectedRevision: ticket.revision,
        reason,
      }));
    act('advance');
    assert.equal(ticket.orderStatus, 'Preparing');
    assert.throws(
      () =>
        changeStatus(database, employee, ticket.orderId, {
          action: 'advance',
          expectedRevision: 0,
        }),
      { status: 409 },
    );
    act('advance');
    assert.equal(ticket.orderStatus, 'In oven');
    act('advance');
    act('advance');
    assert.equal(ticket.orderStatus, 'Completed');
    act('recall');
    assert.equal(ticket.orderStatus, 'Ready');
    assert.throws(() => act('cancel'), { status: 400 });
    act('cancel', 'Customer requested cancellation');
    assert.equal(ticket.orderStatus, 'Cancelled');
    assert.throws(() => act('advance'), { status: 400 });
    act('recall');
    assert.equal(ticket.orderStatus, 'Ready');
    assert.equal(
      database
        .prepare(
          'SELECT COUNT(*) AS count FROM order_events WHERE order_id = ?',
        )
        .get(ticket.orderId).count,
      ticket.revision + 1,
    );
    assert.equal(readTicket(database, ticket.orderId).notes, 'Light bake');
    const drinkId = database
      .prepare(
        "SELECT menuItemID AS id FROM MenuItems WHERE category = 'Drink' LIMIT 1",
      )
      .get().id;
    const drinkDraft = draft('staff-kitchen-drink-0001', drinkId);
    delete drinkDraft.items[0].sauce;
    ticket = saveStaffOrder(database, employee, {
      ...drinkDraft,
      serviceType: 'Dine-in',
      phoneNumber: '',
      tableName: '12',
    }).order;
    act('advance');
    act('advance');
    assert.equal(ticket.orderStatus, 'Ready');
    act('recall');
    assert.equal(ticket.orderStatus, 'Preparing');
    const before = database
      .prepare('SELECT COUNT(*) AS count FROM Orders')
      .get().count;
    assert.throws(
      () =>
        saveStaffOrder(database, employee, {
          ...draft('invalid-staff-order-0001'),
          items: [{ menuItemId: -1 }],
        }),
      { status: 400 },
    );
    assert.equal(
      database.prepare('SELECT COUNT(*) AS count FROM Orders').get().count,
      before,
    );
  } finally {
    database.close();
  }
});

test('kitchen HTTP APIs enforce employee isolation, origin, paging, search and concurrent revisions', async (context) => {
  const database = openDatabase(':memory:');
  await createEmployee(database, {
    username: 'http.cook',
    displayName: 'HTTP Cook',
    password: 'kitchen password',
  });
  const server = createApp(database).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    database.close();
  });
  const request = (path, body, cookie, from = origin) =>
    fetch(origin + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Origin: from,
        'Content-Type': 'application/json',
        Cookie: cookie || '',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  assert.equal((await request('/api/employee/kitchen')).status, 401);
  assert.equal((await request('/api/employee/orders', draft())).status, 401);
  const customer = await request('/api/auth/register', {
    firstName: 'Customer',
    lastName: 'Only',
    email: 'kitchen.customer@example.com',
    password: 'customer password',
  });
  const customerCookie = customer.headers.get('set-cookie').split(';')[0];
  assert.equal(
    (await request('/api/employee/kitchen', undefined, customerCookie)).status,
    401,
  );
  const login = () =>
    request('/api/employee/auth/login', {
      username: 'http.cook',
      password: 'kitchen password',
    });
  const cookieA = (await login()).headers.get('set-cookie').split(';')[0];
  const cookieB = (await login()).headers.get('set-cookie').split(';')[0];
  assert.equal(
    (
      await request(
        '/api/employee/orders',
        draft(),
        cookieA,
        'https://other.example',
      )
    ).status,
    403,
  );
  let saved = await request('/api/employee/orders', draft(), cookieA);
  assert.equal(saved.status, 201);
  const ticket = await saved.json();
  saved = await request('/api/employee/orders', draft(), cookieA);
  assert.equal(saved.status, 200);
  const submissions = await request(
    `/api/employee/orders/submissions/${draft().requestId}`,
    undefined,
    cookieA,
  );
  assert.equal((await submissions.json()).order.orderId, ticket.orderId);
  const actions = await Promise.all(
    [cookieA, cookieB].map((cookie) =>
      request(
        `/api/employee/orders/${ticket.orderId}/status`,
        { action: 'advance', expectedRevision: 0 },
        cookie,
      ),
    ),
  );
  assert.deepEqual(actions.map((result) => result.status).sort(), [200, 409]);
  const employeeId = database
    .prepare(
      "SELECT employee_id AS id FROM employees WHERE username = 'http.cook'",
    )
    .get().id;
  for (let index = 0; index < 51; index++)
    saveStaffOrder(database, employeeId, {
      ...draft(`pagination-kitchen-${String(index).padStart(4, '0')}`),
      customerName: `Paging ${index}`,
    });
  const page = await (
    await request(
      '/api/employee/kitchen?status=Pending&page=2',
      undefined,
      cookieA,
    )
  ).json();
  assert.equal(page.orders.length, 1);
  assert.equal(page.total, 51);
  assert.equal(page.pages, 2);
  const search = await (
    await request(
      '/api/employee/kitchen?status=Pending&search=Paging%2050',
      undefined,
      cookieA,
    )
  ).json();
  assert.equal(search.total, 1);
  assert.equal(search.orders[0].customerName, 'Paging 50');
  assert.equal(
    (await request('/api/employee/kitchen?status=invalid', undefined, cookieA))
      .status,
    400,
  );
  const legacy = await (
    await request('/api/employee/orders', undefined, cookieA)
  ).json();
  assert.ok(Array.isArray(legacy));
  database
    .prepare('UPDATE employees SET is_active = 0 WHERE employee_id = ?')
    .run(employeeId);
  assert.equal(
    (await request('/api/employee/kitchen', undefined, cookieA)).status,
    401,
  );
});

test('migration imports existing orders and kitchen history persists across database restarts', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'luigis-kitchen-'));
  const path = join(directory, 'persist.db');
  let database;
  try {
    database = new DatabaseSync(path);
    database.exec(
      readFileSync(new URL('../Database/schema.sql', import.meta.url), 'utf8'),
    );
    database.exec(
      readFileSync(new URL('../Database/seed.sql', import.meta.url), 'utf8'),
    );
    database.exec(
      'CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY)',
    );
    for (const [index, name] of [
      '001-customer-sessions.sql',
      '002-pizza-preferences.sql',
      '003-employees.sql',
    ].entries()) {
      database.exec(
        readFileSync(
          new URL(`../Database/migrations/${name}`, import.meta.url),
          'utf8',
        ),
      );
      database
        .prepare('INSERT INTO schema_migrations VALUES (?)')
        .run(index + 1);
    }
    database
      .prepare(
        'INSERT INTO Orders(customerName, phoneNumber, totalCents) VALUES (?, ?, ?)',
      )
      .run('Preserved order', '5555550100', 500);
    database.close();
    database = openDatabase(path);
    const imported = readTicket(database, 1);
    assert.equal(imported.customerName, 'Preserved order');
    assert.equal(imported.revision, 0);
    const employee = await createEmployee(database, {
      username: 'persistent',
      displayName: 'Persistent',
      password: 'persistent password',
    });
    const saved = saveStaffOrder(database, employee, draft()).order;
    changeStatus(database, employee, saved.orderId, {
      action: 'advance',
      expectedRevision: 0,
    });
    database.close();
    database = openDatabase(path);
    assert.equal(readTicket(database, saved.orderId).orderStatus, 'Preparing');
    assert.equal(readTicket(database, saved.orderId).revision, 1);
    assert.equal(
      database
        .prepare(
          'SELECT COUNT(*) AS count FROM order_events WHERE order_id = ?',
        )
        .get(saved.orderId).count,
      2,
    );
  } finally {
    database?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('queue timeout partitions before paging and sorting without changing order status', async (context) => {
  const database = openDatabase(':memory:');
  const employeeId = await createEmployee(database, {
    username: 'queue.cook',
    displayName: 'Queue Cook',
    password: 'queue test password',
  });
  const server = createApp(database).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    database.close();
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(`${origin}/api/employee/auth/login`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'queue.cook',
      password: 'queue test password',
    }),
  });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const query = (params) =>
    fetch(`${origin}/api/employee/kitchen?${params}`, {
      headers: { Cookie: cookie },
    });
  const stale = [];
  for (let index = 0; index < 52; index++) {
    const ticket = saveStaffOrder(
      database,
      employeeId,
      draft(`stale-queue-order-${index}`),
    ).order;
    database
      .prepare(
        "UPDATE Orders SET orderDate = datetime('now', '-120 minutes') WHERE orderID = ?",
      )
      .run(ticket.orderId);
    stale.push(ticket.orderId);
  }
  const fresh = [0, 1, 2].map(
    (index) =>
      saveStaffOrder(database, employeeId, draft(`fresh-queue-order-${index}`))
        .order.orderId,
  );
  const active = await (
    await query('queue=active&timeoutMinutes=60&sort=oldest')
  ).json();
  assert.deepEqual(
    active.orders.map((ticket) => ticket.orderId),
    fresh,
  );
  assert.equal(active.total, 3);
  assert.equal(active.counts.Pending, 3);
  assert.equal(active.timedOutCount, 52);
  const reverse = await (await query('queue=active&sort=newest')).json();
  assert.deepEqual(
    reverse.orders.map((ticket) => ticket.orderId),
    [...fresh].reverse(),
  );
  const expired = await (
    await query('queue=timed-out&page=2&sort=newest')
  ).json();
  assert.deepEqual(
    expired.orders.map((ticket) => ticket.orderId),
    stale.slice(0, 2).reverse(),
  );
  assert.equal(expired.total, 52);
  assert.equal(expired.counts.Pending, 52);
  assert.equal(expired.pages, 2);
  const extended = await (
    await query('queue=active&timeoutMinutes=180')
  ).json();
  assert.equal(extended.total, 55);
  assert.equal(extended.timedOutCount, 0);
  // A ticket crossing the cutoff moves on the next poll, without a state mutation.
  database
    .prepare(
      "UPDATE Orders SET orderDate = datetime('now', '-120 minutes') WHERE orderID = ?",
    )
    .run(fresh[0]);
  const after = await (await query('queue=active')).json();
  assert.equal(after.total, 2);
  assert.equal(after.timedOutCount, 53);
  assert.equal(readTicket(database, fresh[0]).orderStatus, 'Pending');
  const advanced = changeStatus(database, employeeId, stale[0], {
    action: 'advance',
    expectedRevision: 0,
  });
  assert.equal(advanced.orderStatus, 'Preparing');
  const preparing = await (
    await query('queue=timed-out&status=Preparing')
  ).json();
  assert.equal(preparing.orders[0].orderId, stale[0]);
  for (const params of [
    'queue=bad',
    'sort=bad',
    'timeoutMinutes=0',
    'timeoutMinutes=1.5',
    'timeoutMinutes=1441',
  ]) {
    assert.equal((await query(params)).status, 400);
  }
});
