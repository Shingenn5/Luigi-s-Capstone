import { apiRequest } from './api.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function setupNotifications() {
  const toggle = document.querySelector('#notificationsToggle');
  const panel = document.querySelector('#notificationsPanel');
  const list = document.querySelector('#notificationList');
  const notice = document.querySelector('#notificationAnnouncement');
  const connection = document.querySelector('#notificationConnection');
  const readAll = document.querySelector('#notificationsReadAll');
  let page = 1;
  let pageCount = 1;
  let latestId = 0;
  let seenId;
  let timer;
  let loading = false;
  let stopped = false;
  let changing = false;
  let signature;
  let version = 0;
  toggle.hidden = false;

  function stop() {
    stopped = true;
    clearTimeout(timer);
    toggle.hidden = true;
    panel.hidden = true;
    list.replaceChildren();
    notice.textContent = '';
  }
  function render(result) {
    document.querySelector('#notificationCount').textContent =
      result.unreadCount;
    toggle.setAttribute(
      'aria-label',
      `Order updates, ${result.unreadCount} unread`,
    );
    readAll.disabled = !result.unreadCount || changing;
    page = result.page;
    pageCount = result.pages;
    document.querySelector('#notificationPage').textContent =
      `Page ${page} of ${pageCount}`;
    document.querySelector('#notificationsPrevious').disabled = page <= 1;
    document.querySelector('#notificationsNext').disabled = page >= pageCount;
    document.querySelector('#notificationPagination').hidden = pageCount <= 1;
    const nextSignature = JSON.stringify(result.notifications);
    if (signature === nextSignature) return;
    signature = nextSignature;
    const focused = list.contains(document.activeElement)
      ? document.activeElement.id
      : null;
    list.replaceChildren();
    if (!result.notifications.length)
      list.append(
        element(
          'li',
          'list-group-item py-3',
          'No order updates yet. Kitchen stage changes will appear here.',
        ),
      );
    for (const notification of result.notifications) {
      const row = element(
        'li',
        `list-group-item p-3 ${notification.readAt === null ? 'bg-body-tertiary' : ''}`,
      );
      row.dataset.notificationId = notification.notificationId;
      row.append(element('h3', 'h6 mb-2', notification.title));
      if (notification.readAt === null)
        row.append(element('span', 'badge text-bg-primary mb-2', 'Unread'));
      row.append(element('p', 'mb-2', notification.message));
      const time = element(
        'time',
        'small text-body-secondary d-block mb-2',
        new Date(notification.occurredAt).toLocaleString(),
      );
      time.dateTime = new Date(notification.occurredAt).toISOString();
      row.append(time);
      const controls = element(
        'div',
        'd-flex flex-wrap gap-3 align-items-center',
      );
      const link = element('a', 'py-2', 'View order progress');
      link.href = './order.html#orderHistory';
      link.id = `notification-order-${notification.notificationId}`;
      controls.append(link);
      if (notification.readAt === null) {
        const read = element(
          'button',
          'btn btn-outline-dark py-2',
          'Mark as read',
        );
        read.type = 'button';
        read.id = `notification-read-${notification.notificationId}`;
        read.disabled = changing;
        read.setAttribute(
          'aria-label',
          `Mark update for order #${notification.orderId} as read`,
        );
        read.onclick = () =>
          markRead(`notifications/${notification.notificationId}/read`, {});
        controls.append(read);
      }
      row.append(controls);
      list.append(row);
    }
    if (focused) (document.getElementById(focused) || toggle).focus();
  }
  async function load() {
    if (stopped || loading || document.hidden) return;
    clearTimeout(timer);
    loading = true;
    const requestVersion = version;
    try {
      const result = await apiRequest(`notifications?page=${page}`);
      if (stopped || requestVersion !== version) return;
      connection.textContent =
        'Order updates refresh automatically. Earlier messages describe the stage at that time; view order progress for the latest status.';
      const newest = result.notifications[0]?.notificationId || 0;
      if (page === 1) {
        latestId = newest;
        if (seenId === undefined && result.unreadCount)
          notice.textContent = `You have ${result.unreadCount} unread order updates. Open Updates to read them.`;
        else if (seenId !== undefined && newest > seenId) {
          const notification = result.notifications[0];
          notice.textContent = `${notification.title}. ${notification.message}`;
        }
        seenId = Math.max(seenId || 0, newest);
      }
      render(result);
    } catch (error) {
      if (error.status === 401) stop();
      else
        connection.textContent = `${error.message} Saved updates remain here; reconnecting automatically.`;
    } finally {
      loading = false;
      if (!stopped) timer = setTimeout(load, 2000);
    }
  }
  async function reload() {
    while (loading && !stopped)
      await new Promise((resolve) => setTimeout(resolve, 25));
    await load();
  }
  async function markRead(path, body) {
    if (changing || stopped) return;
    const focusedId = panel.contains(document.activeElement)
      ? document.activeElement.id
      : null;
    changing = true;
    readAll.disabled = true;
    list
      .querySelectorAll('button')
      .forEach((button) => (button.disabled = true));
    try {
      await apiRequest(path, { method: 'POST', body: JSON.stringify(body) });
      notice.textContent = 'Order updates marked as read.';
    } catch (error) {
      if (error.status === 401) stop();
      else notice.textContent = error.message;
    } finally {
      changing = false;
      signature = undefined;
      await reload();
      if (!stopped && focusedId && document.activeElement === document.body) {
        const previous = document.getElementById(focusedId);
        (previous && !previous.disabled ? previous : toggle).focus();
      }
    }
  }
  toggle.onclick = () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) {
      page = 1;
      version += 1;
      reload();
    }
  };
  readAll.onclick = () =>
    markRead('notifications/read-all', { throughId: latestId });
  for (const [id, offset] of [
    ['notificationsPrevious', -1],
    ['notificationsNext', 1],
  ])
    document.getElementById(id).onclick = () => {
      page = Math.max(1, Math.min(pageCount, page + offset));
      version += 1;
      reload();
    };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(timer);
    else load();
  });
  window.addEventListener('online', load);
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) load();
  });
  load();
  return stop;
}
