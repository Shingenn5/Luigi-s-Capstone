import {
  pizzaPreferences,
  toppingLabel,
  preferenceLabel,
} from './pizza-options.js';

const CART_KEY = 'luigis-order-v1';
function createRequestId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // LAN demos over HTTP still have getRandomValues, but not randomUUID.
  return [...crypto.getRandomValues(new Uint8Array(16))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
export const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export function readCart() {
  try {
    const cart = JSON.parse(localStorage.getItem(CART_KEY));
    if (
      Array.isArray(cart?.items) &&
      cart.items.length <= 20 &&
      typeof cart.requestId === 'string'
    )
      return cart;
  } catch {
    // An invalid saved draft should not prevent starting a new order.
  }
  return { items: [], requestId: createRequestId() };
}

export function writeCart(items) {
  const cart = { items, requestId: createRequestId() };
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    throw new Error(
      'Your browser could not save this order. Allow site storage and try again.',
    );
  }
  return cart;
}

export function addItem(item) {
  const cart = readCart();
  if (cart.items.length >= 20)
    throw new Error('Maximum 20 items. Review your order to remove an item.');
  writeCart([...cart.items, item]);
}

export function describeItem(item, menu, toppings) {
  const menuItem = menu.find((entry) => entry.menuItemId === item?.menuItemId);
  if (
    !menuItem ||
    !Number.isInteger(item.quantity) ||
    item.quantity < 1 ||
    item.quantity > 20 ||
    !Array.isArray(item.toppings) ||
    item.toppings.length > toppings.length ||
    (menuItem.category !== 'Pizza' && item.toppings.length)
  )
    throw new Error(
      'Your saved order contains an unavailable item. Clear the order and choose again.',
    );
  const preferences = pizzaPreferences(item, menuItem.category === 'Pizza');
  const seen = new Set();
  let unitPriceCents = menuItem.priceCents;
  const toppingNames = item.toppings.map((selection) => {
    const topping = toppings.find(
      (entry) => entry.toppingId === selection?.toppingId,
    );
    if (
      !topping ||
      seen.has(selection.toppingId) ||
      !Number.isInteger(selection.quantity) ||
      selection.quantity < 1 ||
      selection.quantity > 2
    )
      throw new Error(
        'Your saved toppings are invalid. Clear the order and choose again.',
      );
    seen.add(selection.toppingId);
    unitPriceCents +=
      topping[`${menuItem.size.toLowerCase()}PriceCents`] * selection.quantity;
    return toppingLabel(topping.toppingName, selection.quantity);
  });
  return {
    name: `${menuItem.size} ${menuItem.itemName}`,
    toppingNames: [
      ...toppingNames,
      ...(menuItem.category === 'Pizza'
        ? [preferenceLabel(preferences.sauce, preferences.cheese)]
        : []),
    ].join(', '),
    lineTotalCents: unitPriceCents * item.quantity,
  };
}
