// Frontend demo only: selections live in memory, with no server or database.
const cart = new Map();
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const menuCards = document.querySelectorAll('[data-category]');
const filterButtons = document.querySelectorAll('[data-filter]');
const cartItems = document.querySelector('#cartItems');
const clearButton = document.querySelector('#clearOrder');
const cartAnnouncement = document.querySelector('#cartAnnouncement');

function formatPrice(priceCents) {
  return currency.format(priceCents / 100);
}

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const category = button.dataset.filter;
    let visibleCount = 0;

    menuCards.forEach((card) => {
      const isVisible = category === 'all' || card.dataset.category === category;
      card.classList.toggle('d-none', !isVisible);
      if (isVisible) {
        visibleCount += 1;
      }
    });

    filterButtons.forEach((filter) => {
      const isActive = filter === button;
      filter.classList.toggle('btn-primary', isActive);
      filter.classList.toggle('btn-outline-primary', !isActive);
      filter.setAttribute('aria-pressed', String(isActive));
    });
    document.querySelector('#menuStatus').textContent = `Showing ${visibleCount} sample menu ${visibleCount === 1 ? 'item' : 'items'}.`;
  });
});

document.querySelectorAll('[data-item]').forEach((button) => {
  button.addEventListener('click', () => {
    const drinkType = button.dataset.drinkSize ? document.querySelector('#drinkType').value : '';
    const itemId = drinkType ? `${button.dataset.item}-${drinkType}` : button.dataset.item;
    const itemName = drinkType ? `${button.dataset.drinkSize} ${drinkType}` : button.dataset.name || button.closest('article').querySelector('h3').textContent;
    const priceCents = Number(button.dataset.price);
    const quantity = (cart.get(itemId)?.quantity || 0) + 1;

    if (quantity > 20) {
      cartAnnouncement.textContent = `Maximum 20 ${itemName} per order.`;
      return;
    }
    cart.set(itemId, { itemName, priceCents, quantity });
    renderCart();
    // Visible and screen-reader feedback without opening the drawer every time.
    button.firstChild.textContent = `Added (${quantity}) · Add another `;
    cartAnnouncement.textContent = `${itemName} added. ${quantity} in your order.`;
  });
});

function renderCart() {
  cartItems.replaceChildren();
  let itemCount = 0;
  let subtotalCents = 0;

  for (const item of cart.values()) {
    itemCount += item.quantity;
    subtotalCents += item.priceCents * item.quantity;
    const row = document.createElement('div');
    row.className = 'border-bottom py-3 d-flex justify-content-between gap-3';
    const name = document.createElement('span');
    name.textContent = `${item.quantity} × ${item.itemName}`;
    const price = document.createElement('span');
    price.className = 'fw-semibold text-nowrap';
    price.textContent = formatPrice(item.priceCents * item.quantity);
    row.append(name, price);
    cartItems.append(row);
  }

  if (cart.size === 0) {
    const message = document.createElement('p');
    message.className = 'text-body-secondary py-4 text-center';
    message.textContent = 'Your order is waiting for its first slice. Add something from the menu!';
    cartItems.append(message);
  }
  document.querySelector('#cartCount').textContent = itemCount;
  document.querySelector('#cartSubtotal').textContent = formatPrice(subtotalCents);
  clearButton.disabled = itemCount === 0;
}

clearButton.addEventListener('click', () => {
  cart.clear();
  renderCart();
  document.querySelectorAll('[data-item]').forEach((button) => {
    button.firstChild.textContent = 'Add to order ';
  });
  document.querySelector('#orderDrawer .btn-close').focus();
  cartAnnouncement.textContent = 'Your order has been cleared.';
});
