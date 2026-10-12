-- Insert pizzas and drinks into MenuItems

INSERT OR IGNORE INTO MenuItems (itemName, category, size, priceCents)
VALUES
    -- Pizzas
    ('Pizza', 'Pizza', 'Small', 500),
    ('Pizza', 'Pizza', 'Medium', 700),
    ('Pizza', 'Pizza', 'Large', 900),

    -- Iced Tea
    ('Iced Tea', 'Drink', 'Small', 100),
    ('Iced Tea', 'Drink', 'Medium', 200),
    ('Iced Tea', 'Drink', 'Large', 300),

    -- Dr. Pepper
    ('Dr. Pepper', 'Drink', 'Small', 100),
    ('Dr. Pepper', 'Drink', 'Medium', 200),
    ('Dr. Pepper', 'Drink', 'Large', 300),

    -- Cola
    ('Cola', 'Drink', 'Small', 100),
    ('Cola', 'Drink', 'Medium', 200),
    ('Cola', 'Drink', 'Large', 300),

    -- UnCola
    ('UnCola', 'Drink', 'Small', 100),
    ('UnCola', 'Drink', 'Medium', 200),
    ('UnCola', 'Drink', 'Large', 300);
