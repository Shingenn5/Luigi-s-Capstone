CREATE TABLE order_workflow (
  order_id INTEGER PRIMARY KEY REFERENCES Orders(orderID),
  revision INTEGER NOT NULL DEFAULT 0,
  entered_at INTEGER NOT NULL
);
CREATE TABLE order_events (
  event_id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES Orders(orderID),
  employee_id INTEGER REFERENCES employees(employee_id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  occurred_at INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  UNIQUE(order_id, revision)
);
CREATE TABLE staff_order_details (
  order_id INTEGER PRIMARY KEY REFERENCES Orders(orderID),
  employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
  request_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('Phone', 'Counter')),
  service_type TEXT NOT NULL CHECK(service_type IN ('Pickup', 'Dine-in')),
  table_name TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  UNIQUE(employee_id, request_id)
);
INSERT INTO order_workflow (order_id, entered_at)
SELECT orderID, COALESCE(unixepoch(orderDate) * 1000, unixepoch() * 1000) FROM Orders;
INSERT INTO order_events (order_id, to_status, action, occurred_at, revision)
SELECT o.orderID, o.orderStatus, 'Imported', w.entered_at, 0
FROM Orders o JOIN order_workflow w ON w.order_id = o.orderID;
CREATE INDEX kitchen_status ON Orders(orderStatus, orderID);
CREATE INDEX kitchen_events ON order_events(order_id, event_id);
CREATE TRIGGER initialize_order_workflow AFTER INSERT ON Orders BEGIN
  INSERT INTO order_workflow(order_id, entered_at) VALUES(NEW.orderID, unixepoch() * 1000);
  INSERT INTO order_events(order_id, to_status, action, occurred_at, revision)
  VALUES(NEW.orderID, NEW.orderStatus, 'Created', unixepoch() * 1000, 0);
END;
