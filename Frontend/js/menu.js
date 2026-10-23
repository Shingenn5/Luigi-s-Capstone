import { prepareForm, validateForm, focusMessage } from './form-validation.js';
import { apiRequest } from './api.js';
import { addItem, currency, describeItem } from './cart.js';
import { SAUCE_OPTIONS, CHEESE_OPTIONS } from './pizza-options.js';

const pizzaForm = document.querySelector('#pizzaForm');
const pizzaSize = document.querySelector('#pizzaSize');
const pizzaQuantity = document.querySelector('#pizzaQuantity');
const drinkForm = document.querySelector('#drinkForm');
const announcement = document.querySelector('#orderAnnouncement');
prepareForm(pizzaForm);
prepareForm(drinkForm);
let menu = [];
let toppings = [];

function getPizza() {
  return {
    menuItemId: Number(pizzaSize.value),
    quantity: Number(pizzaQuantity.value),
    sauce: document.querySelector('#sauceChoice').value,
    cheese: document.querySelector('#cheeseChoice').value,
    toppings: [...document.querySelectorAll('[data-topping-id]')]
      .filter((input) => input.checked)
      .map((input) => ({
        toppingId: Number(input.dataset.toppingId),
        quantity: Number(
          document.querySelector(`#topping-option-${input.dataset.toppingId}`)
            .value,
        ),
      })),
  };
}

function updatePrice() {
  const selectedPizza = menu.find(
    (item) => item.menuItemId === Number(pizzaSize.value),
  );
  document.querySelectorAll('[data-pizza-size]').forEach((button) => {
    const selected =
      button.dataset.pizzaSize === selectedPizza.size.toLowerCase();
    button.setAttribute('aria-pressed', String(selected));
    button.classList.toggle('border-3', selected);
    button.classList.toggle('border-primary', selected);
    button.querySelector('[data-size-state]').textContent = selected
      ? 'Selected — customize below'
      : 'Choose ' + button.dataset.pizzaSize;
  });
  toppings.forEach((topping) => {
    const input = document.querySelector(`#topping-${topping.toppingId}`);
    const optionSelect = document.querySelector(
      `#topping-option-${topping.toppingId}`,
    );
    const price = topping[`${selectedPizza.size.toLowerCase()}PriceCents`];
    optionSelect.disabled = !input.checked;
    optionSelect.options[0].textContent = `Regular - ${currency.format(price / 100)} per pizza`;
    optionSelect.options[1].textContent = `Double - ${currency.format((price * 2) / 100)} per pizza`;
  });
  document.querySelector('#toppingHint').textContent =
    'Each selected topping is charged once for the whole pizza, not per slice. Double costs one additional topping charge. Prices below follow your chosen size.';
  if (!pizzaForm.checkValidity()) {
    document.querySelector('#pizzaPrice').textContent =
      'Enter a pizza quantity from 1 to 20 to see the total.';
    return;
  }
  const description = describeItem(getPizza(), menu, toppings);
  document.querySelector('#pizzaPrice').textContent =
    `Total for ${pizzaQuantity.value} pizza${Number(pizzaQuantity.value) === 1 ? '' : 's'}: ${currency.format(description.lineTotalCents / 100)}`;
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
    const group = document.createElement('div');
    group.className = 'border rounded p-3 h-100';
    const checkLabel = document.createElement('label');
    checkLabel.className = 'd-flex align-items-center gap-3 py-2 fw-semibold';
    const input = document.createElement('input');
    input.id = `topping-${topping.toppingId}`;
    input.className = 'form-check-input border-dark mt-0';
    input.type = 'checkbox';
    input.dataset.toppingId = topping.toppingId;
    checkLabel.append(input, document.createTextNode(topping.toppingName));
    const optionLabel = document.createElement('label');
    optionLabel.className = 'form-label small mt-2';
    optionLabel.htmlFor = `topping-option-${topping.toppingId}`;
    optionLabel.textContent = `${topping.toppingName} option`;
    const optionSelect = document.createElement('select');
    optionSelect.id = optionLabel.htmlFor;
    optionSelect.className = 'form-select border-dark';
    optionSelect.disabled = true;
    optionSelect.setAttribute('aria-describedby', 'toppingHint');
    [1, 2].forEach((quantity) => {
      const option = document.createElement('option');
      option.value = quantity;
      optionSelect.append(option);
    });
    group.append(checkLabel, optionLabel, optionSelect);
    column.append(group);
    document.querySelector('#toppingChoices').append(column);
  });
  [
    [SAUCE_OPTIONS, '#sauceChoice'],
    [CHEESE_OPTIONS, '#cheeseChoice'],
  ].forEach(([options, selector]) => {
    options.forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      document.querySelector(selector).append(option);
    });
  });
  document.querySelector('#pizzaFields').disabled = false;
  document.querySelector('#drinkFields').disabled = false;
  document.querySelectorAll('[data-pizza-size]').forEach((button) => {
    const item = menu.find(
      (item) =>
        item.category === 'Pizza' &&
        item.size.toLowerCase() === button.dataset.pizzaSize,
    );
    if (!item) {
      button.hidden = true;
      return;
    }
    button.querySelector('[data-size-price]').textContent =
      currency.format(item.priceCents / 100) + ' base';
    button.disabled = false;
    button.addEventListener('click', () => {
      pizzaSize.value = String(item.menuItemId);
      updatePrice();
      document.querySelector('#buildTitle').focus();
      announcement.textContent =
        item.size + ' pizza selected. Choose your toppings below.';
    });
  });
  const requestedSize = new URLSearchParams(window.location.search).get('size');
  const requestedPizza = menu.find(
    (item) =>
      item.category === 'Pizza' && item.size.toLowerCase() === requestedSize,
  );
  if (requestedPizza) pizzaSize.value = String(requestedPizza.menuItemId);
  updatePrice();
  announcement.textContent = 'Choose your pizza or drink to get started.';
} catch (error) {
  announcement.textContent = error.message;
}

pizzaForm.addEventListener('input', updatePrice);
pizzaForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!validateForm(pizzaForm)) return;
  try {
    const item = getPizza();
    const description = describeItem(item, menu, toppings);
    addItem(item);
    announcement.textContent = `${item.quantity} × ${description.name} added. Review your order when you are ready.`;
  } catch (error) {
    announcement.textContent = error.message;
    focusMessage(announcement);
  }
});

drinkForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!validateForm(drinkForm)) return;
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
    focusMessage(announcement);
  }
});
