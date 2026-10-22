import { apiRequest } from './api.js';
import { createRequestId, describeItem, currency } from './cart.js';
import { SAUCE_OPTIONS, CHEESE_OPTIONS } from './pizza-options.js';
import { prepareForm, validateForm, focusMessage } from './form-validation.js';

const $ = (selector) => document.querySelector(selector);
const fields = {
  customerName: '#staffName',
  phoneNumber: '#staffPhone',
  source: '#staffSource',
  serviceType: '#staffService',
  tableName: '#staffTable',
  notes: '#staffNotes',
};
const emptyDraft = () => ({
  items: [],
  customerName: '',
  phoneNumber: '',
  source: 'Phone',
  serviceType: 'Pickup',
  tableName: '',
  notes: '',
  requestId: createRequestId(),
  pending: null,
});

export async function setupStaffOrder(employee, onCreated) {
  const storageKey = `luigis-staff-draft-${employee.employeeId}`;
  let draft = emptyDraft();
  let busy = false;
  let connected = document.documentElement.dataset.kitchenConnected === 'true';
  let storageAvailable = true;
  const status = $('#staffStatus');
  const say = (text, focus = false) => {
    status.textContent = text;
    if (focus) focusMessage(status);
  };
  const [menu, toppings] = await Promise.all([
    apiRequest('menu'),
    apiRequest('toppings'),
  ]);
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved) {
      if (
        !Array.isArray(saved.items) ||
        saved.items.length > 20 ||
        typeof saved.requestId !== 'string'
      )
        throw new Error('Invalid staff draft.');
      saved.items.forEach((item) => describeItem(item, menu, toppings));
      draft = { ...draft, ...saved };
    }
  } catch {
    say('Saved staff draft could not be restored. Start a new staff order.');
  }
  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
      storageAvailable = true;
    } catch {
      storageAvailable = false;
      say(
        'Site storage is unavailable. Enable it before sending an order so retries can be reconciled safely.',
        true,
      );
    }
  }
  function setService() {
    const pickup = $('#staffService').value === 'Pickup';
    $('#staffPhone').required = pickup;
    $('#phoneHint').textContent = pickup
      ? '(required for pickup)'
      : '(optional)';
    $('#staffTable').disabled = pickup || busy || Boolean(draft.pending);
    if (pickup) $('#staffTable').value = '';
  }
  function lock() {
    $('#staffItemFields').disabled = busy || Boolean(draft.pending);
    $('#staffCheckoutFields').disabled = busy;
    for (const selector of Object.values(fields))
      $(selector).disabled = busy || Boolean(draft.pending);
    $('#staffClear').disabled = busy || Boolean(draft.pending);
    $('#staffSubmit').disabled =
      busy || !connected || !draft.items.length || !storageAvailable;
    $('#staffSubmit').textContent = busy
      ? 'Checking saved order - '
      : draft.pending
        ? 'Check and retry same submission'
        : 'Send to kitchen';
    document
      .querySelectorAll('[data-remove-staff]')
      .forEach((node) => (node.disabled = busy || Boolean(draft.pending)));
    setService();
  }
  function renderDraft() {
    $('#staffDraftItems').replaceChildren();
    let total = 0;
    if (!draft.items.length)
      $('#staffDraftItems').textContent = 'No items added yet.';
    draft.items.forEach((item, index) => {
      const description = describeItem(item, menu, toppings);
      total += description.lineTotalCents;
      const row = document.createElement('div');
      row.className = 'border-bottom py-3';
      const text = document.createElement('p');
      text.className = 'mb-2';
      text.textContent = `${item.quantity} \u00d7 ${description.name} - ${description.toppingNames} - ${currency.format(description.lineTotalCents / 100)}`;
      const remove = document.createElement('button');
      remove.className = 'btn btn-secondary border border-dark py-3';
      remove.type = 'button';
      remove.dataset.removeStaff = index;
      remove.textContent = `Remove item ${index + 1}`;
      remove.onclick = () => {
        draft.items.splice(index, 1);
        draft.requestId = createRequestId();
        persist();
        renderDraft();
        $('#staffItem').focus();
      };
      row.append(text, remove);
      $('#staffDraftItems').append(row);
    });
    $('#staffTotal').textContent =
      `Order total: ${currency.format(total / 100)}`;
    lock();
  }
  for (const [key, selector] of Object.entries(fields)) {
    $(selector).value = draft[key];
    $(selector).addEventListener('input', () => {
      if (busy || draft.pending) return;
      setService();
      for (const [name, input] of Object.entries(fields))
        draft[name] = $(input).value;
      draft.requestId = createRequestId();
      persist();
      lock();
    });
  }
  for (const item of menu) {
    const option = document.createElement('option');
    option.value = item.menuItemId;
    option.textContent = `${item.size} ${item.itemName}  -  ${currency.format(item.priceCents / 100)}`;
    $('#staffItem').append(option);
  }
  for (const [selector, options] of [
    ['#staffSauce', SAUCE_OPTIONS],
    ['#staffCheese', CHEESE_OPTIONS],
  ]) {
    for (const name of options) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      $(selector).append(option);
    }
  }
  for (const topping of toppings) {
    const column = document.createElement('div');
    column.className = 'col-sm-6';
    const label = document.createElement('label');
    label.className =
      'd-flex gap-2 align-items-center border rounded p-2 fw-semibold';
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'form-check-input m-0';
    check.id = `staff-topping-${topping.toppingId}`;
    check.dataset.staffTopping = topping.toppingId;
    label.append(check, document.createTextNode(topping.toppingName));
    const price = document.createElement('span');
    price.id = `staff-topping-price-${topping.toppingId}`;
    price.className = 'ms-auto small text-body-secondary';
    label.append(price);
    const coverage = document.createElement('div');
    coverage.className = 'pb-2';
    coverage.hidden = true;
    const optionLabel = document.createElement('label');
    optionLabel.className = 'form-label';
    optionLabel.htmlFor = `staff-coverage-${topping.toppingId}`;
    optionLabel.textContent = `${topping.toppingName} coverage`;
    const select = document.createElement('select');
    select.id = optionLabel.htmlFor;
    select.className = 'form-select';
    select.disabled = true;
    for (const amount of [1, 2]) {
      const option = document.createElement('option');
      option.value = amount;
      select.append(option);
    }
    coverage.append(optionLabel, select);
    column.append(label, coverage);
    $('#staffToppings').append(column);
  }
  function currentItem() {
    const item = menu.find(
      (entry) => entry.menuItemId === Number($('#staffItem').value),
    );
    const pizza = item.category === 'Pizza';
    return {
      menuItemId: item.menuItemId,
      quantity: Number($('#staffQuantity').value),
      toppings: pizza
        ? [...document.querySelectorAll('[data-staff-topping]:checked')].map(
            (input) => ({
              toppingId: Number(input.dataset.staffTopping),
              quantity: Number(
                $(`#staff-coverage-${input.dataset.staffTopping}`).value,
              ),
            }),
          )
        : [],
      ...(pizza
        ? { sauce: $('#staffSauce').value, cheese: $('#staffCheese').value }
        : {}),
    };
  }
  function updateItem() {
    const item = menu.find(
      (entry) => entry.menuItemId === Number($('#staffItem').value),
    );
    const pizza = item.category === 'Pizza';
    $('#staffPizza').hidden = !pizza;
    $('#staffPizza').disabled = !pizza;
    for (const topping of toppings) {
      const select = $(`#staff-coverage-${topping.toppingId}`);
      const price = topping[`${item.size.toLowerCase()}PriceCents`];
      select.options[0].textContent = `Regular  -  ${currency.format(price / 100)}`;
      select.options[1].textContent = `Double  -  ${currency.format((price * 2) / 100)}`;
      select.disabled = !$(`#staff-topping-${topping.toppingId}`).checked;
      select.parentElement.hidden = select.disabled;
      $(`#staff-topping-price-${topping.toppingId}`).textContent =
        currency.format(price / 100);
      $(`#staff-topping-${topping.toppingId}`)
        .closest('label')
        .classList.toggle('bg-primary-subtle', !select.disabled);
    }
    try {
      $('#staffItemPrice').textContent =
        `Item total: ${currency.format(describeItem(currentItem(), menu, toppings).lineTotalCents / 100)}`;
    } catch {
      $('#staffItemPrice').textContent = 'Choose a quantity from 1 to 20.';
    }
  }
  prepareForm($('#staffItemForm'));
  prepareForm($('#staffCheckout'));
  $('#staffItemForm').addEventListener('input', updateItem);
  $('#staffItemForm').onsubmit = (event) => {
    event.preventDefault();
    if (busy || draft.pending || !validateForm(event.target)) return;
    if (draft.items.length >= 20) {
      say('A staff order can contain up to 20 item lines.', true);
      return;
    }
    draft.items.push(currentItem());
    draft.requestId = createRequestId();
    persist();
    renderDraft();
    say('Item added to staff order.');
  };
  $('#staffClear').onclick = () => {
    if (busy || draft.pending) return;
    if (!window.confirm('Clear this unsent staff order draft?')) return;
    draft = emptyDraft();
    for (const [key, selector] of Object.entries(fields))
      $(selector).value = draft[key];
    persist();
    renderDraft();
    say('Staff draft cleared.');
  };
  async function finish(order) {
    draft = emptyDraft();
    persist();
    for (const [key, selector] of Object.entries(fields))
      $(selector).value = draft[key];
    renderDraft();
    say(`Order #${order.orderId} saved. No payment collected.`);
    await onCreated(order.orderId);
  }
  async function submit() {
    if (busy || !connected || !storageAvailable) return;
    busy = true;
    lock();
    try {
      const existing = await apiRequest(
        `employee/orders/submissions/${encodeURIComponent(draft.pending.requestId)}`,
      );
      if (existing.order) {
        await finish(existing.order);
        return;
      }
      const order = await apiRequest('employee/orders', {
        method: 'POST',
        body: JSON.stringify(draft.pending),
      });
      await finish(order);
    } catch (error) {
      if (error.status === 401) {
        window.location.replace('./employee-login.html');
        return;
      }
      if (error.status === 400) {
        draft.pending = null;
        persist();
      }
      say(
        `${error.message} ${draft.pending ? 'Draft locked: use Check and retry same submission. It checks for an already saved order first.' : 'Correct the details and submit again.'}`,
        true,
      );
    } finally {
      busy = false;
      lock();
    }
  }
  $('#staffCheckout').onsubmit = (event) => {
    event.preventDefault();
    if (busy || !connected) return;
    if (!draft.pending) {
      if (!validateForm(event.target) || !draft.items.length) return;
      draft.pending = Object.fromEntries(
        [...Object.keys(fields), 'items', 'requestId'].map((key) => [
          key,
          draft[key],
        ]),
      );
      persist();
      if (!storageAvailable) {
        draft.pending = null;
        return;
      }
    }
    submit();
  };
  document.addEventListener('kitchen-connection', (event) => {
    connected = event.detail.connected;
    lock();
  });
  persist();
  renderDraft();
  updateItem();
  if (draft.pending) {
    say(
      'An unfinished submission was restored. Checking the kitchen before allowing a retry.',
    );
    await submit();
  }
}
