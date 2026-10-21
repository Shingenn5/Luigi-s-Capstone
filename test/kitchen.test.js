import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/database.js';
import { createEmployee } from '../server/employees.js';
import { changeStatus, readTicket, saveStaffOrder } from '../server/kitchen.js';

const draft = (requestId = 'staff-kitchen-test-0001', menuItemId = 1) => ({
  customerName: 'Kitchen Test',
  phoneNumber: '555-555-0100',
  source: 'Phone',
  serviceType: 'Pickup',
  requestId,
  notes: 'Light bake',
  items: [
    {
      menuItemId,
      quantity: 1,
      sauce: 'Light',
      toppings: menuItemId === 1 ? [{ toppingId: 1, quantity: 2 }] : [],
    },
  ],
});

test('kitchen workflow enforces revisions, recall, cancellation and drink routing with audit events', async () => {
  const database = openDatabase(':memory:');
  try {
    const employee = await createEmployee(database, {
      username: 'cook',
      displayName: 'Cook',
      password: 'kitchen test password',
    });
    const saved = saveStaffOrder(database, employee, draft());
    assert.equal(saved.order.totalCents, 700);
    assert.equal(saved.order.source, 'Phone');
    assert.equal(saveStaffOrder(database, employee, draft()).created, false);
    assert.throws(
      () =>
        saveStaffOrder(database, employee, { ...draft(), notes: 'Changed' }),
      { status: 409 },
    );
    let ticket = saved.order;
    const act = (action, reason = '') =>
      (ticket = changeStatus(database, employee, ticket.orderId, {
        action,
        expectedRevision: ticket.revision,
        reason,
      }));
    act('advance');
    assert.equal(ticket.orderStatus, 'Preparing');
    assert.throws(
      () =>
        changeStatus(database, employee, ticket.orderId, {
          action: 'advance',
          expectedRevision: 0,
        }),
      { status: 409 },
    );
    act('advance');
    assert.equal(ticket.orderStatus, 'In oven');
    act('advance');
    act('advance');
    assert.equal(ticket.orderStatus, 'Completed');
    act('recall');
    assert.equal(ticket.orderStatus, 'Ready');
    assert.throws(() => act('cancel'), { status: 400 });
    act('cancel', 'Customer requested cancellation');
    assert.equal(ticket.orderStatus, 'Cancelled');
    act('recall');
    assert.equal(ticket.orderStatus, 'Ready');
    assert.equal(
      database
        .prepare(
          'SELECT COUNT(*) AS count FROM order_events WHERE order_id = ?',
        )
        .get(ticket.orderId).count,
      ticket.revision + 1,
    );
    assert.equal(readTicket(database, ticket.orderId).notes, 'Light bake');
    const drinkId = database
      .prepare(
        "SELECT menuItemID AS id FROM MenuItems WHERE category = 'Drink' LIMIT 1",
      )
      .get().id;
    const drinkDraft = draft('staff-kitchen-drink-0001', drinkId);
    delete drinkDraft.items[0].sauce;
    ticket = saveStaffOrder(database, employee, {
      ...drinkDraft,
      serviceType: 'Dine-in',
      phoneNumber: '',
      tableName: '12',
    }).order;
    act('advance');
    act('advance');
    assert.equal(ticket.orderStatus, 'Ready');
    act('recall');
    assert.equal(ticket.orderStatus, 'Preparing');
    const before = database
      .prepare('SELECT COUNT(*) AS count FROM Orders')
      .get().count;
    assert.throws(
      () =>
        saveStaffOrder(database, employee, {
          ...draft('invalid-staff-order-0001'),
          items: [{ menuItemId: -1 }],
        }),
      { status: 400 },
    );
    assert.equal(
      database.prepare('SELECT COUNT(*) AS count FROM Orders').get().count,
      before,
    );
  } finally {
    database.close();
  }
});
