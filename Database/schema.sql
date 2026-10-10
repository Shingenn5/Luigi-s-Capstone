-- Luigi's Pizzeria Database
-- This file contains the SQL statements used to create our database tables.

-- Customer table
-- Stores information about registered customers.

CREATE TABLE IF NOT EXISTS Customer (
    customerID INTEGER PRIMARY KEY AUTOINCREMENT,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL
);
