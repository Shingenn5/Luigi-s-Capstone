import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { openDatabase } from '../server/database.js';
import { createEmployee } from '../server/employees.js';
import { verifyPassword } from '../server/passwords.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const account = {
  username: 'new.staff',
  displayName: 'New Staff',
  password: 'a private staff password',
};

test('role migration preserves existing employees and persists new admins after reopening', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'luigis-roles-'));
  const path = join(directory, 'roles.db');
  let database;
  try {
    database = openDatabase(path);
    await createEmployee(database, account);
    database.exec(
      'ALTER TABLE employees DROP COLUMN role; DELETE FROM schema_migrations WHERE version = 5;',
    );
    database.close();
    database = openDatabase(path);
    assert.equal(
      database
        .prepare('SELECT role FROM employees WHERE username = ?')
        .get(account.username).role,
      'employee',
    );
    await createEmployee(database, {
      ...account,
      username: 'saved.admin',
      role: 'admin',
    });
    database.close();
    database = openDatabase(path);
    const admin = database
      .prepare('SELECT role, password_hash FROM employees WHERE username = ?')
      .get('saved.admin');
    assert.equal(admin.role, 'admin');
    assert.equal(
      await verifyPassword(account.password, admin.password_hash),
      true,
    );
  } finally {
    database?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('staff creation requires an active admin and creates usable, hashed accounts', async (context) => {
  const database = openDatabase(':memory:');
  const server = createApp(database).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    database.close();
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = (path, body, cookie = '', requestOrigin = origin) =>
    fetch(`${origin}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: requestOrigin,
        Cookie: cookie,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const login = async (credentials) => {
    const response = await request('/api/employee/auth/login', credentials);
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie').split(';')[0];
  };
  await createEmployee(database, { ...account, username: 'ordinary' });
  const adminId = await createEmployee(database, {
    ...account,
    username: 'owner',
    role: 'admin',
  });
  const staffCookie = await login({ ...account, username: 'ordinary' });
  const adminCookie = await login({ ...account, username: 'owner' });
  assert.equal((await request('/api/employee/accounts', account)).status, 401);
  assert.equal(
    (
      await request(
        '/api/employee/accounts',
        { ...account, role: 'admin' },
        staffCookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        '/api/employee/accounts',
        account,
        adminCookie,
        'https://other.example',
      )
    ).status,
    403,
  );
  for (const invalid of [
    { role: 'owner' },
    { role: null },
    { password: 'short' },
    { displayName: ' ' },
    { username: 'bad user' },
  ]) {
    assert.equal(
      (
        await request(
          '/api/employee/accounts',
          { ...account, ...invalid },
          adminCookie,
        )
      ).status,
      400,
    );
  }
  const created = await request(
    '/api/employee/accounts',
    { ...account, username: ' NEW.Staff ' },
    adminCookie,
  );
  assert.equal(created.status, 201);
  const { employee } = await created.json();
  assert.equal(employee.username, 'new.staff');
  assert.equal(employee.role, 'employee');
  assert.deepEqual(Object.keys(employee).sort(), [
    'displayName',
    'employeeId',
    'role',
    'username',
  ]);
  const saved = database
    .prepare('SELECT * FROM employees WHERE employee_id = ?')
    .get(employee.employeeId);
  assert.notEqual(saved.password_hash, account.password);
  assert.equal(
    await verifyPassword(account.password, saved.password_hash),
    true,
  );
  const newCookie = await login(account);
  const session = await (
    await request('/api/employee/auth/session', undefined, newCookie)
  ).json();
  assert.equal(session.employee.role, 'employee');
  assert.equal(
    (
      await request(
        '/api/employee/accounts',
        { ...account, username: 'NEW.STAFF' },
        adminCookie,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        '/api/employee/accounts',
        { ...account, username: 'second.admin', role: 'admin' },
        adminCookie,
      )
    ).status,
    201,
  );
  const secondAdmin = await login({ ...account, username: 'second.admin' });
  assert.equal(
    (
      await request(
        '/api/employee/accounts',
        { ...account, username: 'from.second' },
        secondAdmin,
      )
    ).status,
    201,
  );
  database
    .prepare("UPDATE employees SET role = 'employee' WHERE employee_id = ?")
    .run(adminId);
  assert.equal(
    (
      await request(
        '/api/employee/accounts',
        { ...account, username: 'blocked' },
        adminCookie,
      )
    ).status,
    403,
  );
  database
    .prepare('UPDATE employees SET is_active = 0 WHERE employee_id = ?')
    .run(adminId);
  assert.equal(
    (
      await request(
        '/api/employee/accounts',
        { ...account, username: 'blocked' },
        adminCookie,
      )
    ).status,
    401,
  );
  assert.equal(
    database
      .prepare('SELECT employee_id FROM employees WHERE username = ?')
      .get('blocked'),
    undefined,
  );
  // Revocation during asynchronous hashing must also prevent the insert.
  database
    .prepare(
      "UPDATE employees SET is_active = 1, role = 'admin' WHERE employee_id = ?",
    )
    .run(adminId);
  const pending = createEmployee(
    database,
    { ...account, username: 'race.blocked' },
    { adminId },
  );
  database
    .prepare('UPDATE employees SET is_active = 0 WHERE employee_id = ?')
    .run(adminId);
  await assert.rejects(pending, { status: 403 });
});
