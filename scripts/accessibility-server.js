import { createApp } from '../server/app.js';
import { openDatabase } from '../server/database.js';
import { createEmployee } from '../server/employees.js';
import { TEST_EMPLOYEE } from '../browser-tests/employee-fixture.js';

// Accessibility tests use an isolated database and never change local customer data.
delete process.env.APP_ORIGIN;
const database = openDatabase(':memory:');
await createEmployee(database, TEST_EMPLOYEE);
createApp(database).listen(3100, '127.0.0.1');
