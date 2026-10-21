import { createApp } from '../server/app.js';
import { openDatabase } from '../server/database.js';
import { createEmployee } from '../server/employees.js';
import { TEST_EMPLOYEE } from '../browser-tests/employee-fixture.js';
import express from 'express';
import { fileURLToPath } from 'node:url';
import './build-pages.js';

// Accessibility tests use an isolated database and never change local customer data.
delete process.env.APP_ORIGIN;
const database = openDatabase(':memory:');
await createEmployee(database, TEST_EMPLOYEE);
const app = createApp(database);
app.use(
  '/Luigi-s-Capstone',
  express.static(fileURLToPath(new URL('../.pages/', import.meta.url))),
);
app.listen(Number(process.env.TEST_PORT || 3100), '127.0.0.1');
