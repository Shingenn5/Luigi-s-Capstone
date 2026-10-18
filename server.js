import { createApp } from './server/app.js';
import { openDatabase } from './server/database.js';

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const database = openDatabase(
  process.env.DATABASE_PATH || 'Database/luigis_pizzeria.db',
);
const app = createApp(database);
const server = app.listen(PORT, HOST, () => {
  console.log(`Luigi's Pizzeria running at http://${HOST}:${PORT}`);
});

function closeServer() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on('SIGINT', closeServer);
process.on('SIGTERM', closeServer);
