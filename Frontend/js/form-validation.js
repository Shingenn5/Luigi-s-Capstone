export function prepareForm(form) {
  // Keep native constraints while providing persistent, linked error messages.
  form.noValidate = true;
  form.addEventListener('input', (event) => {
    const input = event.target;
    if (input.getAttribute('aria-invalid') === 'true') updateField(input);
  });
}

function updateField(input) {
  const invalid = !input.validity.valid;
  input.setAttribute('aria-invalid', String(invalid));
  input.classList.toggle('is-invalid', invalid);
  const errorId = `${input.id}-error`;
  let error = document.getElementById(errorId);
  if (!error && invalid) {
    error = document.createElement('p');
    error.id = errorId;
    error.className = 'invalid-feedback mb-0';
    input.after(error);
    const descriptions = new Set(
      (input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean),
    );
    descriptions.add(errorId);
    input.setAttribute('aria-describedby', [...descriptions].join(' '));
  }
  if (error) {
    error.textContent = invalid ? input.validationMessage : '';
    error.hidden = !invalid;
  }
  return invalid;
}

export function validateField(input) {
  return !updateField(input);
}

export function validateForm(form) {
  const invalidInputs = [
    ...form.querySelectorAll('input, select, textarea'),
  ].filter((input) => input.willValidate && updateField(input));
  let summary = form.querySelector('[data-error-summary]');
  if (!invalidInputs.length) {
    if (summary) summary.hidden = true;
    return true;
  }
  if (!summary) {
    summary = document.createElement('div');
    summary.className = 'alert alert-danger';
    summary.dataset.errorSummary = '';
    summary.tabIndex = -1;
    summary.setAttribute('role', 'alert');
    form.prepend(summary);
  }
  summary.hidden = false;
  const heading = document.createElement('h2');
  heading.className = 'h5';
  heading.textContent = 'Check these fields';
  const list = document.createElement('ul');
  list.className = 'mb-0';
  invalidInputs.forEach((input) => {
    const row = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'link-dark';
    link.href = `#${input.id}`;
    const label =
      input.labels?.[0]?.textContent.trim() ||
      input.getAttribute('aria-label') ||
      'This field';
    link.textContent = `${label}: ${input.validationMessage}`;
    link.addEventListener('click', (event) => {
      event.preventDefault();
      input.focus();
    });
    row.append(link);
    list.append(row);
  });
  summary.replaceChildren(heading, list);
  summary.focus();
  return false;
}

export function focusMessage(target) {
  target.tabIndex = -1;
  target.focus();
}
