// Input format validation only. Authentication and CSR access require a server.
const loginForm = document.querySelector('#loginForm');
const identityInput = document.querySelector('#loginIdentity');
const passwordInput = document.querySelector('#loginPassword');
const employeeButton = document.querySelector('#employeeLogin');
const loginStatus = document.querySelector('#loginStatus');
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const employeePattern = /^[a-zA-Z0-9._-]{3,32}$/;
const passwordPattern = /^\S{8,128}$/u;
let isEmployeeLogin = false;

function validateInput(input, pattern) {
  const isValid = pattern.test(input.value);
  input.classList.toggle('is-invalid', !isValid);
  input.setAttribute('aria-invalid', String(!isValid));
  return isValid;
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  identityInput.value = identityInput.value.trim();
  const identityValid = validateInput(identityInput, isEmployeeLogin ? employeePattern : emailPattern);
  const passwordValid = validateInput(passwordInput, passwordPattern);

  if (!identityValid || !passwordValid) {
    loginStatus.textContent = 'Check the highlighted fields.';
    (identityValid ? passwordInput : identityInput).focus();
    return;
  }

  loginStatus.textContent = isEmployeeLogin
    ? 'Employee input format checked. CSR sign-in and the order workspace are coming next.'
    : 'Input format checked. Customer sign-in is not connected yet.';
  passwordInput.value = '';
});

[identityInput, passwordInput].forEach((input) => {
  input.addEventListener('input', () => {
    loginStatus.textContent = '';
    if (input.getAttribute('aria-invalid') === 'true') {
      validateInput(input, input === passwordInput ? passwordPattern : isEmployeeLogin ? employeePattern : emailPattern);
    }
  });
});

employeeButton.addEventListener('click', () => {
  isEmployeeLogin = !isEmployeeLogin;
  loginForm.reset();
  [identityInput, passwordInput].forEach((input) => {
    input.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
  });
  document.querySelector('#loginTitle').textContent = isEmployeeLogin ? 'Employee login' : 'Customer login';
  document.querySelector('#identityLabel').textContent = isEmployeeLogin ? 'Employee username' : 'Email address';
  document.querySelector('#identityHint').textContent = isEmployeeLogin
    ? 'Use 3–32 letters, numbers, periods, underscores, or hyphens.'
    : 'Enter your email address.';
  document.querySelector('#identityError').textContent = isEmployeeLogin
    ? 'Enter a username with 3–32 letters, numbers, periods, underscores, or hyphens.'
    : 'Enter a valid email address, such as name@example.com.';
  identityInput.type = isEmployeeLogin ? 'text' : 'email';
  identityInput.name = isEmployeeLogin ? 'username' : 'email';
  identityInput.maxLength = isEmployeeLogin ? 32 : 254;
  employeeButton.textContent = isEmployeeLogin ? 'Customer login' : 'Employee login';
  employeeButton.setAttribute('aria-pressed', String(isEmployeeLogin));
  loginStatus.textContent = '';
  identityInput.focus();
});
