import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryPath = fileURLToPath(new URL('../', import.meta.url));

export function readServerConfig(environment = process.env) {
  const portText = environment.PORT || '3000';
  const port = Number(portText);
  if (
    !/^\d+$/.test(portText) ||
    !Number.isInteger(port) ||
    port < 0 ||
    port > 65535
  ) {
    throw new Error('PORT must be a whole number from 0 to 65535.');
  }
  if (environment.APP_ORIGIN) {
    const origin = new URL(environment.APP_ORIGIN);
    if (
      !['http:', 'https:'].includes(origin.protocol) ||
      origin.origin !== environment.APP_ORIGIN
    ) {
      throw new Error(
        'APP_ORIGIN must be an HTTP or HTTPS origin without a trailing slash or path.',
      );
    }
    if (environment.SECURE_COOKIES === 'true' && origin.protocol !== 'https:') {
      throw new Error('Secure cookies require an HTTPS APP_ORIGIN.');
    }
  }
  if (environment.TRUST_PROXY && environment.TRUST_PROXY !== 'loopback') {
    throw new Error(
      'TRUST_PROXY must be empty or loopback for the included reverse-proxy setup.',
    );
  }
  return {
    port,
    host: environment.HOST || '127.0.0.1',
    databasePath: resolve(
      repositoryPath,
      environment.DATABASE_PATH || 'Database/luigis_pizzeria.db',
    ),
    trustProxy: environment.TRUST_PROXY || false,
  };
}
