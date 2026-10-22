-- Existing accounts keep ordinary employee access, including demo accounts.
ALTER TABLE employees ADD COLUMN role TEXT NOT NULL DEFAULT 'employee'
  CHECK (role IN ('employee', 'admin'));
