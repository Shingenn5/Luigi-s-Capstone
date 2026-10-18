import { Router } from 'express';
import { requireCustomer } from './auth.js';
import { getMenu, getToppings } from './database.js';

function invalidOrder(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

export function priceOrder(database, items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
    invalidOrder('Add between 1 and 20 items to your order.');
  }
  const menu = getMenu(database);
  const toppings = getToppings(database);
  return items.map((item) => {
    const menuItem = menu.find(
      (entry) => entry.menuItemId === item?.menuItemId,
    );
    if (
      !menuItem ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 20
    ) {
      invalidOrder('Choose an available item and a quantity from 1 to 20.');
    }
    if (
      !Array.isArray(item.toppings) ||
      item.toppings.length > toppings.length ||
      (menuItem.category !== 'Pizza' && item.toppings.length)
    ) {
      invalidOrder('Check the toppings on your order.');
    }
    const toppingIds = new Set();
    const selectedToppings = item.toppings.map((selection) => {
      const topping = toppings.find(
        (entry) => entry.toppingId === selection?.toppingId,
      );
      if (
        !topping ||
        toppingIds.has(selection.toppingId) ||
        !Number.isInteger(selection.quantity) ||
        selection.quantity < 1 ||
        selection.quantity > 10
      ) {
        invalidOrder('Choose each topping once with 1 to 10 portions.');
      }
      toppingIds.add(selection.toppingId);
      const priceKey = `${menuItem.size.toLowerCase()}PriceCents`;
      return {
        ...selection,
        toppingName: topping.toppingName,
        unitPriceCents: topping[priceKey],
      };
    });
    const unitPriceCents =
      menuItem.priceCents +
      selectedToppings.reduce(
        (sum, topping) => sum + topping.unitPriceCents * topping.quantity,
        0,
      );
    return {
      ...menuItem,
      quantity: item.quantity,
      toppings: selectedToppings,
      unitPriceCents,
      lineTotalCents: unitPriceCents * item.quantity,
    };
  });
}

function readOrders(database, customerId) {
  const orders = database
    .prepare(
      `SELECT o.orderID AS orderId, o.customerName, o.phoneNumber,
    o.orderDate, o.totalCents, o.orderStatus, d.service_type AS serviceType
    FROM Orders o JOIN order_details d ON d.order_id = o.orderID
    WHERE o.customerID = ? ORDER BY o.orderID DESC LIMIT 50`,
    )
    .all(customerId);
  return orders.map((order) => ({
    ...order,
    items: database
      .prepare(
        `SELECT oi.orderItemID AS orderItemId, m.itemName, m.size,
      oi.quantity, oi.unitPriceCents FROM OrderItems oi JOIN MenuItems m ON m.menuItemID = oi.menuItemID
      WHERE oi.orderID = ? ORDER BY oi.orderItemID`,
      )
      .all(order.orderId)
      .map((item) => ({
        ...item,
        toppings: database
          .prepare(
            `SELECT t.toppingName, ot.quantity FROM OrderItemToppings ot
          JOIN Toppings t ON t.toppingID = ot.toppingID WHERE ot.orderItemID = ?`,
          )
          .all(item.orderItemId),
      })),
  }));
}

export function createOrderRouter(database) {
  const router = Router();
  router.use(requireCustomer(database));
  router.get('/', (request, response) =>
    response.json(readOrders(database, request.customer.customerId)),
  );
  router.post('/', (request, response) => {
    const { customerName, phoneNumber, serviceType, requestId, items } =
      request.body || {};
    if (
      typeof customerName !== 'string' ||
      !customerName.trim() ||
      customerName.length > 120 ||
      typeof phoneNumber !== 'string' ||
      !/^[+\d\s().-]{7,25}$/.test(phoneNumber) ||
      phoneNumber.replace(/\D/g, '').length < 7 ||
      !['Pickup', 'Dine-in'].includes(serviceType) ||
      typeof requestId !== 'string' ||
      !/^[a-zA-Z0-9-]{16,64}$/.test(requestId)
    ) {
      return response.status(400).json({
        error:
          'Enter your name, phone number, and a pickup or dine-in selection.',
      });
    }
    const customerId = request.customer.customerId;
    const existing = database
      .prepare(
        'SELECT order_id AS orderId FROM order_details WHERE customer_id = ? AND request_id = ?',
      )
      .get(customerId, requestId);
    if (existing)
      return response.json({
        orderId: existing.orderId,
        message: 'This order is already saved.',
      });
    let pricedItems;
    try {
      pricedItems = priceOrder(database, items);
    } catch (error) {
      if (error.status === 400)
        return response.status(400).json({ error: error.message });
      throw error;
    }
    const totalCents = pricedItems.reduce(
      (sum, item) => sum + item.lineTotalCents,
      0,
    );
    database.exec('BEGIN');
    try {
      const order = database
        .prepare(
          `INSERT INTO Orders (customerID, customerName, phoneNumber, totalCents)
        VALUES (?, ?, ?, ?)`,
        )
        .run(customerId, customerName.trim(), phoneNumber.trim(), totalCents);
      const orderId = Number(order.lastInsertRowid);
      database
        .prepare(
          'INSERT INTO order_details (order_id, request_id, customer_id, service_type) VALUES (?, ?, ?, ?)',
        )
        .run(orderId, requestId, customerId, serviceType);
      for (const item of pricedItems) {
        const line = database
          .prepare(
            `INSERT INTO OrderItems (orderID, menuItemID, quantity, unitPriceCents) VALUES (?, ?, ?, ?)`,
          )
          .run(orderId, item.menuItemId, item.quantity, item.unitPriceCents);
        for (const topping of item.toppings) {
          database
            .prepare(
              `INSERT INTO OrderItemToppings (orderItemID, toppingID, quantity, unitPriceCents) VALUES (?, ?, ?, ?)`,
            )
            .run(
              Number(line.lastInsertRowid),
              topping.toppingId,
              topping.quantity,
              topping.unitPriceCents,
            );
        }
      }
      database.exec('COMMIT');
      response.status(201).json({
        orderId,
        totalCents,
        message:
          'Order saved as Pending. Restaurant acceptance is not connected.',
      });
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  });
  return router;
}
