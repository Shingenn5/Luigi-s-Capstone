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
function theme(value) {
  document.documentElement.dataset.bsTheme = value;
  $('#themeToggle').textContent =
    value === 'dark' ? 'Use light mode' : 'Use dark mode';
}
theme(preference('luigis-kitchen-theme', 'dark'));
$('#themeToggle').onclick = () => {
  const value =
    document.documentElement.dataset.bsTheme === 'dark' ? 'light' : 'dark';
  theme(value);
  savePreference('luigis-kitchen-theme', value);
};
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
    ? `Live  -  updated ${new Date(lastSuccess).toLocaleTimeString()}`
    : `Connection interrupted. Actions paused. Last update: ${lastSuccess ? new Date(lastSuccess).toLocaleTimeString() : 'not yet connected'}.`;
  $('#connectionStatus').className = ok
    ? 'text-body-secondary mb-0'
    : 'text-warning-emphasis fw-bold mb-0';
  document
    .querySelectorAll('[data-mutation]')
    .forEach((button) => (button.disabled = !connected || changing));
}
function button(label, callback, id) {
  const node = element(
    'button',
    'btn btn-secondary border border-dark py-3',
    label,
  );
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
    node.closest('article').classList.toggle('border-primary', selected);
    node.closest('article').classList.toggle('border-3', selected);
  });
}
function ticketCard(ticket) {
  const card = element('article', 'card mb-3');
  card.id = `ticket-${ticket.orderId}`;
  card.setAttribute('aria-labelledby', `ticket-heading-${ticket.orderId}`);
  const head = element('div', 'card-header p-3');
  const heading = element('h3', 'h5 mb-2');
  heading.id = `ticket-heading-${ticket.orderId}`;
  const selector = button(
    `Order #${ticket.orderId}`,
    () => selectTicket(ticket.orderId),
    `select-${ticket.orderId}`,
  );
  selector.className =
    'btn btn-secondary border border-dark fw-bold fs-5 py-2 w-100 text-start';
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
  const stageColors = {
    Pending: 'bg-primary-subtle text-primary-emphasis',
    Preparing: 'bg-info-subtle text-info-emphasis',
    'In oven': 'bg-warning-subtle text-warning-emphasis',
    Ready: 'bg-success-subtle text-success-emphasis',
    Completed: 'bg-secondary-subtle text-secondary-emphasis',
    Cancelled: 'bg-danger-subtle text-danger-emphasis',
  };
  const stage = element(
    'span',
    `badge ${stageColors[ticket.orderStatus] || 'text-bg-secondary'}`,
    stageLabel(ticket.orderStatus),
  );
  head.append(heading, stage);
  const body = element('div', 'card-body p-3');
  body.append(
    element('p', 'fw-bold mb-1', ticket.customerName),
    element(
      'p',
      'small mb-2',
      `${ticket.serviceType}  -  ${ticket.source}${ticket.tableName ? `  -  Table ${ticket.tableName}` : ''}`,
    ),
  );
  if (ticket.phoneNumber) {
    const phone = element('a', 'd-block mb-2', ticket.phoneNumber);
    phone.href = `tel:${ticket.phoneNumber.replace(/[^0-9+]/g, '')}`;
    body.append(phone);
  }
  const list = element('ul', 'ps-3 mb-3');
  for (const item of ticket.items) {
    const row = element('li', 'mb-3');
    row.append(
      element(
        'span',
        'fw-bold d-block',
        `${item.quantity} \u00d7 ${item.size} ${item.itemName}`,
      ),
    );
    const details = item.toppings.map((topping) =>
      toppingLabel(topping.toppingName, topping.quantity),
    );
    if (item.itemName === 'Pizza')
      details.push(preferenceLabel(item.sauce, item.cheese));
    if (details.length)
      row.append(element('span', 'd-block', details.join(', ')));
    list.append(row);
  }
  body.append(list);
  if (ticket.notes)
    body.append(
      element(
        'p',
        'border-start border-3 border-warning ps-2 fw-semibold',
        `Kitchen notes: ${ticket.notes}`,
      ),
    );
  if (ticket.lastReason)
    body.append(
      element('p', 'fw-semibold', `Last change: ${ticket.lastReason}`),
    );
  body.append(element('p', 'mb-2', currency.format(ticket.totalCents / 100)));
  const time = element('p', 'small mb-0');
  time.dataset.placed = Date.parse(`${ticket.orderDate.replace(' ', 'T')}Z`);
  time.dataset.entered = ticket.enteredAt;
  time.dataset.active = String(STAGES.includes(ticket.orderStatus));
  body.append(time);
  const actions = element('div', 'card-footer d-grid gap-2 p-3');
  const addAction = (label, action, primary = false) => {
    const node = button(
      label,
      () =>
        action === 'cancel' ? openCancellation(ticket) : mutate(ticket, action),
      `${action}-${ticket.orderId}`,
    );
    if (primary) node.className = 'btn btn-primary py-3 fw-bold';
    node.dataset.mutation = '';
    node.disabled = !connected || changing;
    actions.append(node);
  };
  const label = advanceLabel(ticket.orderStatus, ticket.hasPizza);
  if (label) addAction(label, 'advance', true);
  if (ticket.orderStatus !== 'Pending') addAction('Recall', 'recall');
  if (STAGES.includes(ticket.orderStatus)) addAction('Cancel order', 'cancel');
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
    node.textContent = `${cue}  -  ${age} min since placed  -  ${stageAge} min since stage change`;
    node.className = `small mb-0 ${cue === 'Overdue' ? 'text-danger-emphasis fw-bold' : cue === 'Aging' ? 'text-warning-emphasis fw-bold' : 'text-body-secondary'}`;
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
  parent.append(
    element(
      'h2',
      'h4 d-flex flex-wrap gap-2 align-items-center mb-3',
      `${stageLabel(stage)}  -  ${result.total}`,
    ),
  );
  if (!result.orders.length)
    parent.append(
      element(
        'p',
        'border rounded p-3 bg-body text-body-secondary',
        `No ${stageLabel(stage).toLowerCase()} orders right now.`,
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
  parent.append(pagination);
  pages[stage] = result.page;
}
for (const stage of STAGES) {
  const lane = element('section', 'col-12 col-lg-6 col-xxl-3');
  lane.dataset.lane = stage;
  lane.setAttribute('aria-label', `${stageLabel(stage)} orders`);
  $('#employeeOrders').append(lane);
}
async function loadOrders() {
  if (stopped || loading || document.hidden) return;
  clearTimeout(timer);
  loading = true;
  $('#refreshOrders').disabled = true;
  const activeElement = document.activeElement;
  const focusId = activeElement?.id;
  const wasTicketFocused = Boolean(activeElement?.closest('article'));
  const requestView = view;
  try {
    const stages =
      requestView === 'history' ? [$('#historyStage').value] : STAGES;
    const results = await Promise.all(
      stages.map((stage) =>
        apiRequest(
          `employee/kitchen?status=${encodeURIComponent(stage)}&page=${pages[stage]}&search=${encodeURIComponent(requestView === 'history' ? historySearch : '')}`,
        ),
      ),
    );
    if (stopped || view !== requestView) return;
    clockOffset = results[0].serverTime - Date.now();
    lastSuccess = Date.now();
    setConnection(true);
    if (view !== 'entry')
      results.forEach((result, index) => renderLane(stages[index], result));
    const counts = results[0].counts;
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
        `${STAGES.reduce((sum, stage) => sum + (counts[stage] || 0), 0)} active orders. Kitchen updated.`,
      );
    snapshots.set('counts', countSignature);
    if (requestView !== 'history')
      seenNewest = Math.max(seenNewest || 0, newest);
    updateClocks();
    selectTicket(selectedId);
    if (wasTicketFocused && !activeElement.isConnected)
      (
        document.getElementById(focusId) ||
        document.querySelector('[data-ticket-select]')
      )?.focus();
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
      (
        document.getElementById(`advance-${ticket.orderId}`) ||
        document.getElementById(`recall-${ticket.orderId}`) ||
        document.querySelector('[data-ticket-select]') ||
        $('#workspaceTitle')
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
  for (const name of ['board', 'entry', 'history', 'accounts'])
    $(`#${name}View`).hidden = name !== view;
  document.querySelectorAll('[data-view]').forEach((node) => {
    const active = node.dataset.view === view;
    node.setAttribute('aria-pressed', String(active));
    node.className = `btn ${active ? 'btn-primary' : 'btn-secondary border border-dark'} px-3 py-3`;
  });
  $('#workspaceTitle').textContent = {
    board: 'Kitchen board',
    history: 'Order history',
    entry: 'New staff order',
    accounts: 'Staff accounts',
  }[view];
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
      await showView('board');
      document.getElementById(`select-${orderId}`)?.focus();
    });
  }
} catch (error) {
  message(error.message);
}
