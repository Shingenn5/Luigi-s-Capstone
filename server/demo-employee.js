import { createEmployee } from './employees.js';

export async function ensureDemoEmployee(database) {
  const existing = database
    .prepare('SELECT employee_id FROM employees WHERE username = ?')
    .get('admin');
  if (existing) return false;
  await createEmployee(database, {
    username: 'admin',
    displayName: 'Demo Admin',
    password: 'adminadmin',
  });
  return true;
}
