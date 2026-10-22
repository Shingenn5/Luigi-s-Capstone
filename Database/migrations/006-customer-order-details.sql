-- Keep customer instructions with their order, separate from staff-only events.
ALTER TABLE order_details ADD COLUMN table_name TEXT NOT NULL DEFAULT '';
ALTER TABLE order_details ADD COLUMN notes TEXT NOT NULL DEFAULT '';
