import { unzipSync } from 'fflate';
import {
  readFileSync,
  mkdirSync,
  writeFileSync,
  mkdtempSync,
  rmSync,
} from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { repositoryPath } from '../server/config.js';
import { buildDemoArchive } from './package-demo.js';

const smokeRoot = join(repositoryPath, '.demo-smoke');
mkdirSync(smokeRoot, { recursive: true });
const extractionPath = mkdtempSync(join(smokeRoot, 'package-'));
const appPath = join(extractionPath, 'luigis-demo');
const databasePath = join(appPath, 'Database', 'luigis_pizzeria.db');
let child;

async function startDemo() {
  const environment = {
    ...process.env,
    PORT: '0',
    HOST: '127.0.0.1',
    DATABASE_PATH: databasePath,
    SECURE_COOKIES: 'false',
  };
  delete environment.APP_ORIGIN;
  delete environment.TRUST_PROXY;
  return new Promise((resolveStart, reject) => {
    let output = '';
    const timeout = setTimeout(
      () => reject(new Error(`Demo startup timed out. ${output}`)),
      120000,
    );
    child = spawn(
      process.execPath,
      [join(appPath, 'scripts/start-demo.js'), '--port', '0'],
      {
        cwd: extractionPath,
        env: environment,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    function receive(chunk) {
      output += chunk.toString();
      const match = output.match(
        /Luigi's Pizzeria running at (http:\/\/127\.0\.0\.1:\d+)/,
      );
      if (match) {
        clearTimeout(timeout);
        resolveStart(match[1]);
      }
    }
    child.stdout.on('data', receive);
    child.stderr.on('data', receive);
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Demo exited with ${code}. ${output}`));
    });
  });
}

async function stopDemo() {
  if (!child || child.exitCode !== null) return;
  await new Promise((resolveStop) => {
    child.once('exit', resolveStop);
    child.kill('SIGTERM');
  });
}

try {
  const { archivePath } = buildDemoArchive();
  const files = unzipSync(readFileSync(archivePath));
  for (const [name, bytes] of Object.entries(files)) {
    const destination = resolve(extractionPath, name);
    if (!destination.startsWith(extractionPath + sep))
      throw new Error('Invalid package path.');
    mkdirSync(resolve(destination, '..'), { recursive: true });
    writeFileSync(destination, bytes);
  }
  let origin = await startDemo();
  async function request(path, body, cookie) {
    return fetch(`${origin}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        Cookie: cookie || '',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }
  assert.equal((await (await request('/healthz')).json()).status, 'ok');
  assert.equal(
    (
      await request('/api/employee/auth/login', {
        username: 'admin',
        password: 'adminadmin',
      })
    ).status,
    200,
  );
  for (const page of ['/', '/menu.html', '/employee-login.html']) {
    const response = await request(page);
    assert.equal(response.status, 200, `${page} must be included in the demo`);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(await response.text(), /<html/i);
  }
  assert.match(
    await (await request('/js/runtime-config.js')).text(),
    /STATIC_PREVIEW = false/,
  );
  const account = {
    firstName: 'Package',
    lastName: 'Customer',
    email: 'package@example.com',
    password: 'package smoke password',
  };
  const registration = await request('/api/auth/register', account);
  assert.equal(registration.status, 201);
  const cookie = registration.headers.get('set-cookie').split(';')[0];
  const saved = await request(
    '/api/orders',
    {
      customerName: 'Package Customer',
      phoneNumber: '555-555-0100',
      serviceType: 'Pickup',
      requestId: 'portable-package-order-0001',
      items: [
        {
          menuItemId: 1,
          quantity: 1,
          sauce: 'Light',
          toppings: [{ toppingId: 1, quantity: 2 }],
        },
      ],
    },
    cookie,
  );
  assert.equal(saved.status, 201);
  assert.equal((await saved.json()).totalCents, 700);
  await stopDemo();
  const { openDatabase } = await import(
    pathToFileURL(join(appPath, 'server/database.js')).href
  );
  const { createEmployee } = await import(
    pathToFileURL(join(appPath, 'server/employees.js')).href
  );
  const database = openDatabase(databasePath);
  try {
    await createEmployee(database, {
      username: 'package.employee',
      displayName: 'Package Employee',
      password: 'package employee password',
    });
  } finally {
    database.close();
  }
  origin = await startDemo();
  const customerLogin = await request('/api/auth/login', account);
  assert.equal(customerLogin.status, 200);
  const customerCookie = customerLogin.headers.get('set-cookie').split(';')[0];
  const history = await (
    await request('/api/orders', undefined, customerCookie)
  ).json();
  assert.equal(history[0].totalCents, 700);
  assert.equal(history[0].items[0].sauce, 'Light');
  const employeeLogin = await request('/api/employee/auth/login', {
    username: 'package.employee',
    password: 'package employee password',
  });
  assert.equal(employeeLogin.status, 200);
  const employeeCookie = employeeLogin.headers.get('set-cookie').split(';')[0];
  assert.equal(
    (
      await (
        await request('/api/employee/orders', undefined, employeeCookie)
      ).json()
    ).length,
    1,
  );
  console.log(
    'Extracted demo passed: first-run dependency install, customer registration, saved order, restart persistence, employee login, and employee order access.',
  );
} finally {
  await stopDemo();
  if (relative(smokeRoot, extractionPath).startsWith('package-'))
    rmSync(extractionPath, { recursive: true, force: true });
}
