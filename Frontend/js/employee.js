import { apiRequest } from './api.js';
import { currency } from './cart.js';
import { toppingLabel, preferenceLabel } from './pizza-options.js';
import { STAGES, stageLabel, advanceLabel } from './kitchen-options.js';

const $ = (selector) => document.querySelector(selector);
const status = $('#employeeStatus');
const pages = Object.fromEntries(
  [...STAGES, 'Completed', 'Cancelled'].map((stage) => [stage, 1]),
);
const snapshots = new Map();
const expandedContacts = new Set();
let view = 'board';
let connected = false;
let stopped = false;
let loading = false;
let changing = false;
let timer;
let clockOffset = 0;
let lastSuccess = 0;
let cancelTicket;
let selectedId;
let audio;
let seenNewest;
let soundEnabled = false;
let warning = 10;
let overdue = 20;
let historySearch = '';
let stageFilter = 'all';
let timeoutMinutes = Number(preference('luigis-kitchen-timeout', '120'));
if (
  !Number.isInteger(timeoutMinutes) ||
  timeoutMinutes < 1 ||
  timeoutMinutes > 1440
)
  timeoutMinutes = 120;
let queueSort = preference('luigis-kitchen-sort', 'oldest');
if (!['oldest', 'newest'].includes(queueSort)) queueSort = 'oldest';
let queueVersion = 0;

function describeQueue() {
  $('#queueFilterLabel').textContent =
    view === 'timed-out' ? 'All timed out' : 'All active';
  $('#queueDescription').textContent =
    view === 'timed-out'
      ? `Unfinished orders placed ${timeoutMinutes} or more minutes ago. Review these tickets and finish or cancel them as needed.`
      : `Orders move to Timed out ${timeoutMinutes} minutes after being placed if still unfinished.`;
  $('#boardView').setAttribute(
    'aria-label',
    view === 'timed-out' ? 'Timed-out kitchen orders' : 'Active kitchen orders',
  );
}
async function refreshQueuePreferences() {
  queueVersion += 1;
  for (const stage of STAGES) pages[stage] = 1;
  snapshots.clear();
  describeQueue();
  await waitForLoad();
  await loadOrders();
}
$('#timeoutMinutes').value = timeoutMinutes;
$('#queueSort').value = queueSort;
describeQueue();
$('#timeoutForm').onsubmit = (event) => {
  event.preventDefault();
  if (!event.target.reportValidity()) return;
  timeoutMinutes = Number($('#timeoutMinutes').value);
  savePreference('luigis-kitchen-timeout', String(timeoutMinutes));
  refreshQueuePreferences();
};
$('#queueSort').onchange = () => {
  queueSort = $('#queueSort').value;
  savePreference('luigis-kitchen-sort', queueSort);
  refreshQueuePreferences();
};

