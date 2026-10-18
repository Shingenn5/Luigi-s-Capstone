import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { openDatabase } from '../server/database.js';

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
