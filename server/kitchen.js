import { Router } from 'express';
import { createHash } from 'node:crypto';
import { priceOrder, readOrderItems, saveOrderItems } from './orders.js';
import {
  STAGES,
  TERMINAL_STAGES,
  nextStage,
} from '../Frontend/js/kitchen-options.js';

function problem(status, message) {
  throw Object.assign(new Error(message), { status });
}

const ticketQuery = `SELECT o.orderID AS orderId, o.customerName, o.phoneNumber,
  o.orderDate, o.totalCents, o.orderStatus, w.revision, w.entered_at AS enteredAt,
  COALESCE(d.service_type, s.service_type, 'Pickup') AS serviceType,
  COALESCE(s.source, 'Website') AS source, COALESCE(s.table_name, '') AS tableName,
  COALESCE(s.notes, '') AS notes
  FROM Orders o JOIN order_workflow w ON w.order_id = o.orderID
  LEFT JOIN order_details d ON d.order_id = o.orderID
  LEFT JOIN staff_order_details s ON s.order_id = o.orderID`;

export function readTicket(database, orderId) {
  const order = database
    .prepare(`${ticketQuery} WHERE o.orderID = ?`)
    .get(orderId);
  if (!order) problem(404, 'Order not found.');
  const items = readOrderItems(database, orderId);
  return {
    ...order,
    items,
    hasPizza: items.some((item) => item.itemName === 'Pizza'),
  };
}

