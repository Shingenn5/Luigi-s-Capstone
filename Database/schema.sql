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

-- Orders table
-- Stores information about orders
CREATE TABLE IF NOT EXISTS Orders (
    orderID INTEGER PRIMARY KEY AUTOINCREMENT,
    customerID INTEGER,
    customerName TEXT NOT NULL,
    phoneNumber TEXT NOT NULL,
    orderDate TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    totalCents INTEGER NOT NULL CHECK (totalCents >= 0),
    orderStatus TEXT NOT NULL DEFAULT 'Pending',
    FOREIGN KEY (customerID) REFERENCES Customer(customerID)
);
