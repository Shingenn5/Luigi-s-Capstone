const labels = {
  Pending: 'Order received',
  Preparing: 'Preparing',
  'In oven': 'In the oven',
  Ready: 'Cut and boxed',
  Completed: 'Handed off',
  Cancelled: 'Cancelled',
};

export function customerStage(order) {
  return order.orderStatus === 'Ready' &&
    !order.items.some((item) => item.itemName === 'Pizza')
    ? 'Ready'
    : labels[order.orderStatus] || order.orderStatus;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function orderTracker(order) {
  const { tracking } = order;
  const tracker = element('section', 'border rounded p-3 mb-3');
  tracker.setAttribute('aria-label', `Order #${order.orderId} progress`);
  tracker.append(element('h4', 'h6 fw-bold', customerStage(order)));
  const guidance = {
    Pending:
      'Your order is in the kitchen queue. An employee will start preparing it next.',
    Preparing:
      'The team is preparing your items and checking your instructions.',
    'In oven':
      'Your pizza is baking. Staff will mark it ready after cutting and boxing.',
    Completed:
      order.serviceType === 'Pickup'
        ? 'Your order has been handed over. Thank you!'
        : 'Your order has been served. Enjoy!',
  };
  if (guidance[order.orderStatus])
    tracker.append(element('p', 'small mb-2', guidance[order.orderStatus]));
  const terminal = ['Completed', 'Cancelled'].includes(order.orderStatus);
  const elapsed = element('p', 'small mb-3');
  elapsed.dataset.orderClock = '';
  elapsed.dataset.createdAt = tracking.createdAt;
  elapsed.dataset.enteredAt = tracking.enteredAt;
  elapsed.dataset.stoppedAt = terminal ? tracking.enteredAt : '';
  tracker.append(elapsed);
  const steps = element('ol', 'list-unstyled row g-2 mb-0');
  const hasPizza = order.items.some((item) => item.itemName === 'Pizza');
  const flow = hasPizza
    ? ['Pending', 'Preparing', 'In oven', 'Ready', 'Completed']
    : ['Pending', 'Preparing', 'Ready', 'Completed'];
  for (const stage of flow) {
    const milestone = tracking.milestones.find(
      (entry) => entry.stage === stage,
    );
    const current = order.orderStatus === stage;
    const row = element('li', 'col-12 col-md');
    const content = element(
      'div',
      `border-start border-4 p-2 h-100 ${current ? 'border-primary bg-primary-subtle text-primary-emphasis' : milestone ? 'border-success' : 'border-secondary-subtle'}`,
    );
    if (current) row.setAttribute('aria-current', 'step');
    content.append(
      element(
        'div',
        'fw-semibold',
        stage === 'Ready' && !hasPizza ? 'Ready' : labels[stage],
      ),
    );
    if (milestone) {
      const time = element(
        'time',
        'small d-block',
        new Date(milestone.occurredAt).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
        }),
      );
      time.dateTime = new Date(milestone.occurredAt).toISOString();
      time.title = new Date(milestone.occurredAt).toLocaleString();
      content.append(time);
    } else
      content.append(
        element(
          'span',
          'small',
          current ? 'Time unavailable' : terminal ? 'Not recorded' : 'Waiting',
        ),
      );
    row.append(content);
    steps.append(row);
  }
  tracker.append(steps);
  if (order.orderStatus === 'Ready')
    tracker.append(
      element(
        'p',
        'small fw-semibold mt-3 mb-0',
        order.serviceType === 'Pickup'
          ? 'Your order is ready for pickup.'
          : 'Your order is ready for service.',
      ),
    );
  if (order.orderStatus === 'Cancelled')
    tracker.append(
      element(
        'p',
        'small fw-semibold mt-3 mb-0',
        'This order was cancelled. Contact the restaurant with any questions.',
      ),
    );
  return tracker;
}

export function updateOrderClocks(serverNow) {
  const duration = (start, end) => {
    const seconds = Math.max(0, Math.floor((end - start) / 1000));
    return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
  };
  document.querySelectorAll('[data-order-clock]').forEach((node) => {
    const end = Number(node.dataset.stoppedAt) || serverNow;
    node.textContent = node.dataset.stoppedAt
      ? `Total time: ${duration(Number(node.dataset.createdAt), end)}`
      : `Time since order: ${duration(Number(node.dataset.createdAt), end)} · In current stage: ${duration(Number(node.dataset.enteredAt), end)}`;
  });
}
