-- Preserve the existing capstone tables and their data.
CREATE UNIQUE INDEX customer_email_normalized ON Customer (LOWER(email));

CREATE TABLE customer_sessions (
  token_hash TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES Customer(customerID) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX customer_sessions_expiry ON customer_sessions (expires_at);

CREATE TABLE order_details (
  order_id INTEGER PRIMARY KEY REFERENCES Orders(orderID),
  request_id TEXT NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES Customer(customerID),
  service_type TEXT NOT NULL CHECK (service_type IN ('Pickup', 'Dine-in')),
  UNIQUE (customer_id, request_id)
);
CREATE INDEX orders_customer ON Orders (customerID, orderID);
