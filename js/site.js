import { apiRequest } from './api.js';

const header = document.querySelector('#siteHeader');
header.innerHTML = `
  <nav class="navbar navbar-expand-lg py-3" aria-label="Main navigation">
    <div class="container">
      <a class="navbar-brand" href="./index.html"><img src="./assets/logo.svg" alt="Luigi's Pizzeria home" width="120" height="43" /></a>
      <button class="navbar-toggler p-2 ms-auto" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav" aria-controls="mainNav" aria-expanded="false" aria-label="Toggle navigation"><span class="navbar-toggler-icon"></span></button>
      <div class="collapse navbar-collapse order-3 order-lg-0" id="mainNav">
        <ul class="navbar-nav ms-auto align-items-lg-center gap-lg-3">
          <li class="nav-item"><a class="nav-link py-3" href="./menu.html">Our menu</a></li>
          <li class="nav-item"><a class="nav-link py-3" href="./about.html">About us</a></li>
          <li class="nav-item"><a class="nav-link py-3" href="./visit.html">Visit us</a></li>
          <li class="nav-item"><a class="nav-link py-3" href="./employee-login.html" id="employeeLink">Employee login</a></li>
          <li class="nav-item"><a class="btn btn-primary py-2 px-3" href="./order.html">Your order</a></li>
          <li class="nav-item"><button class="btn btn-outline-dark py-2" type="button" id="logoutButton" hidden>Logout</button></li>
        </ul>
      </div>
      <a class="btn btn-outline-primary py-2 ms-2" href="./login.html" id="accountLink">Login</a>
    </div>
  </nav>`;

const currentPage = window.location.pathname.split('/').pop() || 'index.html';
header.querySelectorAll('a').forEach((link) => {
  if (link.getAttribute('href') === `./${currentPage}`) {
    link.setAttribute('aria-current', 'page');
    link.classList.add('fw-bold', 'text-decoration-underline');
  }
});

try {
  const { customer } = await apiRequest('auth/session');
  if (customer) {
    const accountLink = document.querySelector('#accountLink');
    accountLink.textContent = 'My account';
    accountLink.href = './order.html';
    document.querySelector('#logoutButton').hidden = false;
  }
  const { employee } = await apiRequest('employee/auth/session');
  if (employee) {
    if (customer)
      document.querySelector('#logoutButton').textContent = 'Customer logout';
    const employeeLink = document.querySelector('#employeeLink');
    employeeLink.textContent = 'Employee orders';
    employeeLink.href = './employee.html';
    if (currentPage === 'employee.html') {
      employeeLink.setAttribute('aria-current', 'page');
      employeeLink.classList.add('fw-bold', 'text-decoration-underline');
    }
  }
} catch {
  // Public restaurant pages remain usable when only static hosting is available.
}

document
  .querySelector('#logoutButton')
  .addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    try {
      await apiRequest('auth/logout', { method: 'POST', body: '{}' });
      window.location.assign('./login.html');
    } catch (error) {
      event.target.textContent = 'Retry logout';
      event.target.disabled = false;
      event.target.title = error.message;
    }
  });
