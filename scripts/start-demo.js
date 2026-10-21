import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { networkInterfaces } from 'node:os';
import { readServerConfig, repositoryPath } from '../server/config.js';

try {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major !== 24 || minor < 19)
    throw new Error(
      'Install Node.js 24.19 or newer in the 24 LTS release line, then run this launcher again.',
    );
  process.chdir(repositoryPath);
  if (existsSync(join(repositoryPath, '.env')))
    process.loadEnvFile(join(repositoryPath, '.env'));
  const { values } = parseArgs({
    options: {
      lan: { type: 'boolean', default: false },
      port: { type: 'string' },
    },
  });
  if (values.lan) process.env.HOST = '0.0.0.0';
  if (values.port) process.env.PORT = values.port;
  const config = readServerConfig();
  if (!existsSync(join(repositoryPath, 'node_modules/express/package.json'))) {
    console.log('Installing the server dependencies for this demo…');
    const install = spawnSync(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['ci', '--omit=dev'],
      {
        cwd: repositoryPath,
        stdio: 'inherit',
        shell: process.platform === 'win32',
      },
    );
    if (install.error || install.status !== 0)
      throw new Error(
        'Dependency installation failed. Install Node.js with npm and check your internet connection, then retry.',
      );
  }
  console.log(
    'Full local demo: customer accounts, saved orders, and employee access. Stop with Ctrl+C.',
  );
  if (config.host === '0.0.0.0') {
    for (const addresses of Object.values(networkInterfaces())) {
      for (const address of addresses || []) {
        if (address.family === 'IPv4' && !address.internal)
          console.log(
            `Same-network demo: http://${address.address}:${config.port}`,
          );
      }
    }
    console.log(
      'Use the same site address throughout sign-in. LAN HTTP demos should use test accounts.',
    );
  }
  await import('../server.js');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
