import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { openDatabase } from '../server/database.js';
import { priceOrder } from '../server/orders.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function startApp(context) {
  const database = openDatabase(':memory:');
  const server = createApp(database).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    database.close();
  });
  async function request(path, body, cookie, requestOrigin = origin) {
    return fetch(`${origin}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: requestOrigin,
        Cookie: cookie || '',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  return { database, request };
}

const account = {
  firstName: 'Test',
  lastName: 'Customer',
  email: 'test@example.com',
  password: 'a long password',
};

test('registration, case-insensitive login, session rotation and logout', async (context) => {
  const { database, request } = await startApp(context);
  const registered = await request('/api/auth/register', account);
  assert.equal(registered.status, 201);
  const cookie = registered.headers.get('set-cookie').split(';')[0];
  assert.match(registered.headers.get('set-cookie'), /HttpOnly/);
  assert.match(registered.headers.get('set-cookie'), /SameSite=Strict/);
  assert.notEqual(
    database.prepare('SELECT passwordHash FROM Customer').get().passwordHash,
    account.password,
  );
  assert.equal(
    (await (await request('/api/auth/session', undefined, cookie)).json())
      .customer.email,
    account.email,
  );
  assert.equal(
    (
      await request('/api/auth/register', {
        ...account,
        email: 'TEST@example.com',
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request('/api/auth/login', {
        ...account,
        password: 'wrong password',
      })
    ).status,
    401,
  );
  const loggedIn = await request(
    '/api/auth/login',
    { ...account, email: ' TEST@example.com ' },
    cookie,
  );
  assert.equal(loggedIn.status, 200);
  assert.equal(
    (await (await request('/api/auth/session', undefined, cookie)).json())
      .customer,
    null,
  );
  const newCookie = loggedIn.headers.get('set-cookie').split(';')[0];
  await request('/api/auth/logout', {}, newCookie);
  assert.equal(
    (await (await request('/api/auth/session', undefined, newCookie)).json())
      .customer,
    null,
  );
});

test('rejects cross-site writes, invalid accounts, expired sessions and private files', async (context) => {
  const { database, request } = await startApp(context);
  assert.equal(
    (await request('/api/auth/register', account, '', 'https://other.example'))
      .status,
    403,
  );
  assert.equal(
    (await request('/api/auth/register', { ...account, firstName: '' })).status,
    400,
  );
  const registered = await request('/api/auth/register', account);
  const cookie = registered.headers.get('set-cookie').split(';')[0];
  database.exec('UPDATE customer_sessions SET expires_at = 0');
  assert.equal(
    (await (await request('/api/auth/session', undefined, cookie)).json())
      .customer,
    null,
  );
  for (const path of [
    '/Database/luigis_pizzeria.db',
    '/server.js',
    '/.env',
    '/package.json',
  ]) {
    assert.equal((await request(path)).status, 404);
  }
  assert.equal((await (await request('/api/menu')).json()).length, 15);
});

test('limits repeated authentication attempts', async (context) => {
  const { request } = await startApp(context);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    assert.equal((await request('/api/auth/login', {})).status, 401);
  }
  assert.equal((await request('/api/auth/login', {})).status, 429);
});

test('size-specific topping portions and quantities use authoritative prices', () => {
  const database = openDatabase(':memory:');
  try {
    const [small, medium, large] = priceOrder(
      database,
      [1, 2, 3].map((menuItemId) => ({
        menuItemId,
        quantity: 2,
        toppings: [{ toppingId: 1, quantity: 2 }],
        unitPriceCents: 1,
      })),
    );
    assert.deepEqual(
      [small.lineTotalCents, medium.lineTotalCents, large.lineTotalCents],
      [1400, 2200, 3000],
    );
    for (const item of [
      { menuItemId: 999, quantity: 1, toppings: [] },
      { menuItemId: 1, quantity: -1, toppings: [] },
      { menuItemId: 1, quantity: 1.5, toppings: [] },
      { menuItemId: 4, quantity: 1, toppings: [{ toppingId: 1, quantity: 1 }] },
      {
        menuItemId: 1,
        quantity: 1,
        toppings: [{ toppingId: 1, quantity: 11 }],
      },
    ])
      assert.throws(() => priceOrder(database, [item]), { status: 400 });
  } finally {
    database.close();
  }
});

test('orders require authentication, save all lines, isolate customers and deduplicate retries', async (context) => {
  const { database, request } = await startApp(context);
  const body = {
    customerName: 'Test Customer',
    phoneNumber: '555-555-0100',
    serviceType: 'Pickup',
    requestId: 'test-request-00001',
    items: [
      { menuItemId: 2, quantity: 2, toppings: [{ toppingId: 1, quantity: 2 }] },
    ],
    totalCents: 1,
  };
  assert.equal((await request('/api/orders', body)).status, 401);
  const registered = await request('/api/auth/register', account);
  const cookie = registered.headers.get('set-cookie').split(';')[0];
  const saved = await request('/api/orders', body, cookie);
  assert.equal(saved.status, 201);
  const result = await saved.json();
  assert.equal(result.totalCents, 2200);
  const retried = await request('/api/orders', body, cookie);
  assert.equal((await retried.json()).orderId, result.orderId);
  assert.equal(
    database.prepare('SELECT COUNT(*) AS count FROM Orders').get().count,
    1,
  );
  const history = await (
    await request('/api/orders', undefined, cookie)
  ).json();
  assert.equal(history[0].items[0].toppings[0].quantity, 2);
  assert.equal(history[0].serviceType, 'Pickup');
  assert.equal(
    (
      await request(
        '/api/orders',
        { ...body, requestId: 'test-request-00002', items: [] },
        cookie,
      )
    ).status,
    400,
  );
  const second = await request('/api/auth/register', {
    ...account,
    email: 'second@example.com',
  });
  const secondCookie = second.headers.get('set-cookie').split(';')[0];
  assert.deepEqual(
    await (await request('/api/orders', undefined, secondCookie)).json(),
    [],
  );
});

test('a failed line insert rolls back the entire order', async (context) => {
  const { database, request } = await startApp(context);
  const registered = await request('/api/auth/register', account);
  const cookie = registered.headers.get('set-cookie').split(';')[0];
  database.exec(`CREATE TRIGGER fail_topping BEFORE INSERT ON OrderItemToppings
    BEGIN SELECT RAISE(ABORT, 'Simulated storage failure'); END;`);
  const response = await request(
    '/api/orders',
    {
      customerName: 'Test Customer',
      phoneNumber: '555-555-0100',
      serviceType: 'Dine-in',
      requestId: 'rollback-request-0001',
      items: [
        {
          menuItemId: 1,
          quantity: 1,
          toppings: [{ toppingId: 1, quantity: 1 }],
        },
      ],
    },
    cookie,
  );
  assert.equal(response.status, 500);
  assert.equal(
    (await response.json()).error,
    'Something went wrong. Please try again.',
  );
  for (const table of [
    'Orders',
    'OrderItems',
    'OrderItemToppings',
    'order_item_preferences',
    'order_details',
  ]) {
    assert.equal(
      database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count,
      0,
    );
  }
});

test('SQLite data and migration version survive closing and reopening', () => {
  const directory = mkdtempSync(join(tmpdir(), 'luigis-test-'));
  const databasePath = join(directory, 'test.db');
  let database;
  try {
    database = openDatabase(databasePath);
    database
      .prepare(
        'INSERT INTO Customer (firstName, lastName, email, passwordHash) VALUES (?, ?, ?, ?)',
      )
      .run('Persisted', 'Customer', 'persisted@example.com', 'test-hash');
    database.close();
    database = openDatabase(databasePath);
    assert.equal(
      database.prepare('SELECT firstName FROM Customer').get().firstName,
      'Persisted',
    );
    assert.equal(
      database.prepare('SELECT COUNT(*) AS count FROM MenuItems').get().count,
      15,
    );
    assert.equal(
      database.prepare('SELECT version FROM schema_migrations').get().version,
      1,
    );
  } finally {
    database?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('whole-pizza toppings and preferences agree between preview and server', async () => {
  const { describeItem } = await import('../js/cart.js');
  const { getMenu, getToppings } = await import('../server/database.js');
  const database = openDatabase(':memory:');
  try {
    const menu = getMenu(database);
    const toppings = getToppings(database);
    for (const [quantity, expectedCents] of [
      [1, 600],
      [2, 700],
    ]) {
      const item = {
        menuItemId: 1,
        quantity: 1,
        toppings: [{ toppingId: 1, quantity }],
        sauce: 'Light',
        cheese: 'None',
      };
      assert.equal(
        priceOrder(database, [item])[0].lineTotalCents,
        expectedCents,
      );
      assert.equal(
        describeItem(item, menu, toppings).lineTotalCents,
        expectedCents,
      );
      assert.match(
        describeItem(item, menu, toppings).toppingNames,
        /Light sauce, No cheese/,
      );
    }
    const base = { menuItemId: 1, quantity: 1, toppings: [] };
    assert.equal(priceOrder(database, [base])[0].sauce, 'Regular');
    for (const item of [
      { ...base, sauce: 'Invalid' },
      { ...base, cheese: 'Extra' },
      { ...base, toppings: [{ toppingId: 1, quantity: 3 }] },
      { ...base, menuItemId: 4, sauce: 'Light' },
    ]) {
      assert.throws(() => priceOrder(database, [item]), { status: 400 });
      assert.throws(() => describeItem(item, menu, toppings));
    }
  } finally {
    database.close();
  }
});

test('pizza preferences survive order save and appear in history', async (context) => {
  const { request } = await startApp(context);
  const registered = await request('/api/auth/register', account);
  const cookie = registered.headers.get('set-cookie').split(';')[0];
  const saved = await request(
    '/api/orders',
    {
      customerName: 'Test Customer',
      phoneNumber: '555-555-0100',
      serviceType: 'Pickup',
      requestId: 'preferences-request-0001',
      items: [
        {
          menuItemId: 1,
          quantity: 1,
          sauce: 'Light',
          cheese: 'None',
          toppings: [{ toppingId: 1, quantity: 2 }],
        },
      ],
    },
    cookie,
  );
  assert.equal(saved.status, 201);
  assert.equal((await saved.json()).totalCents, 700);
  const history = await (
    await request('/api/orders', undefined, cookie)
  ).json();
  assert.equal(history[0].items[0].sauce, 'Light');
  assert.equal(history[0].items[0].cheese, 'None');
  assert.equal(history[0].items[0].toppings[0].quantity, 2);
});
