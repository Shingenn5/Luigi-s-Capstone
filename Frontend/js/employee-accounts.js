import { apiRequest } from './api.js';

async function loadStaffAccounts() {
  const list = document.querySelector('#staffAccountsList');
  const status = document.querySelector('#staffListStatus');
  const refresh = document.querySelector('#refreshStaffAccounts');

  list.replaceChildren();
  status.textContent = 'Loading staff accounts…';
  refresh.disabled = true;

  try {
    const { employees } = await apiRequest('employee/accounts');

    for (const employee of employees) {
      const row = document.createElement('tr');

      const values = [
        employee.displayName,
        employee.username,
        employee.role === 'admin' ? 'Admin' : 'Employee',
        employee.isActive ? 'Active' : 'Inactive',
      ];

      for (const value of values) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }

      list.append(row);
    }

    status.textContent = employees.length
      ? `${employees.length} staff account(s) found.`
      : 'No staff accounts found.';
  } catch (error) {
    status.textContent = error.message;

    if (error.status === 401) {
      window.location.replace('./employee-login.html');
    }

    if (error.status === 403) {
      document.querySelector('#staffAccountsButton').hidden = true;
    }
  } finally {
    refresh.disabled = false;
  }
}

export function setupStaffAccounts() {
  const form = document.querySelector('#staffAccountForm');
  const fields = document.querySelector('#staffAccountFields');
  const status = document.querySelector('#accountStatus');
  const password = document.querySelector('#accountPassword');
  const confirmation = document.querySelector('#accountConfirmation');
  const submit = document.querySelector('#createStaffAccount');
  fields.disabled = false;
  
  const refreshAccounts = document.querySelector('#refreshStaffAccounts');
  const accountsTab = document.querySelector('#staffAccountsButton');

  refreshAccounts.addEventListener('click', loadStaffAccounts);
  accountsTab.addEventListener('click', loadStaffAccounts);

  confirmation.addEventListener('input', () =>
    confirmation.setCustomValidity(''),
  );
  password.addEventListener('input', () => confirmation.setCustomValidity(''));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (fields.disabled) return;
    if (password.value !== confirmation.value) {
      confirmation.setCustomValidity('Passwords do not match.');
      confirmation.reportValidity();
      return;
    }
    const account = Object.fromEntries(new FormData(form));
    fields.disabled = true;
    submit.textContent = 'Creating account…';
    status.textContent = 'Creating account…';
    try {
      const { employee } = await apiRequest('employee/accounts', {
        method: 'POST',
        body: JSON.stringify(account),
      });
      form.reset();
      status.textContent = `${employee.role === 'admin' ? 'Admin' : 'Employee'} account ${employee.username} created. Sign in using Employee login.`;
      status.focus();
      await loadStaffAccounts();
    } catch (error) {
      status.textContent = error.message;
      status.focus();
      if (error.status === 401)
        window.location.replace('./employee-login.html');
      if (error.status === 403) {
        document.querySelector('#staffAccountsButton').hidden = true;
        return;
      }
    } finally {
      password.value = '';
      confirmation.value = '';
      account.password = '';
      fields.disabled = document.querySelector('#staffAccountsButton').hidden;
      submit.textContent = 'Create account';
    }
  });
}