export function changeStatus(
  database,
  employeeId,
  orderId,
  { action, expectedRevision, reason = '' } = {},
) {
  if (
    !Number.isSafeInteger(orderId) ||
    orderId < 1 ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 0 ||
    !['advance', 'recall', 'cancel'].includes(action) ||
    typeof reason !== 'string' ||
    reason.trim().length > 500
  )
    problem(
      400,
      'Choose a valid action and current ticket revision. Reasons must be at most 500 characters.',
    );
  if (action === 'cancel' && !reason.trim())
    problem(400, 'Enter a cancellation reason.');
  database.exec('BEGIN IMMEDIATE');
  try {
    const ticket = readTicket(database, orderId);
    if (ticket.revision !== expectedRevision)
      problem(
        409,
        'Another employee changed this order. Refresh and review its current stage.',
      );
    let target;
    if (action === 'advance')
      target = nextStage(ticket.orderStatus, ticket.hasPizza);
    if (action === 'cancel' && STAGES.includes(ticket.orderStatus))
      target = 'Cancelled';
    if (action === 'recall') {
      if (ticket.orderStatus === 'Cancelled') {
        target = database
          .prepare(
            "SELECT from_status AS status FROM order_events WHERE order_id = ? AND action = 'cancel' ORDER BY event_id DESC LIMIT 1",
          )
          .get(orderId)?.status;
      } else {
        const flow = ticket.hasPizza
          ? [...STAGES, 'Completed']
          : ['Pending', 'Preparing', 'Ready', 'Completed'];
        target = flow[flow.indexOf(ticket.orderStatus) - 1];
      }
    }
    if (!target || ![...STAGES, ...TERMINAL_STAGES].includes(target))
      problem(400, 'That action is not available at this stage.');
    const now = Date.now();
    database
      .prepare('UPDATE Orders SET orderStatus = ? WHERE orderID = ?')
      .run(target, orderId);
    database
      .prepare(
        'UPDATE order_workflow SET revision = revision + 1, entered_at = ? WHERE order_id = ?',
      )
      .run(now, orderId);
    database
      .prepare(
        'INSERT INTO order_events(order_id, employee_id, from_status, to_status, action, reason, occurred_at, revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        orderId,
        employeeId,
        ticket.orderStatus,
        target,
        action,
        reason.trim(),
        now,
        ticket.revision + 1,
      );
    const updated = readTicket(database, orderId);
    database.exec('COMMIT');
    return updated;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

export function saveStaffOrder(database, employeeId, body = {}) {
  const { customerName, serviceType, source, requestId, items } = body;
  const phoneNumber = body.phoneNumber || '';
  const tableName = body.tableName || '';
  const notes = body.notes || '';
  if (
    typeof customerName !== 'string' ||
    !customerName.trim() ||
    customerName.length > 120 ||
    !['Pickup', 'Dine-in'].includes(serviceType) ||
    !['Phone', 'Counter'].includes(source) ||
    typeof phoneNumber !== 'string' ||
    (phoneNumber &&
      (!/^[+\d\s().-]{7,25}$/.test(phoneNumber) ||
        phoneNumber.replace(/\D/g, '').length < 7)) ||
    (serviceType === 'Pickup' && !phoneNumber.trim()) ||
    typeof tableName !== 'string' ||
    tableName.length > 40 ||
    (serviceType !== 'Dine-in' && tableName.trim()) ||
    typeof notes !== 'string' ||
    notes.length > 500 ||
    typeof requestId !== 'string' ||
    !/^[a-zA-Z0-9-]{16,64}$/.test(requestId)
  )
    problem(
      400,
      'Check the name, pickup phone, service, source, table (40 characters), and notes (500 characters).',
    );
  const requestHash = createHash('sha256')
    .update(
      JSON.stringify({
        customerName,
        serviceType,
        source,
        requestId,
        items,
        phoneNumber,
        tableName,
        notes,
      }),
    )
    .digest('hex');
  database.exec('BEGIN IMMEDIATE');
  try {
    const existing = database
      .prepare(
        'SELECT order_id AS orderId, request_hash AS requestHash FROM staff_order_details WHERE employee_id = ? AND request_id = ?',
      )
      .get(employeeId, requestId);
    if (existing) {
      if (existing.requestHash !== requestHash)
        problem(
          409,
          'This submission was already saved with different contents. Review the saved order.',
        );
      const order = readTicket(database, existing.orderId);
      database.exec('COMMIT');
      return { order, created: false };
    }
    const pricedItems = priceOrder(database, items);
    const totalCents = pricedItems.reduce(
      (sum, item) => sum + item.lineTotalCents,
      0,
    );
    const result = database
      .prepare(
        'INSERT INTO Orders(customerName, phoneNumber, totalCents) VALUES (?, ?, ?)',
      )
      .run(customerName.trim(), phoneNumber.trim(), totalCents);
    const orderId = Number(result.lastInsertRowid);
    database
      .prepare(
        'INSERT INTO staff_order_details(order_id, employee_id, request_id, request_hash, source, service_type, table_name, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        orderId,
        employeeId,
        requestId,
        requestHash,
        source,
        serviceType,
        tableName.trim(),
        notes.trim(),
      );
    saveOrderItems(database, orderId, pricedItems);
    database
      .prepare(
        'UPDATE order_events SET employee_id = ? WHERE order_id = ? AND revision = 0',
      )
      .run(employeeId, orderId);
    const order = readTicket(database, orderId);
    database.exec('COMMIT');
    return { order, created: true };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

export function createKitchenRouter(database) {
  const router = Router();
  router.get('/kitchen', (request, response) => {
    const status = request.query.status || 'Pending';
    const page = Number(request.query.page || 1);
    const search = request.query.search || '';
    if (
      ![...STAGES, ...TERMINAL_STAGES].includes(status) ||
      !Number.isSafeInteger(page) ||
      page < 1 ||
      typeof search !== 'string' ||
      search.length > 120
    )
      return response
        .status(400)
        .json({ error: 'Choose a valid stage, search, and page.' });
    const where =
      " WHERE o.orderStatus = ? AND (o.customerName LIKE ? ESCAPE '\\' OR CAST(o.orderID AS TEXT) LIKE ? ESCAPE '\\')";
    const term = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    const total = database
      .prepare(`SELECT COUNT(*) AS count FROM Orders o${where}`)
      .get(status, term, term).count;
    const pages = Math.max(1, Math.ceil(total / 50));
    const currentPage = Math.min(page, pages);
    const direction = STAGES.includes(status) ? 'ASC' : 'DESC';
    const orders = database
      .prepare(
        `${ticketQuery}${where} ORDER BY o.orderID ${direction} LIMIT 50 OFFSET ?`,
      )
      .all(status, term, term, (currentPage - 1) * 50)
      .map((row) => ({ ...row, items: readOrderItems(database, row.orderId) }))
      .map((row) => ({
        ...row,
        hasPizza: row.items.some((item) => item.itemName === 'Pizza'),
      }));
    const counts = Object.fromEntries(
      database
        .prepare(
          'SELECT orderStatus, COUNT(*) AS count FROM Orders GROUP BY orderStatus',
        )
        .all()
        .map((row) => [row.orderStatus, row.count]),
    );
    response.json({
      orders,
      counts,
      total,
      page: currentPage,
      pageSize: 50,
      pages,
      serverTime: Date.now(),
    });
  });
  router.get('/orders/submissions/:requestId', (request, response) => {
    const row = database
      .prepare(
        'SELECT order_id AS orderId FROM staff_order_details WHERE employee_id = ? AND request_id = ?',
      )
      .get(request.employee.employeeId, request.params.requestId);
    response.json({ order: row ? readTicket(database, row.orderId) : null });
  });
  router.post('/orders', (request, response) => {
    const result = saveStaffOrder(
      database,
      request.employee.employeeId,
      request.body,
    );
    response.status(result.created ? 201 : 200).json(result.order);
  });
  router.post('/orders/:orderId/status', (request, response) => {
    response.json(
      changeStatus(
        database,
        request.employee.employeeId,
        Number(request.params.orderId),
        request.body,
      ),
    );
  });
  router.use((error, _request, response, next) => {
    if (error.status && [400, 404, 409].includes(error.status))
      return response.status(error.status).json({ error: error.message });
    next(error);
  });
  return router;
}