export function message(text) {
  status.textContent = text;
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function preference(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}
function savePreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    message('This browser cannot save display preferences.');
  }
}
try {
  const saved = JSON.parse(preference('luigis-kitchen-thresholds', 'null'));
  if (
    Number.isInteger(saved?.warning) &&
    saved.warning > 0 &&
    saved.overdue > saved.warning &&
    saved.overdue <= 180
  ) {
    warning = saved.warning;
    overdue = saved.overdue;
  }
} catch {
  /* Use the documented demo defaults when saved settings are invalid. */
}
$('#warningMinutes').value = warning;
$('#overdueMinutes').value = overdue;
$('#thresholdForm').onsubmit = (event) => {
  event.preventDefault();
  const nextWarning = Number($('#warningMinutes').value);
  const nextOverdue = Number($('#overdueMinutes').value);
  $('#overdueMinutes').setCustomValidity(
    nextOverdue > nextWarning
      ? ''
      : 'Overdue age must be greater than warning age.',
  );
  if (!event.target.reportValidity()) return;
  warning = nextWarning;
  overdue = nextOverdue;
  savePreference(
    'luigis-kitchen-thresholds',
    JSON.stringify({ warning, overdue }),
  );
  updateClocks();
  message('Demo aging thresholds saved for this device.');
};
$('#overdueMinutes').oninput = () => $('#overdueMinutes').setCustomValidity('');
$('#soundToggle').onclick = async () => {
  if (soundEnabled) {
    soundEnabled = false;
  } else {
    try {
      audio ||= new window.AudioContext();
      await audio.resume();
      soundEnabled = true;
    } catch {
      message(
        'Sound is unavailable in this browser. Visual alerts remain enabled.',
      );
      return;
    }
  }
  $('#soundToggle').textContent = soundEnabled
    ? 'Disable sound'
    : 'Enable sound';
  $('#soundToggle').setAttribute('aria-pressed', String(soundEnabled));
};
function chime() {
  if (!soundEnabled || audio?.state !== 'running') return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.frequency.value = 660;
  gain.gain.setValueAtTime(0.08, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.35);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.35);
}
function setConnection(ok) {
  connected = ok;
  document.documentElement.dataset.kitchenConnected = String(ok);
  document.dispatchEvent(
    new CustomEvent('kitchen-connection', { detail: { connected: ok } }),
  );
  $('#connectionStatus').textContent = ok
    ? `Live · Updated ${new Date(lastSuccess).toLocaleTimeString()}`
    : `Connection interrupted. Actions paused. Last update: ${lastSuccess ? new Date(lastSuccess).toLocaleTimeString() : 'not yet connected'}.`;
  $('#connectionStatus').className = ok
    ? 'small text-body-secondary mb-0'
    : 'text-warning-emphasis fw-bold mb-0';
  document
    .querySelectorAll('[data-mutation]')
    .forEach((button) => (button.disabled = !connected || changing));
}
function button(label, callback, id) {
  const node = element('button', 'btn btn-outline-secondary', label);
  node.type = 'button';
  if (id) node.id = id;
  node.onclick = callback;
  return node;
}
function selectTicket(orderId) {
  selectedId = orderId;
  document.querySelectorAll('[data-ticket-select]').forEach((node) => {
    const selected = Number(node.dataset.ticketSelect) === selectedId;
    node.setAttribute('aria-pressed', String(selected));
    node.closest('article').classList.toggle('is-selected', selected);
  });
}
function ticketFocusTarget(...ids) {
  return (
    [
      ...ids.map((id) => document.getElementById(id)),
      ...document.querySelectorAll('[data-ticket-select]'),
    ].find((node) => node && !node.closest('[hidden]')) || $('#workspaceTitle')
  );
}
function ticketCard(ticket) {
  const card = element(
    'article',
    'kitchen-ticket row g-0 bg-body border border-2 border-secondary rounded-3 shadow-sm mb-3',
  );
  card.id = `ticket-${ticket.orderId}`;
  card.setAttribute('aria-labelledby', `ticket-heading-${ticket.orderId}`);
  const head = element('div', 'ticket-identity col-12 col-md-3 col-xl-2 p-3');
  const heading = element('h3', 'h5 mb-0');
  heading.id = `ticket-heading-${ticket.orderId}`;
  const selector = button(
    `Order #${ticket.orderId}`,
    () => selectTicket(ticket.orderId),
    `select-${ticket.orderId}`,
  );
  selector.className = 'btn ticket-selector p-0 text-start';
  selector.dataset.ticketSelect = ticket.orderId;
  selector.setAttribute('aria-pressed', String(ticket.orderId === selectedId));
  selector.onkeydown = (event) => {
    if (
      ![
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'Home',
        'End',
      ].includes(event.key)
    )
      return;
    const selectors = [
      ...document.querySelectorAll('[data-ticket-select]'),
    ].filter((node) => !node.closest('[hidden]'));
    const index = selectors.indexOf(selector);
    const target =
      event.key === 'Home'
        ? selectors[0]
        : event.key === 'End'
          ? selectors.at(-1)
          : selectors[
              (index +
                (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1) +
                selectors.length) %
                selectors.length
            ];
    event.preventDefault();
    target?.focus();
    target?.click();
  };
  heading.append(selector);
  const stage = element(
    'span',
    'visually-hidden',
    stageLabel(ticket.orderStatus),
  );
  head.append(heading);
  const body = element('div', 'ticket-items col-12 col-md-6 col-xl-7 p-3');
  const service = element('div', 'small fw-semibold mb-1 text-break');
  service.append(
    stage,
    element(
      'span',
      '',
      `${ticket.serviceType}${ticket.tableName ? ` · Table ${ticket.tableName}` : ''}`,
    ),
  );
  const time = element('div', 'ticket-clock mt-2');
  time.dataset.placed = Date.parse(`${ticket.orderDate.replace(' ', 'T')}Z`);
  time.dataset.entered = ticket.enteredAt;
  time.dataset.active = String(STAGES.includes(ticket.orderStatus));
  time.append(element('strong'), element('small'));
  head.append(
    service,
    element('p', 'small text-body-secondary mb-0', ticket.customerName),
    time,
  );
  const list = element('ul', 'list-unstyled mb-0');
  for (const item of ticket.items) {
    const row = element('li', 'd-flex gap-3 mb-2');
    const description = element('div', 'flex-grow-1');
    description.append(
      element(
        'span',
        'ticket-product fw-bold d-block',
        `${item.size} ${item.itemName}`,
      ),
    );
    const details = item.toppings.map((topping) =>
      toppingLabel(topping.toppingName, topping.quantity),
    );
    if (details.length)
      description.append(element('span', 'd-block', details.join(', ')));
    if (item.itemName === 'Pizza') {
      const modified = item.sauce !== 'Regular' || item.cheese !== 'Regular';
      description.append(
        element(
          'span',
          modified
            ? 'd-block fw-semibold text-danger-emphasis'
            : 'd-block small text-body-secondary',
          preferenceLabel(item.sauce, item.cheese),
        ),
      );
    }
    row.append(
      element('span', 'ticket-quantity fw-bold', `${item.quantity}\u00d7`),
      description,
    );
    list.append(row);
  }
  body.append(list);
  if (ticket.notes)
    body.append(
      element(
        'p',
        'ticket-note border-start border-warning border-3 ps-2 my-2 fw-semibold text-break',
        `Kitchen notes: ${ticket.notes}`,
      ),
    );
  if (ticket.lastReason)
    body.append(
      element('p', 'fw-semibold', `Last change: ${ticket.lastReason}`),
    );
  const contact = element('details', 'small text-body-secondary');
  const contactSummary = element(
    'summary',
    'py-2',
    'Contact and order details',
  );
  contactSummary.id = `contact-${ticket.orderId}`;
  contact.open = expandedContacts.has(ticket.orderId);
  let activityLoaded = false;
  const activity = element('div', 'mt-2 text-break');
  activity.setAttribute('aria-label', 'Order activity');
  contact.ontoggle = async () => {
    if (contact.open) {
      expandedContacts.add(ticket.orderId);
      if (activityLoaded) return;
      activityLoaded = true;
      activity.textContent = 'Loading order activity…';
      try {
        const events = await apiRequest(
          `employee/orders/${ticket.orderId}/activity`,
        );
        const list = element('ol', 'ps-3 mb-2');
        for (const event of events) {
          const actions = {
            Created: 'Received',
            Imported: 'Imported',
            advance: 'Advanced',
            recall: 'Recalled',
            cancel: 'Cancelled',
          };
          const row = element('li', 'mb-2');
          const time = element(
            'time',
            '',
            new Date(event.occurredAt).toLocaleString(),
          );
          time.dateTime = new Date(event.occurredAt).toISOString();
          row.append(
            time,
            ` · ${actions[event.action] || event.action}: ${stageLabel(event.stage)} · ${event.employeeName}${event.reason ? ` · ${event.reason}` : ''}`,
          );
          list.append(row);
        }
        activity.replaceChildren(
          element('h4', 'h6 mt-2', 'Order activity'),
          list,
        );
      } catch (error) {
        activityLoaded = false;
        activity.textContent = `${error.message} Close and reopen details to retry.`;
      }
    } else expandedContacts.delete(ticket.orderId);
  };
  contact.append(contactSummary);
  contact.append(
    element(
      'p',
      'mb-2',
      `${ticket.source} · ${currency.format(ticket.totalCents / 100)}`,
    ),
  );
  if (ticket.phoneNumber) {
    const phone = element('a', 'd-inline-block py-2', ticket.phoneNumber);
    phone.href = `tel:${ticket.phoneNumber.replace(/[^0-9+]/g, '')}`;
    contact.append(phone);
  }
  contact.append(activity);
  body.append(contact);
  const actions = element(
    'div',
    'ticket-actions col-12 col-md-3 p-3 d-flex flex-column justify-content-center gap-2',
  );
  const secondaryActions = element(
    'div',
    'd-flex flex-wrap justify-content-center gap-2',
  );
  const addAction = (label, action, primary = false) => {
    const node = button(
      label,
      () =>
        action === 'cancel' ? openCancellation(ticket) : mutate(ticket, action),
      `${action}-${ticket.orderId}`,
    );
    node.className = primary
      ? 'btn btn-primary fw-semibold w-100'
      : `btn btn-link ${action === 'cancel' ? 'text-danger' : 'text-body-secondary'} text-decoration-none px-2`;
    node.dataset.mutation = '';
    node.disabled = !connected || changing;
    (primary ? actions : secondaryActions).append(node);
  };
  const label = advanceLabel(ticket.orderStatus, ticket.hasPizza);
  if (label) addAction(label, 'advance', true);
  if (ticket.orderStatus !== 'Pending') addAction('Recall', 'recall');
  if (STAGES.includes(ticket.orderStatus)) addAction('Cancel order', 'cancel');
  if (secondaryActions.childElementCount) actions.append(secondaryActions);
  card.append(head, body, actions);
  return card;
}
function updateClocks() {
  document.querySelectorAll('[data-placed]').forEach((node) => {
    const active = node.dataset.active === 'true';
    const now = active
      ? Date.now() + clockOffset
      : Number(node.dataset.entered);
    const age = Math.max(
      0,
      Math.floor((now - Number(node.dataset.placed)) / 60000),
    );
    const stageAge = Math.max(
      0,
      Math.floor((now - Number(node.dataset.entered)) / 60000),
    );
    const cue =
      active && age >= overdue
        ? 'Overdue'
        : active && age >= warning
          ? 'Aging'
          : active
            ? 'On track'
            : 'Closed';
    node.querySelector('strong').textContent = `${age} min`;
    node.querySelector('small').textContent = active
      ? `${cue} · ${stageAge} min in stage`
      : 'Closed · Total time';
    node.className = `ticket-clock mt-2 ${cue === 'Overdue' ? 'text-danger-emphasis' : cue === 'Aging' ? 'text-warning-emphasis' : 'text-body'}`;
  });
}
function renderLane(stage, result) {
  const parent =
    view === 'history' ? $('#historyOrders') : $(`[data-lane="${stage}"]`);
  const signature = JSON.stringify({
    orders: result.orders,
    total: result.total,
    page: result.page,
    pages: result.pages,
  });
  if (
    snapshots.get(stage) === signature &&
    parent.dataset.stage === stage &&
    parent.childElementCount
  )
    return;
  parent.dataset.stage = stage;
  snapshots.set(stage, signature);
  parent.replaceChildren();
  const heading = element(
    'h2',
    'lane-heading h6 fw-bold d-flex align-items-center gap-2 mb-2',
  );
  heading.append(
    element('span', '', stageLabel(stage)),
    element('span', 'text-body-secondary fw-normal', String(result.total)),
  );
  parent.append(heading);
  if (!result.orders.length)
    parent.append(
      element(
        'p',
        'small text-body-secondary py-2 mb-0',
        `No ${stageLabel(stage).toLowerCase()} orders.`,
      ),
    );
  for (const ticket of result.orders) parent.append(ticketCard(ticket));
  const pagination = element(
    'div',
    'd-flex flex-wrap align-items-center gap-2 mb-3',
  );
  pagination.append(
    element(
      'span',
      'small',
      `Page ${result.page} of ${result.pages}  -  ${result.total} orders`,
    ),
  );
  const previous = button('Previous page', () => {
    pages[stage] = result.page - 1;
    snapshots.delete(stage);
    loadOrders();
  });
  previous.disabled = result.page <= 1;
  const next = button('Next page', () => {
    pages[stage] = result.page + 1;
    snapshots.delete(stage);
    loadOrders();
  });
  next.disabled = result.page >= result.pages;
  if (result.pages > 1) pagination.append(previous, next);
  if (result.pages > 1) parent.append(pagination);
  pages[stage] = result.page;
}
for (const stage of STAGES) {
  const lane = element('section', 'kitchen-lane mb-4');
  lane.dataset.lane = stage;
  lane.setAttribute('aria-label', `${stageLabel(stage)} orders`);
  $('#employeeOrders').append(lane);
  const filter = button(`${stageLabel(stage)} `, () => filterStages(stage));
  filter.className = 'btn stage-filter px-3';
  filter.dataset.stageFilter = stage;
  filter.setAttribute('aria-pressed', 'false');
  const count = element('span', 'ms-2', '0');
  count.dataset.stageCount = stage;
  filter.append(count);
  $('#stageFilters').append(filter);
}
function filterStages(stage) {
  stageFilter = stage;
  document.querySelectorAll('[data-stage-filter]').forEach((node) => {
    node.setAttribute(
      'aria-pressed',
      String(node.dataset.stageFilter === stage),
    );
  });
  document.querySelectorAll('[data-lane]').forEach((lane) => {
    lane.hidden = stage !== 'all' && lane.dataset.lane !== stage;
  });
}
$('[data-stage-filter="all"]').onclick = () => filterStages('all');
async function loadOrders() {
  if (stopped || loading || document.hidden) return;
  clearTimeout(timer);
  loading = true;
  $('#refreshOrders').disabled = true;
  const activeElement = document.activeElement;
  const focusId = activeElement?.id;
  const wasTicketFocused = Boolean(activeElement?.closest('article'));
  const requestView = view;
  const requestVersion = queueVersion;
  try {
    const stages =
      requestView === 'history' ? [$('#historyStage').value] : STAGES;
    const results = await Promise.all(
      stages.map((stage) =>
        apiRequest(
          `employee/kitchen?status=${encodeURIComponent(stage)}&page=${pages[stage]}&search=${encodeURIComponent(requestView === 'history' ? historySearch : '')}&queue=${requestView === 'history' ? 'all' : requestView === 'timed-out' ? 'timed-out' : 'active'}&timeoutMinutes=${timeoutMinutes}&sort=${requestView === 'history' ? 'newest' : queueSort}`,
        ),
      ),
    );
    if (stopped || view !== requestView || queueVersion !== requestVersion)
      return;
    clockOffset = results[0].serverTime - Date.now();
    lastSuccess = Date.now();
    setConnection(true);
    if (view !== 'entry')
      results.forEach((result, index) => renderLane(stages[index], result));
    const counts = results[0].counts;
    $('#timedOutCount').textContent = results[0].timedOutCount || 0;
    document.querySelectorAll('[data-stage-count]').forEach((node) => {
      node.textContent =
        node.dataset.stageCount === 'all'
          ? STAGES.reduce((sum, stage) => sum + (counts[stage] || 0), 0)
          : counts[node.dataset.stageCount] || 0;
    });
    const newest = results[0].newestOrderId;
    const countSignature = JSON.stringify(counts);
    if (
      seenNewest !== undefined &&
      newest > seenNewest &&
      requestView !== 'history'
    ) {
      chime();
      message('New kitchen order received.');
    } else if (snapshots.get('counts') !== countSignature)
      message(
        `${STAGES.reduce((sum, stage) => sum + (counts[stage] || 0), 0)} ${view === 'timed-out' ? 'timed-out' : 'active'} orders. Kitchen updated.`,
      );
    snapshots.set('counts', countSignature);
    if (requestView !== 'history')
      seenNewest = Math.max(seenNewest || 0, newest);
    updateClocks();
    selectTicket(selectedId);
    if (wasTicketFocused && !activeElement.isConnected)
      ticketFocusTarget(focusId).focus();
  } catch (error) {
    if (error.status === 401) {
      stop();
      window.location.replace('./employee-login.html');
      return;
    }
    setConnection(false);
    if (!lastSuccess) message(error.message);
  } finally {
    loading = false;
    $('#employeeOrders').setAttribute('aria-busy', 'false');
    $('#refreshOrders').disabled = stopped;
    if (!stopped) timer = setTimeout(loadOrders, 2000);
  }
}
function stop() {
  stopped = true;
  clearTimeout(timer);
  connected = false;
}
async function mutate(ticket, action, reason = '') {
  if (!connected || changing || stopped) return;
  changing = true;
  setConnection(true);
  message('Saving kitchen change - ');
  try {
    const updated = await apiRequest(
      `employee/orders/${ticket.orderId}/status`,
      {
        method: 'POST',
        body: JSON.stringify({
          action,
          expectedRevision: ticket.revision,
          reason,
        }),
      },
    );
    if (stopped) return;
    message(`Order #${ticket.orderId}: ${stageLabel(updated.orderStatus)}.`);
    $('#cancelDialog').close();
    selectedId = ticket.orderId;
  } catch (error) {
    if (error.status === 401) {
      stop();
      window.location.replace('./employee-login.html');
      return;
    }
    if (error.status === 409) $('#cancelDialog').close();
    else if ($('#cancelDialog').open)
      $('#cancelError').textContent = error.message;
    message(
      `${error.message} Refreshing the saved ticket before another action.`,
    );
    if (!error.status) setConnection(false);
  } finally {
    changing = false;
    // A failed response may still have committed; always reread authoritative revisions.
    await waitForLoad();
    await loadOrders();
    setConnection(connected);
    if (!$('#cancelDialog').open)
      ticketFocusTarget(
        `advance-${ticket.orderId}`,
        `recall-${ticket.orderId}`,
      ).focus();
  }
}
async function waitForLoad() {
  while (loading && !stopped)
    await new Promise((resolve) => setTimeout(resolve, 25));
}
function openCancellation(ticket) {
  cancelTicket = ticket;
  $('#cancelTitle').textContent = `Cancel order #${ticket.orderId}`;
  $('#cancelDescription').textContent =
    'This removes the ticket from the active kitchen. A reason is recorded; no payment or refund is processed.';
  $('#cancelReason').value = '';
  $('#cancelError').textContent = '';
  $('#cancelDialog').showModal();
  $('#cancelReason').focus();
}
$('#keepOrder').onclick = () => $('#cancelDialog').close();
$('#cancelForm').onsubmit = (event) => {
  event.preventDefault();
  if (!$('#cancelReason').value.trim()) {
    $('#cancelError').textContent = 'Enter a cancellation reason.';
    return;
  }
  mutate(cancelTicket, 'cancel', $('#cancelReason').value);
};
$('#refreshOrders').onclick = loadOrders;
$('#historyForm').onsubmit = (event) => {
  event.preventDefault();
  historySearch = $('#historySearch').value;
  pages[$('#historyStage').value] = 1;
  snapshots.delete($('#historyStage').value);
  loadOrders();
};
async function showView(nextView) {
  view = nextView;
  queueVersion += 1;
  for (const stage of STAGES) pages[stage] = 1;
  snapshots.clear();
  for (const name of ['board', 'entry', 'history', 'accounts'])
    $(`#${name}View`).hidden = name !== (view === 'timed-out' ? 'board' : view);
  document.querySelectorAll('[data-view]').forEach((node) => {
    const active = node.dataset.view === view;
    node.setAttribute('aria-pressed', String(active));
  });
  $('#workspaceTitle').textContent = {
    board: 'Kitchen board',
    'timed-out': 'Timed-out orders',
    history: 'Order history',
    entry: 'New staff order',
    accounts: 'Staff accounts',
  }[view];
  if (view === 'board' || view === 'timed-out') filterStages(stageFilter);
  describeQueue();
  await waitForLoad();
  await loadOrders();
}
document
  .querySelectorAll('[data-view]')
  .forEach((node) => (node.onclick = () => showView(node.dataset.view)));
