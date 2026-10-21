import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { stdin, stdout } from 'node:process';
import { openDatabase } from '../server/database.js';
import { createEmployee } from '../server/employees.js';
import { readServerConfig } from '../server/config.js';

let database;
let prompts;
let hideInput = false;
try {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error(
      'Run employee:create in an interactive terminal. Passwords are entered without echo.',
    );
  }
  const output = new Writable({
    write(chunk, _encoding, done) {
      if (!hideInput) stdout.write(chunk);
      done();
    },
  });
  prompts = createInterface({ input: stdin, output, terminal: true });
  const username = await prompts.question('Employee username: ');
  const displayName = await prompts.question('Display name: ');
  stdout.write('Password (8–128 characters; hidden): ');
  hideInput = true;
  const password = await prompts.question('');
  stdout.write('\nConfirm password (hidden): ');
  const confirmation = await prompts.question('');
  hideInput = false;
  stdout.write('\n');
  if (password !== confirmation)
    throw new Error('Passwords do not match. No account was created.');
  database = openDatabase(readServerConfig().databasePath);
  await createEmployee(database, { username, displayName, password });
  console.log(
    `Employee ${username.trim().toLowerCase()} created. Sign in at /employee-login.html.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  prompts?.close();
  database?.close();
}
