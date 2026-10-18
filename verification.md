# Verification — October 18, 2026

## Automated checks

`npm test`: 7 passing tests covering:

- Registration, normalized email login, hashed passwords, session rotation, and logout.
- Cross-origin write rejection, account validation, expired sessions, and blocked private file paths.
- Authentication attempt throttling.
- Size-specific topping prices, topping portions, quantities, and invalid menu selections.
- Authenticated order persistence, authoritative totals, customer history isolation, and retry deduplication.
- Transaction rollback when a topping insert fails.
- File-backed SQLite data and migration state after closing and reopening.

`npm run lint`, `npm run format:check`, and `git diff --check` passed. The frontend has no build step.

## Browser checks

Used the running Node app at `http://127.0.0.1:3000` with browser automation and visual inspection.

- Checked all six pages at 1280, 768, 390, and 375 pixels. No horizontal overflow. Home page lazy images were scrolled into view and confirmed loaded.
- Visually inspected the desktop menu and mobile restaurant page; adjusted signed-in mobile navigation so account access fits beside the logo and menu toggle. Logout lives inside the mobile menu.
- Verified the mobile menu opens and navigates to About and Visit pages.
- Built two medium pizzas, each with two pepperoni portions, plus a medium cola. The subtotal was $24.00 and survived page navigation and reload.
- Registered through the checkout login link, returned to the saved draft, saved the order, and verified all items and topping portions in customer history.
- Verified an $8.00 dine-in order remained in history after logout and login.
- Verified incorrect credentials show an error; password-field Enter submits both successful and failed login attempts.
- Changed a small pizza quantity from 1 to 3 and checked the subtotal changed from $5.00 to $15.00. Removing the item returned it to $0.00.
- Verified blank quantity disables submission, valid quantity restores the price, and clear removes the draft.
- Verified formatted phone numbers pass browser validation and invalid phone text fails. Corrected the HTML pattern after Chromium reported its stricter regular expression requirements.
- Corrected the server image policy to allow Bootstrap's built-in data-URL icons. Final targeted ordering checks reported no browser console errors.

The checks used clearly named local test customers and pending orders. No restaurant was notified, no card was charged, and nothing was deployed. Local SQLite data is excluded from Git.

## Remaining product work

Approved owner biography, restaurant history, address, phone, hours, and final branding are still needed. Menu prices remain samples. Employee/CSR authentication, restaurant acceptance, kitchen processing, tax, and payment are not implemented. Public static pages can run on GitHub Pages; authentication and ordering require the Node server and persistent SQLite storage.
