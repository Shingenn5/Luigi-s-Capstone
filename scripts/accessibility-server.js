import { createApp } from '../server/app.js';
import { openDatabase } from '../server/database.js';

// Accessibility tests use an isolated database and never change local customer data.
delete process.env.APP_ORIGIN;
const database = openDatabase(':memory:');
createApp(database).listen(3100, '127.0.0.1');
