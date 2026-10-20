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

-- OrderItems table
-- Stores individual menu items within an order.

CREATE TABLE IF NOT EXISTS OrderItems (
    orderItemID INTEGER PRIMARY KEY AUTOINCREMENT,
    orderID INTEGER NOT NULL,
    menuItemID INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unitPriceCents INTEGER NOT NULL CHECK (unitPriceCents >= 0),
    FOREIGN KEY (orderID) REFERENCES Orders(orderID),
    FOREIGN KEY (menuItemID) REFERENCES MenuItems(menuItemID)
);

-- Toppings table
-- Stores available pizza toppings and their prices by size.

CREATE TABLE IF NOT EXISTS Toppings (
    toppingID INTEGER PRIMARY KEY AUTOINCREMENT,
    toppingName TEXT NOT NULL UNIQUE,
    smallPriceCents INTEGER NOT NULL CHECK (smallPriceCents >= 0),
    mediumPriceCents INTEGER NOT NULL CHECK (mediumPriceCents >= 0),
    largePriceCents INTEGER NOT NULL CHECK (largePriceCents >= 0)
);

-- OrderItemToppings table
-- Stores the toppings selected for individual pizzas.

CREATE TABLE IF NOT EXISTS OrderItemToppings (
    orderItemToppingID INTEGER PRIMARY KEY AUTOINCREMENT,
    orderItemID INTEGER NOT NULL,
    toppingID INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unitPriceCents INTEGER NOT NULL CHECK (unitPriceCents >= 0),
    FOREIGN KEY (orderItemID) REFERENCES OrderItems(orderItemID),
    FOREIGN KEY (toppingID) REFERENCES Toppings(toppingID),
    UNIQUE (orderItemID, toppingID)
);
