import { apiRequest } from './api.js';
import { currency } from './cart.js';
import { toppingLabel, preferenceLabel } from './pizza-options.js';
import { focusMessage } from './form-validation.js';

const ordersRegion = document.querySelector('#employeeOrders');
const status = document.querySelector('#employeeStatus');
const refreshButton = document.querySelector('#refreshOrders');
const logoutButton = document.querySelector('#employeeLogout');
let isLoggingOut = false;

function renderOrders(orders) {
  ordersRegion.replaceChildren();
  if (!orders.length) {
    const empty = document.createElement('p');
    empty.className = 'border rounded p-4 text-body-secondary';
    empty.textContent = 'No pending orders right now.';
    ordersRegion.append(empty);
  }
  orders.forEach((order) => {
    const article = document.createElement('article');
    article.className = 'card mb-4';
    const body = document.createElement('div');
    body.className = 'card-body p-4';
    const heading = document.createElement('h2');
    heading.className = 'h4';
    heading.id = `employee-order-${order.orderId}`;
    heading.textContent = `Order #${order.orderId} · ${order.orderStatus} · ${currency.format(order.totalCents / 100)}`;
    article.setAttribute('aria-labelledby', heading.id);
    const customer = document.createElement('p');
    customer.className = 'fw-semibold mb-2';
    customer.textContent = `${order.customerName} · ${order.serviceType || 'Service not recorded'}`;
    const contact = document.createElement('p');
    contact.append(document.createTextNode('Phone: '));
    const phone = document.createElement('a');
    phone.href = `tel:${order.phoneNumber.replace(/[^\d+]/g, '')}`;
    phone.textContent = order.phoneNumber;
    contact.append(phone);
    const date = document.createElement('p');
    date.className = 'small text-body-secondary';
    date.textContent = `Placed ${new Date(order.orderDate.replace(' ', 'T') + 'Z').toLocaleString()}`;
    const items = document.createElement('ul');
    items.className = 'mb-0';
    order.items.forEach((item) => {
      const row = document.createElement('li');
      row.className = 'py-1';
      const details = item.toppings.map((topping) =>
        toppingLabel(topping.toppingName, topping.quantity),
      );
      if (item.itemName === 'Pizza')
        details.push(preferenceLabel(item.sauce, item.cheese));
      row.textContent = `${item.quantity} × ${item.size} ${item.itemName}${details.length ? ` — ${details.join(', ')}` : ''}`;
      items.append(row);
    });
    body.append(heading, customer, contact, date, items);
    article.append(body);
    ordersRegion.append(article);
  });
}

async function loadOrders() {
  refreshButton.disabled = true;
  ordersRegion.setAttribute('aria-busy', 'true');
  status.textContent = 'Loading pending orders…';
  try {
    const { employee } = await apiRequest('employee/auth/session');
    if (!employee) {
      ordersRegion.replaceChildren();
      window.location.replace('./employee-login.html');
      return;
    }
    document.querySelector('#employeeIdentity').textContent =
      `Signed in as ${employee.displayName}.`;
    const orders = await apiRequest('employee/orders');
    if (isLoggingOut) return;
    renderOrders(orders);
    status.textContent = `${orders.length} pending ${orders.length === 1 ? 'order' : 'orders'} shown. Updated ${new Date().toLocaleTimeString()}.`;
  } catch (error) {
    ordersRegion.replaceChildren();
    if (error.status === 401) {
      window.location.replace('./employee-login.html');
      return;
    }
    status.textContent = `${error.message} Use Refresh orders to try again.`;
    focusMessage(status);
  } finally {
    ordersRegion.setAttribute('aria-busy', 'false');
    refreshButton.disabled = isLoggingOut;
  }
}

refreshButton.addEventListener('click', loadOrders);
logoutButton.addEventListener('click', async () => {
  isLoggingOut = true;
  logoutButton.disabled = true;
  refreshButton.disabled = true;
  ordersRegion.replaceChildren();
  status.textContent = 'Logging out…';
  try {
    await apiRequest('employee/auth/logout', { method: 'POST', body: '{}' });
    window.location.replace('./employee-login.html');
  } catch (error) {
    isLoggingOut = false;
    logoutButton.disabled = false;
    refreshButton.disabled = false;
    status.textContent = error.message;
    focusMessage(status);
  }
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted) loadOrders();
});
await loadOrders();
