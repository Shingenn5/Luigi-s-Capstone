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

-- MenuItem table
-- Stores pizza and drinks available for purchase

CREATE TABLE IF NOT EXISTS MenuItems (
    menuItemID INTEGER PRIMARY KEY AUTOINCREMENT,
    itemName TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Pizza', 'Drink')),
    size TEXT NOT NULL CHECK (size IN ('Small', 'Medium', 'Large')),
    priceCents INTEGER NOT NULL CHECK (priceCents >= 0),
    UNIQUE (itemName, size)
);
