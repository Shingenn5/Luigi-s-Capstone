CREATE TABLE employees (
  employee_id INTEGER PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

CREATE TABLE employee_sessions (
  token_hash TEXT PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX employee_sessions_expiry ON employee_sessions (expires_at);
