import { apiRequest } from './api.js';

const loginForm = document.querySelector('#loginForm');
const identityInput = document.querySelector('#loginIdentity');
const passwordInput = document.querySelector('#loginPassword');
const loginStatus = document.querySelector('#loginStatus');
const registerButton = document.querySelector('#registerMode');
let isRegistering = false;

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!loginForm.reportValidity()) return;
  const submitButton = loginForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
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
  } finally {
    submitButton.disabled = false;
  }
});

registerButton.addEventListener('click', () => {
  isRegistering = !isRegistering;
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
