import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function openDatabase(databasePath) {
  if (databasePath !== ':memory:') {
    mkdirSync(dirname(resolve(databasePath)), { recursive: true });
  }
  const database = new DatabaseSync(databasePath);
  database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  database.exec(
    readFileSync(new URL('../Database/schema.sql', import.meta.url), 'utf8'),
  );
  database.exec(
    readFileSync(new URL('../Database/seed.sql', import.meta.url), 'utf8'),
  );
  database.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY);',
  );
  if (
    !database
      .prepare('SELECT version FROM schema_migrations WHERE version = 1')
      .get()
  ) {
    database.exec('BEGIN');
    try {
      database.exec(
        readFileSync(
          new URL(
            '../Database/migrations/001-customer-sessions.sql',
            import.meta.url,
          ),
          'utf8',
        ),
      );
      database
        .prepare('INSERT INTO schema_migrations (version) VALUES (?)')
        .run(1);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
  return database;
}

export function getMenu(database) {
  return database
    .prepare(
      `SELECT menuItemID AS menuItemId, itemName, category,
    size, priceCents FROM MenuItems ORDER BY menuItemID`,
    )
    .all();
}

export function getToppings(database) {
  return database
    .prepare(
      `SELECT toppingID AS toppingId, toppingName,
    smallPriceCents, mediumPriceCents, largePriceCents FROM Toppings ORDER BY toppingID`,
    )
    .all();
}
