const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const app = express();
const PORT = 3000;

// Find the SQLite database file
const dbPath = path.join(__dirname, 'Database', 'luigis_pizzeria.db');

// Connect to the database
const db = new DatabaseSync(dbPath, { readOnly: true });

// Enable foreign key enforcement
db.exec('PRAGMA foreign_keys = ON;');

// Test route for the server
app.get('/', (req, res) => {
    res.send('Welcome to Luigi\'s Pizzeria!');
});

// Retrieve all menu items from the database
app.get('/api/menu', (req, res) => {
    try {
        const menuItems = db.prepare('SELECT * FROM MenuItems').all();
        res.json(menuItems);
    } catch (error) {
        console.error('Error retrieving menu items:', error);
        res.status(500).json({ error: 'Unable to retrieve menu items' });
    }
});

 // Retrieve all available pizza toppings
app.get('/api/toppings', (req, res) => {
    try {
        const toppings = db.prepare('SELECT * FROM Toppings').all();
        res.json(toppings);
    } catch (error) {
        console.error('Error retrieving toppings:', error);
        res.status(500).json({ error: 'Unable to retrieve toppings' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Luigi's Pizzeria server running at http://localhost:${PORT}`);
    console.log('Connected to SQLite database.');
});
