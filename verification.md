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

## October 19, 2026 — topping selection and accessibility

- Replaced arbitrary topping quantity inputs with checkboxes and regular/double options. The whole-pizza charge is explicit; double adds one additional topping charge. Verified small pepperoni at $6 and double pepperoni at $7.
- Added regular/light/extra/no sauce and regular/light/no cheese preferences with no surcharge. Confirmed preview/server price agreement and persistence in customer history. Kept existing SQL data through migration 002.
- Used Bootstrap classes only. No custom stylesheet, inline CSS, or changes to the bundled Bootstrap theme. Darker borders, readable error links, current-page underlining, labels, and error feedback use existing Bootstrap components/utilities.
- Added focusable main content targets, atomic status announcements, grouped form labels, persistent inline errors, and a focused summary linking to invalid fields. Request failures and saved-order confirmations receive focus where needed.
- Fixed About-page horizontal overflow at narrow widths by adjusting Bootstrap gutter classes.
- `npm test`: 9 passing API/business tests. `npm run lint` and `npm run format:check` pass.
- `npm run test:a11y`: 10 passing browser tests using Playwright and axe-core. Scanned all six pages at desktop and 320px, error summaries, selected toppings, and saved order history. Tested keyboard ordering through account creation and checkout, current cart quantity errors, skip links, mobile navigation, reduced motion, and forced colors. No axe violations in the tested states.
- Visually reviewed the updated desktop and mobile pizza builder. Browser scripts load only the existing Bootswatch stylesheet.

Accessibility target: WCAG 2.2 AA. These checks do not certify full conformance. NVDA/JAWS/VoiceOver, real browser zoom/text resizing, and disabled-user review remain manual release checks. The automated test server uses an in-memory database and leaves local customer data untouched.

## October 19, 2026 — employee login

- Added employee username/password sign-in with separate accounts and eight-hour SQL sessions. There is no public staff registration or default employee credential.
- Added interactive `npm run employee:create` setup, with hidden password entry and confirmation. Verified successful creation and clean exit in a normal Windows terminal using a disposable database. A sandbox terminal could not restore raw input mode on exit; the normal terminal check passed. No test employee was added to the application's customer database.
- Added server checks for both `/employee.html` and `/api/employee/orders`. Customer sessions cannot read employee data. Disabled or expired accounts and logged-out sessions cannot read pending orders.
- Added a Bootstrap-only, read-only workspace showing the 50 oldest pending orders, contact details, items, modifiers, service, and totals. Order acceptance, status changes, and kitchen operations remain unimplemented.
- `npm test`: 13 passing tests, including employee provisioning, hash storage, duplicate usernames, failed login, session rotation/expiry, disabled accounts, customer/employee isolation, protected page redirect/cache behavior, logout, cross-origin writes, and throttling.
- `npm run test:a11y`: 12 passing tests. Added employee login/error states, keyboard submission, signed-in populated workspace, mobile layout, refresh, logout, and protected-page redirects. No axe violations in tested states. This remains automated/keyboard evidence, not a full screen-reader conformance claim.
- Visually inspected employee login on desktop and a populated workspace on desktop and 375px. A synthetic order with double pepperoni and light sauce rendered correctly. No horizontal overflow or custom CSS.

## October 20, 2026 — GitHub Pages publishing fix

The frontend had moved into `Frontend/`, while Pages still used legacy publishing from the repository root. The old deployment completed successfully but served repository documentation instead of the restaurant home page.

Added a Pages workflow that publishes only the built frontend from `main` at the existing project URL. The artifact contains a seed-only menu snapshot, keeps account/order submission explicitly unavailable, and excludes the employee workspace and all server/database/customer files. The Node app keeps its existing API behavior.

Validated with 13 passing API tests, lint, formatting, and 14 passing browser tests, including Pages under `/Luigi-s-Capstone/`, pizza selection, draft persistence, disabled sign-in/submission, artifact exclusions, and mobile layout. The test suite supports an alternate port so an already-running local server can remain untouched.
