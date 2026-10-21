import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/database.js';
import { ensureDemoEmployee } from '../server/demo-employee.js';
import { verifyPassword } from '../server/passwords.js';

test('demo admin is hashed and existing credentials or disabled status are preserved', async () => {
  const database = openDatabase(':memory:');
  try {
    assert.equal(await ensureDemoEmployee(database), true);
    const employee = database
      .prepare('SELECT * FROM employees WHERE username = ?')
      .get('admin');
    assert.equal(
      await verifyPassword('adminadmin', employee.password_hash),
      true,
    );
    assert.notEqual(employee.password_hash, 'adminadmin');
    database
      .prepare(
        'UPDATE employees SET password_hash = ?, is_active = 0 WHERE username = ?',
      )
      .run('changed-password-hash', 'admin');
    assert.equal(await ensureDemoEmployee(database), false);
    const preserved = database
      .prepare('SELECT * FROM employees WHERE username = ?')
      .get('admin');
    assert.equal(preserved.password_hash, 'changed-password-hash');
    assert.equal(preserved.is_active, 0);
    assert.equal(
      database.prepare('SELECT COUNT(*) AS count FROM employees').get().count,
      1,
    );
  } finally {
    database.close();
  }
});
