import { Router } from 'express';
import { requireCustomer } from './auth.js';

function notificationText(row) {
  const labels = {
    Pending: 'Order received',
    Preparing: 'Preparing your order',
    'In oven': 'In the oven',
    Ready: 'Ready',
    Completed: 'Handed off',
    Cancelled: 'Cancelled',
  };
  const messages = {
    Pending: 'Your order is back in the kitchen queue.',
    Preparing: 'The kitchen is preparing your order.',
    'In oven': 'Your pizza is in the oven.',
    Ready: `${row.hasPizza ? 'Your pizza is made, cut and boxed. ' : ''}Your order is ready for ${row.serviceType === 'Pickup' ? 'pickup' : 'service'}.`,
    Completed:
      row.serviceType === 'Pickup'
        ? 'Your order has been handed over. Thank you!'
        : 'Your order has been served. Enjoy!',
    Cancelled:
      'Your order was cancelled. Contact the restaurant with any questions.',
  };
  return {
    notificationId: row.notificationId,
    orderId: row.orderId,
    stage: row.stage,
    action: row.action,
    occurredAt: row.occurredAt,
    readAt: row.readAt,
    title: `Order #${row.orderId} · ${row.action === 'recall' ? 'Progress corrected' : labels[row.stage]}`,
    message:
      row.action === 'recall'
        ? `The kitchen corrected your order's progress to ${labels[row.stage].toLowerCase()}. Check your order for the latest status.`
        : messages[row.stage],
  };
}

export function createNotificationRouter(database) {
  const router = Router();
  router.use(requireCustomer(database));
  router.get('/', (request, response) => {
    const page = Number(request.query.page || 1);
    if (!Number.isSafeInteger(page) || page < 1)
      return response
        .status(400)
        .json({ error: 'Choose a valid notification page.' });
    const customerId = request.customer.customerId;
    const { total, unreadCount } = database
      .prepare(
        'SELECT COUNT(*) AS total, COALESCE(SUM(read_at IS NULL), 0) AS unreadCount FROM customer_notifications WHERE customer_id = ?',
      )
      .get(customerId);
    const pages = Math.max(1, Math.ceil(total / 20));
    const currentPage = Math.min(page, pages);
    const notifications = database
      .prepare(
        `
      SELECT n.notification_id AS notificationId, n.order_id AS orderId,
        n.stage, n.action, n.occurred_at AS occurredAt, n.read_at AS readAt,
        d.service_type AS serviceType,
        EXISTS(SELECT 1 FROM OrderItems i JOIN MenuItems m ON m.menuItemID = i.menuItemID
          WHERE i.orderID = n.order_id AND m.category = 'Pizza') AS hasPizza
      FROM customer_notifications n JOIN order_details d ON d.order_id = n.order_id
      WHERE n.customer_id = ? ORDER BY n.notification_id DESC LIMIT 20 OFFSET ?
    `,
      )
      .all(customerId, (currentPage - 1) * 20)
      .map(notificationText);
    response.json({
      notifications,
      unreadCount,
      total,
      page: currentPage,
      pages,
    });
  });
  router.post('/read-all', (request, response) => {
    const throughId = request.body?.throughId;
    if (!Number.isSafeInteger(throughId) || throughId < 1)
      return response
        .status(400)
        .json({ error: 'Choose the latest notification to mark as read.' });
    // A newer update arriving after the displayed inbox remains unread.
    database
      .prepare(
        'UPDATE customer_notifications SET read_at = ? WHERE customer_id = ? AND notification_id <= ? AND read_at IS NULL',
      )
      .run(Date.now(), request.customer.customerId, throughId);
    response.json({ message: 'Notifications marked as read.' });
  });
  router.post('/:notificationId/read', (request, response) => {
    const notificationId = Number(request.params.notificationId);
    if (!Number.isSafeInteger(notificationId) || notificationId < 1)
      return response
        .status(400)
        .json({ error: 'Choose a valid notification.' });
    const result = database
      .prepare(
        'UPDATE customer_notifications SET read_at = COALESCE(read_at, ?) WHERE customer_id = ? AND notification_id = ?',
      )
      .run(Date.now(), request.customer.customerId, notificationId);
    if (!result.changes)
      return response.status(404).json({ error: 'Notification not found.' });
    response.json({ message: 'Notification marked as read.' });
  });
  return router;
}
