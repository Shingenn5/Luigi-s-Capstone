import { apiRequest } from './api.js';
import { toppingLabel, preferenceLabel } from './pizza-options.js';
import { readCart, writeCart, describeItem, currency } from './cart.js';

const orderItems = document.querySelector('#orderItems');
const status = document.querySelector('#orderStatus');
const checkoutForm = document.querySelector('#checkoutForm');
const checkoutFields = document.querySelector('#checkoutFields');
const clearButton = document.querySelector('#clearOrder');
let cart = readCart();
let menu = [];
let toppings = [];
let customer = null;
let isSubmitting = false;
let cartValid = false;

function renderOrder() {
  orderItems.replaceChildren();
  cartValid = false;
  let subtotalCents = 0;
  try {
    cart.items.forEach((item, index) => {
      const description = describeItem(item, menu, toppings);
      subtotalCents += description.lineTotalCents;
      const row = document.createElement('li');
      row.className = 'border-bottom py-3';
      const heading = document.createElement('h3');
      heading.className = 'h5';
      heading.textContent = `${item.quantity} × ${description.name}`;
      const details = document.createElement('p');
      details.className = 'text-body-secondary';
      details.textContent =
        description.toppingNames ||
        (description.name.includes('Pizza')
          ? 'Marinara and cheese'
          : 'No extra ingredients');
      const footer = document.createElement('div');
      footer.className = 'd-flex flex-wrap align-items-center gap-3';
      const label = document.createElement('label');
      label.className = 'form-label mb-0';
      label.htmlFor = `quantity-${index}`;
      label.textContent = 'Quantity';
      const input = document.createElement('input');
      input.className = 'form-control w-auto';
      input.type = 'number';
      input.id = label.htmlFor;
      input.required = true;
      input.min = 1;
      input.max = 20;
      input.value = item.quantity;
      input.setAttribute('aria-label', `${description.name} quantity`);
      input.addEventListener('input', () => {
        checkoutFields.disabled = true;
      });
      input.addEventListener('change', () => {
        if (isSubmitting || !input.reportValidity()) return;
        try {
          cart = writeCart(
            cart.items.map((entry, itemIndex) =>
              itemIndex === index
                ? { ...entry, quantity: Number(input.value) }
                : entry,
            ),
          );
          renderOrder();
          document.querySelector(`#quantity-${index}`).focus();
        } catch (error) {
          status.textContent = error.message;
        }
      });
      const price = document.createElement('strong');
      price.className = 'ms-auto';
      price.textContent = currency.format(description.lineTotalCents / 100);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn btn-outline-primary py-2';
      remove.textContent = 'Remove';
      remove.setAttribute(
        'aria-label',
        `Remove item ${index + 1}: ${description.name}`,
      );
      remove.addEventListener('click', () => {
        if (isSubmitting) return;
        try {
          cart = writeCart(
            cart.items.filter((_, itemIndex) => itemIndex !== index),
          );
          renderOrder();
          (
            orderItems.querySelector('button') ||
            document.querySelector('a[href="./menu.html"]')
          ).focus();
          status.textContent = `${description.name} removed.`;
        } catch (error) {
          status.textContent = error.message;
        }
      });
      footer.append(label, input, price, remove);
      row.append(heading, details, footer);
      orderItems.append(row);
    });
    cartValid = true;
  } catch (error) {
    status.textContent = error.message;
    subtotalCents = 0;
  }
  if (!cart.items.length) {
    const empty = document.createElement('li');
    empty.className = 'text-body-secondary py-4';
    empty.textContent =
      'Your order is empty. Choose a pizza or drink from the menu.';
    orderItems.append(empty);
  }
  document.querySelector('#orderSubtotal').textContent = currency.format(
    subtotalCents / 100,
  );
  checkoutFields.disabled =
    !customer || !cart.items.length || !cartValid || isSubmitting;
  clearButton.disabled = !cart.items.length || isSubmitting;
}

async function renderHistory() {
  const history = document.querySelector('#orderHistory');
  try {
    const orders = await apiRequest('orders');
    history.replaceChildren();
    if (!orders.length) {
      history.textContent = 'No saved orders yet.';
    }
    orders.forEach((order) => {
      const article = document.createElement('article');
      article.className = 'card mb-3';
      const body = document.createElement('div');
      body.className = 'card-body';
      const heading = document.createElement('h3');
      heading.className = 'h5';
      heading.textContent = `Order #${order.orderId} · ${order.orderStatus} · ${currency.format(order.totalCents / 100)}`;
      const detail = document.createElement('p');
      detail.className = 'small text-body-secondary';
      detail.textContent = `${new Date(order.orderDate.replace(' ', 'T') + 'Z').toLocaleString()} · ${order.serviceType}`;
      const items = document.createElement('ul');
      order.items.forEach((item) => {
        const row = document.createElement('li');
        const selectedToppings = item.toppings
          .map((topping) => toppingLabel(topping.toppingName, topping.quantity))
          .join(', ');
        const preferences =
          item.itemName === 'Pizza'
            ? preferenceLabel(item.sauce, item.cheese)
            : '';
        const details = [selectedToppings, preferences]
          .filter(Boolean)
          .join(', ');
        row.textContent = `${item.quantity} × ${item.size} ${item.itemName}${details ? ` — ${details}` : ''}`;
        items.append(row);
      });
      body.append(heading, detail, items);
      article.append(body);
      history.append(article);
    });
  } catch (error) {
    history.textContent = `Could not load order history. ${error.message} Reload to try again.`;
  }
}

try {
  const [menuData, toppingData, session] = await Promise.all([
    apiRequest('menu'),
    apiRequest('toppings'),
    apiRequest('auth/session'),
  ]);
  menu = menuData;
  toppings = toppingData;
  customer = session.customer;
  if (customer) {
    document.querySelector('#accountStatus').textContent =
      `Logged in as ${customer.firstName}.`;
    document.querySelector('#customerName').value =
      `${customer.firstName} ${customer.lastName}`;
    await renderHistory();
  } else {
    document.querySelector('#accountStatus').innerHTML =
      'Please <a href="./login.html">log in or create an account</a> to save your order. Your draft will stay here.';
  }
  renderOrder();
} catch (error) {
  document.querySelector('#accountStatus').textContent = error.message;
}

clearButton.addEventListener('click', () => {
  try {
    cart = writeCart([]);
    renderOrder();
    status.textContent = 'Your draft order has been cleared.';
  } catch (error) {
    status.textContent = error.message;
  }
});

checkoutForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (isSubmitting || !cartValid || !customer || !cart.items.length) return;
  isSubmitting = true;
  checkoutFields.disabled = true;
  clearButton.disabled = true;
  orderItems.querySelectorAll('button, input').forEach((control) => {
    control.disabled = true;
  });
  status.textContent = 'Saving your order…';
  try {
    const result = await apiRequest('orders', {
      method: 'POST',
      body: JSON.stringify({
        customerName: document.querySelector('#customerName').value,
        phoneNumber: document.querySelector('#phoneNumber').value,
        serviceType: document.querySelector('#serviceType').value,
        requestId: cart.requestId,
        items: cart.items,
      }),
    });
    cart = writeCart([]);
    status.textContent = `Order #${result.orderId} saved as Pending. Restaurant acceptance and payment are not connected.`;
    await renderHistory();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    isSubmitting = false;
    renderOrder();
  }
});
