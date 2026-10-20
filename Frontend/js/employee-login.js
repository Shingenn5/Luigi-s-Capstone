import { apiRequest } from './api.js';
import { prepareForm, validateForm, focusMessage } from './form-validation.js';

const form = document.querySelector('#employeeLoginForm');
const status = document.querySelector('#employeeLoginStatus');
prepareForm(form);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!validateForm(form)) return;
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  form.setAttribute('aria-busy', 'true');
  status.textContent = 'Logging in to your employee account…';
  try {
    await apiRequest('employee/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: document.querySelector('#employeeUsername').value.trim(),
        password: document.querySelector('#employeePassword').value,
      }),
    });
    document.querySelector('#employeePassword').value = '';
    window.location.assign('./employee.html');
  } catch (error) {
    status.textContent = error.message;
    focusMessage(status);
  } finally {
    submit.disabled = false;
    form.removeAttribute('aria-busy');
  }
});
