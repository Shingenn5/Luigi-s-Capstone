import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readServerConfig, repositoryPath } from '../server/config.js';

test('demo configuration keeps database paths relative to the application', () => {
  const config = readServerConfig({
    DATABASE_PATH: 'demo-data/test.db',
    PORT: '3001',
  });
  assert.equal(config.databasePath, join(repositoryPath, 'demo-data/test.db'));
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 3001);
  assert.equal(config.trustProxy, false);
});

test('hosting configuration rejects invalid ports, origins and proxy settings', () => {
  for (const environment of [
    { PORT: '-1' },
    { PORT: '70000' },
    { PORT: '3e3' },
    { APP_ORIGIN: 'https://example.com/path' },
    { APP_ORIGIN: 'http://example.com', SECURE_COOKIES: 'true' },
    { TRUST_PROXY: 'true' },
  ])
    assert.throws(() => readServerConfig(environment));
  const config = readServerConfig({
    APP_ORIGIN: 'https://demo.example.com',
    SECURE_COOKIES: 'true',
    TRUST_PROXY: 'loopback',
  });
  assert.equal(config.trustProxy, 'loopback');
});
