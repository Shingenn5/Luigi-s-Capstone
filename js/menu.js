import { apiRequest } from './api.js';
import { addItem, currency, describeItem } from './cart.js';

const pizzaForm = document.querySelector('#pizzaForm');
const pizzaSize = document.querySelector('#pizzaSize');
const pizzaQuantity = document.querySelector('#pizzaQuantity');
const drinkForm = document.querySelector('#drinkForm');
const announcement = document.querySelector('#orderAnnouncement');
let menu = [];
let toppings = [];

function getPizza() {
  return {
    menuItemId: Number(pizzaSize.value),
    quantity: Number(pizzaQuantity.value),
    toppings: [...document.querySelectorAll('[data-topping-id]')]
      .filter((input) => Number(input.value) > 0)
      .map((input) => ({
        toppingId: Number(input.dataset.toppingId),
        quantity: Number(input.value),
      })),
  };
}

function updatePrice() {
  if (!pizzaForm.checkValidity()) {
    document.querySelector('#pizzaPrice').textContent =
      'Check quantities to see your price.';
    return;
  }
  const description = describeItem(getPizza(), menu, toppings);
  document.querySelector('#pizzaPrice').textContent =
    `Pizza total: ${currency.format(description.lineTotalCents / 100)}`;
  const selectedPizza = menu.find(
    (item) => item.menuItemId === Number(pizzaSize.value),
  );
  document.querySelector('#toppingHint').textContent =
    `Choose 0–10 portions per ingredient. Each portion costs ${currency.format(toppings[0][`${selectedPizza.size.toLowerCase()}PriceCents`] / 100)} per pizza.`;
}

try {
  [menu, toppings] = await Promise.all([
    apiRequest('menu'),
    apiRequest('toppings'),
  ]);
  menu.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.menuItemId;
    option.textContent = `${item.size} ${item.itemName} — ${currency.format(item.priceCents / 100)}`;
    (item.category === 'Pizza'
      ? pizzaSize
      : document.querySelector('#drinkChoice')
    ).append(option);
  });
  toppings.forEach((topping) => {
    const column = document.createElement('div');
    column.className = 'col-sm-6';
    const label = document.createElement('label');
    label.className = 'form-label';
    label.htmlFor = `topping-${topping.toppingId}`;
    label.textContent = topping.toppingName;
    const input = document.createElement('input');
    input.id = label.htmlFor;
    input.className = 'form-control';
    input.type = 'number';
    input.min = 0;
    input.max = 10;
    input.value = 0;
    input.required = true;
    input.dataset.toppingId = topping.toppingId;
    column.append(label, input);
    document.querySelector('#toppingChoices').append(column);
  });
  document.querySelector('#pizzaFields').disabled = false;
  document.querySelector('#drinkFields').disabled = false;
  updatePrice();
  announcement.textContent = 'Choose your pizza or drink to get started.';
} catch (error) {
  announcement.textContent = error.message;
}

pizzaForm.addEventListener('input', updatePrice);
pizzaForm.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const item = getPizza();
    const description = describeItem(item, menu, toppings);
    addItem(item);
    announcement.textContent = `${item.quantity} × ${description.name} added. Review your order when you are ready.`;
  } catch (error) {
    announcement.textContent = error.message;
  }
});

drinkForm.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const item = {
      menuItemId: Number(document.querySelector('#drinkChoice').value),
      quantity: Number(document.querySelector('#drinkQuantity').value),
      toppings: [],
    };
    const description = describeItem(item, menu, toppings);
    addItem(item);
    announcement.textContent = `${item.quantity} × ${description.name} added to your order.`;
  } catch (error) {
    announcement.textContent = error.message;
  }
});
