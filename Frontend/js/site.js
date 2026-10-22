import { apiRequest } from './api.js';
import { STATIC_PREVIEW } from './runtime-config.js';

const header = document.querySelector('#siteHeader');
header.innerHTML = `
  <div class="bg-black text-center">
    <a class="d-inline-block" href="./" aria-label="Luigi's Pizzeria home">
      <img class="img-fluid" src="./assets/banner.png" alt="Luigi's Pizzeria — Since 1968" width="210" height="134" fetchpriority="high" />
    </a>
  </div>
  <nav class="navbar navbar-expand-lg py-0" aria-label="Main navigation">
    <div class="container">
      <a class="navbar-brand" href="./">
        <img
          src="./assets/Luigis-Logo.png"
          alt="Luigi's Pizzeria"
          width="72"
          height="72"
          class="object-fit-contain"
        />
      </a>
      <button class="navbar-toggler p-2 ms-auto" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav" aria-controls="mainNav" aria-expanded="false" aria-label="Toggle navigation"><span class="navbar-toggler-icon"></span></button>
      <div class="collapse navbar-collapse order-3 order-lg-0" id="mainNav">
        <ul class="navbar-nav ms-auto align-items-lg-center gap-lg-3">
          <li class="nav-item"><a class="nav-link py-3" href="./menu.html">Our menu</a></li>
          <li class="nav-item"><a class="nav-link py-3" href="./about.html">About us</a></li>
          <li class="nav-item"><a class="nav-link py-3" href="./visit.html">Visit us</a></li>
          <li class="nav-item"><a class="btn btn-primary py-2 px-3" href="./order.html">Your order</a></li>
          <li class="nav-item"><button class="btn btn-outline-dark py-2" type="button" id="logoutButton" hidden>Logout</button></li>
        </ul>
      </div>
      <a class="btn btn-outline-primary py-2 ms-2" href="./login.html" id="accountLink">Login</a>
    </div>
  </nav>`;

if (STATIC_PREVIEW) {
  const notice = document.createElement('p');
  notice.className = 'container small text-body-secondary py-2 mb-0';
  notice.textContent =
    'Website preview: browse the menu and build a draft. Sign-in and sending orders are unavailable here.';
  header.append(notice);
}

const currentPage = window.location.pathname.split('/').pop() || 'index.html';

// Keep staff access discoverable without competing with customer navigation.
if (currentPage !== 'employee.html') {
  const footer =
    document.querySelector('footer') || document.createElement('footer');
  footer.className = 'border-top bg-body-tertiary py-4';
  footer.innerHTML = `
    <div class="container d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
      <div><a class="fw-bold text-body text-decoration-none" href="./">Luigi's Pizzeria</a><p class="small text-body-secondary mb-0 mt-1">A little slice of happiness. · Capstone project</p></div>
      <nav class="d-flex flex-wrap align-items-center gap-3 small" aria-label="Footer navigation">
        <a class="text-body-secondary py-2" href="./about.html">About us</a>
        <a class="text-body-secondary py-2" href="./visit.html">Visit us</a>
        <a class="text-body-secondary py-2" href="./employee-login.html" id="employeeFooterLink">Employee login</a>
      </nav>
    </div>`;
  if (!footer.isConnected) document.body.append(footer);
}

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
    const employeeFooterLink = document.querySelector('#employeeFooterLink');
    if (employeeFooterLink) {
      employeeFooterLink.textContent = 'Employee workspace';
      employeeFooterLink.href = './employee.html';
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
