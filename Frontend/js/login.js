import { prepareForm, validateForm, focusMessage } from './form-validation.js';
import { apiRequest } from './api.js';

const loginForm = document.querySelector('#loginForm');
const identityInput = document.querySelector('#loginIdentity');
const passwordInput = document.querySelector('#loginPassword');
const loginStatus = document.querySelector('#loginStatus');
const registerButton = document.querySelector('#registerMode');
let isRegistering = false;
prepareForm(loginForm);

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!validateForm(loginForm)) return;
  const submitButton = loginForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  registerButton.disabled = true;
  loginForm.setAttribute('aria-busy', 'true');
  loginStatus.textContent = isRegistering
    ? 'Creating your account…'
    : 'Logging in…';
  try {
    await apiRequest(isRegistering ? 'auth/register' : 'auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: identityInput.value.trim(),
        password: passwordInput.value,
        firstName: document.querySelector('#firstName').value,
        lastName: document.querySelector('#lastName').value,
      }),
    });
    passwordInput.value = '';
    window.location.assign('./order.html');
  } catch (error) {
    loginStatus.textContent = error.message;
    focusMessage(loginStatus);
  } finally {
    submitButton.disabled = false;
    registerButton.disabled = false;
    loginForm.removeAttribute('aria-busy');
  }
});

registerButton.addEventListener('click', () => {
  isRegistering = !isRegistering;
  loginForm.querySelector('[data-error-summary]')?.remove();
  loginForm.querySelectorAll('.is-invalid').forEach((input) => {
    input.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
  });
  loginForm.querySelectorAll('.invalid-feedback').forEach((error) => {
    error.hidden = true;
    error.textContent = '';
  });
  document.querySelector('#registrationFields').hidden = !isRegistering;
  document.querySelectorAll('#registrationFields input').forEach((input) => {
    input.required = isRegistering;
    input.disabled = !isRegistering;
  });
  document.querySelector('#loginTitle').textContent = isRegistering
    ? 'Create your account'
    : 'Customer login';
  loginForm.querySelector('[type="submit"]').textContent = isRegistering
    ? 'Create account'
    : 'Login';
  registerButton.textContent = isRegistering
    ? 'Already have an account? Login'
    : 'New customer? Create an account';
  passwordInput.autocomplete = isRegistering
    ? 'new-password'
    : 'current-password';
  loginStatus.textContent = '';
  (isRegistering
    ? document.querySelector('#firstName')
    : identityInput
  ).focus();
});