$('#employeeLogout').onclick = async () => {
  stop();
  setConnection(false);
  $('#employeeLogout').disabled = true;
  try {
    await apiRequest('employee/auth/logout', { method: 'POST', body: '{}' });
    window.location.replace('./employee-login.html');
  } catch (error) {
    stopped = false;
    $('#employeeLogout').disabled = false;
    message(error.message);
    loadOrders();
  }
};
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) loadOrders();
  else clearTimeout(timer);
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) loadOrders();
});
window.addEventListener('online', loadOrders);
setInterval(updateClocks, 10000);
try {
  const { employee } = await apiRequest('employee/auth/session');
  if (!employee) {
    stop();
    window.location.replace('./employee-login.html');
  } else {
    $('#employeeIdentity').textContent =
      `Signed in as ${employee.displayName} (${employee.role}).`;
    if (employee.role === 'admin') {
      $('#staffAccountsButton').hidden = false;
      const { setupStaffAccounts } = await import('./employee-accounts.js');
      setupStaffAccounts();
    }
    await loadOrders();
    const { setupStaffOrder } = await import('./employee-entry.js');
    await setupStaffOrder(employee, async (orderId) => {
      message(`Order #${orderId} sent to kitchen.`);
      filterStages('all');
      await showView('board');
      document.getElementById(`select-${orderId}`)?.focus();
    });
  }
} catch (error) {
  message(error.message);
}
