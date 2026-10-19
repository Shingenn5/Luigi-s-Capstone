CREATE TABLE order_item_preferences (
  order_item_id INTEGER PRIMARY KEY REFERENCES OrderItems(orderItemID),
  sauce TEXT NOT NULL DEFAULT 'Regular' CHECK (sauce IN ('Regular', 'Light', 'Extra', 'None')),
  cheese TEXT NOT NULL DEFAULT 'Regular' CHECK (cheese IN ('Regular', 'Light', 'None'))
);
