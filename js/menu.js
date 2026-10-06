// Frontend preview only; no order submission or persistence.
const pizzaForm = document.querySelector('#pizzaForm');
const orderItems = document.querySelector('#orderItems');
const orderAnnouncement = document.querySelector('#orderAnnouncement');
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const pizzaSizes = {
  small: { name: 'Small Pizza', priceCents: 500 },
  medium: { name: 'Medium Pizza', priceCents: 700 },
  large: { name: 'Large Pizza', priceCents: 900 },
};
const demoOrder = [];

pizzaForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const quantityInput = document.querySelector('#pizzaQuantity');
  const quantity = Number(quantityInput.value);
  if (!quantityInput.reportValidity() || !Number.isSafeInteger(quantity) || quantity < 1) {
    orderAnnouncement.textContent = 'Enter a positive whole-number quantity.';
    quantityInput.focus();
    return;
  }
  const pizza = pizzaSizes[document.querySelector('#pizzaSize').value];
  const toppings = [...pizzaForm.querySelectorAll('[name="topping"]:checked')]
    .map((input) => input.value);
  const basePriceCents = pizza.priceCents * quantity;
  const currentSubtotal = demoOrder.reduce((sum, item) => sum + item.basePriceCents, 0);
  if (!Number.isSafeInteger(currentSubtotal + basePriceCents)) {
    orderAnnouncement.textContent = 'This quantity is too large to calculate. Enter a smaller quantity.';
    quantityInput.focus();
    return;
  }
  demoOrder.push({ name: pizza.name, quantity, toppings, basePriceCents });
  renderOrder();
  orderAnnouncement.textContent = `${quantity} × ${pizza.name} added to your demo order.`;
});

function renderOrder() {
  orderItems.replaceChildren();
  demoOrder.forEach((item, index) => {
    const row = document.createElement('li');
    row.className = 'border-bottom py-3';
    const heading = document.createElement('p');
    heading.className = 'fw-semibold mb-1';
    heading.textContent = `${item.quantity} × ${item.name}`;
    const toppings = document.createElement('p');
    toppings.className = 'text-body-secondary mb-2';
    toppings.textContent = item.toppings.length ? item.toppings.join(', ') : 'Plain pizza';
    const footer = document.createElement('div');
    footer.className = 'd-flex justify-content-between align-items-center gap-3';
    const price = document.createElement('span');
    price.textContent = `Base price: ${currency.format(item.basePriceCents / 100)}`;
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'btn btn-outline-danger py-2';
    removeButton.textContent = 'Remove';
    removeButton.setAttribute('aria-label', `Remove pizza ${index + 1}: ${item.quantity} × ${item.name}`);
    removeButton.addEventListener('click', () => {
      demoOrder.splice(index, 1);
      renderOrder();
      const remainingButtons = orderItems.querySelectorAll('button');
      (remainingButtons[Math.min(index, remainingButtons.length - 1)]
        || pizzaForm.querySelector('[type="submit"]')).focus();
      orderAnnouncement.textContent = `${item.name} removed from your demo order.`;
    });
    footer.append(price, removeButton);
    row.append(heading, toppings, footer);
    orderItems.append(row);
  });
  if (!demoOrder.length) {
    const emptyMessage = document.createElement('li');
    emptyMessage.className = 'text-body-secondary py-3';
    emptyMessage.textContent = 'No pizzas added yet. Choose a size, toppings, and quantity above.';
    orderItems.append(emptyMessage);
  }
  const subtotalCents = demoOrder.reduce((sum, item) => sum + item.basePriceCents, 0);
  document.querySelector('#baseSubtotal').textContent = currency.format(subtotalCents / 100);
}

renderOrder();
