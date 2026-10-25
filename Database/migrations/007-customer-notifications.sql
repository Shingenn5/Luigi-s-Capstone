CREATE TABLE customer_notifications (
  notification_id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL UNIQUE REFERENCES order_events(event_id),
  customer_id INTEGER NOT NULL REFERENCES Customer(customerID),
  order_id INTEGER NOT NULL REFERENCES Orders(orderID),
  stage TEXT NOT NULL,
  action TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  read_at INTEGER
);
CREATE INDEX customer_notifications_inbox
ON customer_notifications(customer_id, notification_id DESC);

-- Status and its account notification commit or roll back together.
-- Existing kitchen history is preserved without flooding accounts with old alerts.
CREATE TRIGGER notify_customer_order_status AFTER INSERT ON order_events
WHEN NEW.action IN ('advance', 'recall', 'cancel') BEGIN
  INSERT INTO customer_notifications(event_id, customer_id, order_id, stage, action, occurred_at)
  SELECT NEW.event_id, d.customer_id, NEW.order_id, NEW.to_status, NEW.action, NEW.occurred_at
  FROM order_details d WHERE d.order_id = NEW.order_id;
END;
