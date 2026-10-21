import { createApp } from './server/app.js';
import { openDatabase } from './server/database.js';
import { readServerConfig } from './server/config.js';

const config = readServerConfig();
const database = openDatabase(config.databasePath);
const app = createApp(database, { trustProxy: config.trustProxy });
const server = app.listen(config.port, config.host, () => {
  const host = config.host === '0.0.0.0' ? '127.0.0.1' : config.host;
  console.log(
    `Luigi's Pizzeria running at http://${host}:${server.address().port}`,
  );
  console.log(`Data saved in ${config.databasePath}`);
});
server.on('error', (error) => {
  console.error(
    error.code === 'EADDRINUSE'
      ? `Port ${config.port} is already in use. Choose another PORT or use npm run demo -- --port 3001.`
      : error.message,
  );
  database.close();
  process.exitCode = 1;
});

function closeServer() {
  const timeout = setTimeout(() => server.closeAllConnections(), 10000);
  timeout.unref();
  server.close(() => {
    clearTimeout(timeout);
    database.close();
    process.exit(0);
  });
}

process.on('SIGINT', closeServer);
process.on('SIGTERM', closeServer);
