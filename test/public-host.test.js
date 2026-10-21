import test from 'node:test';
import assert from 'node:assert/strict';
import { hostedEntryHtml, publicHostOrigin } from '../scripts/public-host.js';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { repositoryPath } from '../server/config.js';
import { join } from 'node:path';

test('public backend routing requires a clean public HTTPS origin', () => {
  assert.equal(publicHostOrigin(), '');
  assert.equal(
    publicHostOrigin('https://orders.example.com/'),
    'https://orders.example.com',
  );
  for (const value of [
    'http://orders.example.com',
    'https://localhost',
    'https://127.0.0.1',
    'https://shingenn5.github.io',
    'https://orders.example.com/path',
    'https://user:password@orders.example.com',
    'https://orders.example.com/?next=evil',
    'https://orders.example.com/#x',
  ])
    assert.throws(() => publicHostOrigin(value));
});

test('hosted Pages entries send login, kitchen and checkout to the same full app', () => {
  for (const page of [
    'index.html',
    'login.html',
    'order.html',
    'employee-login.html',
    'employee.html',
  ]) {
    const html = hostedEntryHtml('https://orders.example.com', page);
    assert.ok(html.includes(`href="https://orders.example.com/${page}"`));
    assert.ok(html.includes('id="hostedAppLink"'));
    assert.ok(html.includes('open-hosted-app.js'));
    assert.ok(!html.includes('STATIC_PREVIEW'));
  }
});

test('configured Pages build publishes full-app entry points including the protected kitchen route', () => {
  const environment = {
    ...process.env,
    FULL_APP_URL: 'https://orders.example.com',
  };
  try {
    execFileSync(process.execPath, ['scripts/build-pages.js'], {
      cwd: repositoryPath,
      env: environment,
    });
    for (const page of [
      'index.html',
      'login.html',
      'order.html',
      'employee-login.html',
      'employee.html',
    ]) {
      assert.ok(
        readFileSync(join(repositoryPath, '.pages', page), 'utf8').includes(
          `https://orders.example.com/${page}`,
        ),
      );
    }
    assert.equal(
      existsSync(join(repositoryPath, '.pages', 'server.js')),
      false,
    );
    assert.equal(existsSync(join(repositoryPath, '.pages', 'Database')), false);
  } finally {
    delete environment.FULL_APP_URL;
    execFileSync(process.execPath, ['scripts/build-pages.js'], {
      cwd: repositoryPath,
      env: environment,
    });
  }
});
