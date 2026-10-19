import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { openDatabase } from '../server/database.js';
import { priceOrder } from '../server/orders.js';
import { createEmployee } from '../server/employees.js';
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

test('employee accounts are provisioned locally with unique usernames and hashed passwords', async () => {
  const database = openDatabase(':memory:');
  try {
    await createEmployee(database, {
      username: 'Staff.One',
      displayName: 'Staff One',
      password: 'employee test password',
    });
    const employee = database.prepare('SELECT * FROM employees').get();
    assert.equal(employee.username, 'staff.one');
    assert.notEqual(employee.password_hash, 'employee test password');
    await assert.rejects(
      createEmployee(database, {
        username: 'STAFF.ONE',
        displayName: 'Other',
        password: 'employee test password',
      }),
      /already exists/,
    );
    await assert.rejects(
      createEmployee(database, {
        username: 'bad username',
        displayName: 'Staff',
        password: 'short',
      }),
      /username/,
    );
  } finally {
    database.close();
  }
});

test('employee login rotates sessions and denies expired or disabled employees', async (context) => {
  const { database, request } = await startApp(context);
  const credentials = {
    username: 'employee',
    password: 'employee test password',
  };
  await createEmployee(database, {
    ...credentials,
    displayName: 'Test Employee',
  });
  assert.equal(
    (
      await request('/api/employee/auth/login', {
        ...credentials,
        password: 'wrong password',
      })
    ).status,
    401,
  );
  const login = await request('/api/employee/auth/login', {
    ...credentials,
    username: ' EMPLOYEE ',
  });
  assert.equal(login.status, 200);
  assert.match(login.headers.get('set-cookie'), /HttpOnly/);
  assert.match(login.headers.get('set-cookie'), /SameSite=Strict/);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal(
    (
      await (
        await request('/api/employee/auth/session', undefined, cookie)
      ).json()
    ).employee.displayName,
    'Test Employee',
  );
  const nextLogin = await request(
    '/api/employee/auth/login',
    credentials,
    cookie,
  );
  assert.equal(
    (
      await (
        await request('/api/employee/auth/session', undefined, cookie)
      ).json()
    ).employee,
    null,
  );
  const newCookie = nextLogin.headers.get('set-cookie').split(';')[0];
  database.exec('UPDATE employee_sessions SET expires_at = 0');
  assert.equal(
    (await request('/api/employee/orders', undefined, newCookie)).status,
    401,
  );
  const activeLogin = await request('/api/employee/auth/login', credentials);
  const activeCookie = activeLogin.headers.get('set-cookie').split(';')[0];
  database.exec('UPDATE employees SET is_active = 0');
  assert.equal(
    (await request('/api/employee/orders', undefined, activeCookie)).status,
    401,
  );
  assert.equal(
    (await request('/api/employee/auth/login', credentials)).status,
    401,
  );
});

test('employee orders are protected from customers and employee logout revokes access', async (context) => {
  const { database, request } = await startApp(context);
  assert.equal((await request('/api/employee/orders')).status, 401);
  assert.equal(
    (await request('/api/employee/auth/register', account)).status,
    404,
  );
  const customerLogin = await request('/api/auth/register', {
    ...account,
    role: 'employee',
  });
  const customerCookie = customerLogin.headers.get('set-cookie').split(';')[0];
  assert.equal(
    (await request('/api/employee/orders', undefined, customerCookie)).status,
    401,
  );
  await request(
    '/api/orders',
    {
      customerName: 'Customer Order',
      phoneNumber: '555-555-0100',
      serviceType: 'Pickup',
      requestId: 'employee-queue-order-0001',
      items: [
        {
          menuItemId: 1,
          quantity: 1,
          sauce: 'Light',
          toppings: [{ toppingId: 1, quantity: 2 }],
        },
      ],
    },
    customerCookie,
  );
  const credentials = {
    username: 'employee',
    password: 'employee test password',
  };
  await createEmployee(database, {
    ...credentials,
    displayName: 'Test Employee',
  });
  const login = await request('/api/employee/auth/login', credentials);
  const employeeCookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal(
    (await request('/api/orders', undefined, employeeCookie)).status,
    401,
  );
  const orders = await (
    await request('/api/employee/orders', undefined, employeeCookie)
  ).json();
  assert.equal(orders.length, 1);
  assert.equal(orders[0].customerName, 'Customer Order');
  assert.equal(orders[0].items[0].sauce, 'Light');
  assert.equal(orders[0].items[0].toppings[0].quantity, 2);
  database.exec("UPDATE Orders SET orderStatus = 'Completed'");
  assert.deepEqual(
    await (
      await request('/api/employee/orders', undefined, employeeCookie)
    ).json(),
    [],
  );
  await request('/api/employee/auth/logout', {}, employeeCookie);
  assert.equal(
    (await request('/api/employee/orders', undefined, employeeCookie)).status,
    401,
  );
  assert.equal(
    (
      await (
        await request('/api/auth/session', undefined, customerCookie)
      ).json()
    ).customer.email,
    account.email,
  );
});

test('employee authentication blocks cross-origin writes and throttles attempts', async (context) => {
  const { request } = await startApp(context);
  assert.equal(
    (await request('/api/employee/auth/login', {}, '', 'https://other.example'))
      .status,
    403,
  );
  for (let attempt = 0; attempt < 20; attempt += 1) {
    assert.equal((await request('/api/employee/auth/login', {})).status, 401);
  }
  const limited = await request('/api/employee/auth/login', {});
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
});
