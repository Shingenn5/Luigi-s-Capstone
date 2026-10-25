# Luigi's Pizzeria

A capstone ordering app using HTML, Bootstrap 5.3.8 (Bootswatch Simplex), plain JavaScript, Node.js 24 LTS, Express, and SQLite. No frontend build step or custom CSS.

For acceptance testing, follow [the customer and kitchen walkthrough](TESTING.md). It includes the full test-site link, order steps, employee access, and recovery checks. Checkout keeps the draft and provides a sign-in link when a customer session expires.

## Run locally

For a portable laptop demo, run `npm run demo` or double-click `start-demo.cmd`. The launcher installs missing server dependencies on first use. See [DEMO.md](DEMO.md) for employee setup, saved data, LAN access, and troubleshooting. `npm run package:demo` creates a clean shareable ZIP in `demo-dist/`; `npm run verify:demo` tests an extracted copy with a fresh database. [GCP hosting instructions](deploy/gcp/README.md) include a Compute Engine installer and systemd service.

1. Install Node.js 24.19 or newer within the 24 LTS release line.
2. Run `npm ci` in this folder.
3. Optionally copy `.env.example` to `.env` and change the settings.
4. Run `npm start` and open http://127.0.0.1:3000.

The server creates `Database/luigis_pizzeria.db`, loads the existing schema and seed menu, and applies versioned migrations automatically. Existing database files are preserved. Back up a populated database before applying schema changes. SQLite files, credentials, and installed packages are ignored by Git.

If you copy `.env.example`, keep `APP_ORIGIN` equal to the exact URL used in your browser. The example uses `http://127.0.0.1:3000`; opening `http://localhost:3000` with that setting will reject form requests. Leave `APP_ORIGIN` unset for local testing across either hostname. When hosting, set the public HTTPS origin and `SECURE_COOKIES=true`, and place the Node app behind HTTPS. The default listener accepts connections only from this computer.

## Pages and scripts

Frontend files live in `Frontend/`: HTML pages, assets, and browser JavaScript. The Node server serves this folder at the website root, so page URLs such as `/menu.html` and asset URLs such as `/assets/logo.svg` stay the same. Backend code, database files, and npm tooling remain at the repository root. Paths below are relative to the repository root.

- `Frontend/index.html`: home, banner, size graphics, and menu category filters.
- `Frontend/menu.html` and `Frontend/js/menu.js`: pizza size, topping checkboxes, regular/double options, sauce and cheese preferences, pizza quantities, drinks, and price preview from the SQL menu.
- `Frontend/order.html` and `Frontend/js/order.js`: editable cart, pickup or dine-in details, pending order submission, and the signed-in customer's latest 50 orders with live progress and elapsed time.
- `Frontend/login.html` and `Frontend/js/login.js`: customer registration and login.
- `Frontend/employee-login.html` and `Frontend/js/employee-login.js`: employee username/password sign-in.
- `Frontend/employee.html` and `Frontend/js/employee.js`: protected kitchen board, manual stages, recall/cancellation, history, and phone/counter order entry.
- `Frontend/about.html`: restaurant introduction with an explicit gap for approved owner/history content.
- `Frontend/visit.html`: service information, project hours, and explicit gaps for verified contact details.
- `Frontend/js/site.js`: shared banner, navigation, footer, account link, and logout. Customer login stays outside the mobile menu. Employee access stays in the footer, including a workspace link for signed-in staff; no employee links appear in the customer header.
- `Frontend/js/cart.js`: browser draft storage and price display helpers. Changing the cart creates a fresh submission identifier.
- `server/auth.js`: salted scrypt password hashes, SQL-backed 12-hour sessions, logout, and throttling at 20 authentication attempts per IP per 15 minutes.
- `server/orders.js`: server validation, authoritative prices, transactions, duplicate-submit protection, and customer-scoped order history.

New JavaScript uses ES modules, camelCase, two spaces, single quotes, and semicolons. Bootstrap provides all layout and styling. The original SQL table and column names remain intact so existing data stays compatible; new migration tables use snake_case.

Pizza-size illustrations are SVG diagrams with a shared canvas and diameter scale (12, 14, and 18 inches). The dashed outline is the 18-inch reference; toppings are illustrative. Regenerate them with `node scripts/build-pizza-graphics.js`. The shared header uses the supplied `Frontend/assets/banner.png` above the navigation.

## Ordering behavior

The menu uses the existing seed prices: small/medium/large pizzas are $5/$7/$9, each selected topping is $1/$2/$3 for the whole pizza, and drinks are $1/$2/$3. There are no per-slice charges. Customers select a topping and choose regular or double; double costs one additional topping charge, as confirmed by the client. A small pizza with pepperoni is $6; with double pepperoni it is $7. Each draft supports 20 item lines and 1–20 pizzas or drinks per line. Menu prices remain sample values awaiting restaurant approval.

Sauce offers Regular, Light, Extra, or None. Cheese offers Regular, Light, or None. These preferences add no surcharge. Choices appear in the cart and saved order history.

Customers can build a cart before login. The cart stays in browser storage across page changes and reloads; passwords and session tokens are never stored there. Browser storage must be enabled. Login or registration returns to checkout with the draft intact. Logout invalidates the server session and keeps the local draft.

The server recalculates totals from SQL and ignores browser-supplied prices. Orders, their items, toppings, sauce/cheese preferences, and service details save together in one transaction. Retrying the same draft uses its submission identifier to return the existing order instead of creating another one. Saved orders are associated with the signed-in customer.

The existing `POST /api/orders` contract uses each line's `menuItemId`, pizza/drink `quantity`, `toppings: [{ toppingId, quantity }]`, and optional pizza `sauce`/`cheese` fields. Topping `quantity` is an internal value of 1 (regular) or 2 (double), not a slice count or a free-form quantity box. The server validates these values. Migration 002 stores preferences without replacing existing orders; older pizzas default to regular sauce and cheese. Orders now enter the employee kitchen board as New (stored as Pending for compatibility).

## Current boundaries

Orders are saved as **Pending**, displayed as **New** in the live employee kitchen. Employees process New → Preparing → In oven → Ready → Completed, enter phone/counter orders, recall tickets, and cancel with a recorded reason. Drink-only orders skip the oven. Tax, payments, delivery, printing, and external customer notifications are not connected. Timers do not automatically advance orders or promise a preparation time. Password reset and email verification are future work. Admins can create staff accounts from the kitchen workspace.

## Employee setup

The demo launcher (`npm run demo` or `start-demo.cmd`) provisions `admin` / `adminadmin` if that username is missing. Existing accounts are preserved. This account keeps normal employee access, despite its username. Normal `npm start` and the GCP service do not provision shared demo credentials.

From this repository folder, run `npm run employee:create` in a normal interactive terminal to add individual employees. Enter a username, display name, role (employee or admin), password, and password confirmation. Password input is hidden, and the command does not print or save the plaintext password. To create your first administrator, run `npm run admin:create` in an interactive terminal on the server using the same `DATABASE_PATH` as the running application. This creates a new account; it never silently promotes or resets an existing username. On GCP, run it from `/opt/luigis` as the service user with `/etc/luigis.env` loaded by an administrator. Accounts created on your laptop are separate from cloud accounts. There is no public employee registration.

Open `/employee-login.html` and sign in using the account you created. Employee usernames use 3–32 letters, numbers, periods, underscores, or hyphens; passwords use 8–128 characters and may contain spaces. Usernames are case-insensitive. Password managers and paste are supported.

Migration 003 adds separate employee and employee-session tables. Employees use eight-hour, HTTP-only, SameSite cookies and hashed passwords. The same HTTPS/secure-cookie configuration applies as for customers. The employee login throttles at 20 attempts per IP per 15 minutes. An inactive account cannot log in or use an existing session.

The server checks access on both the employee page and `/api/employee/orders`. Customer accounts cannot grant themselves employee access. The workspace polls active lanes every two seconds, with 50 tickets per stage page. Completed/cancelled history supports search and pagination. Status changes use expected revisions; competing updates return 409 instead of advancing twice. Interrupted connections retain tickets and pause actions. Submitted item contents cannot be edited; cancel and replace an incorrect order.

Customer and employee sessions are separate and can coexist. **Employee logout** ends employee access; **Customer logout** ends the customer session. After signing in as an admin, choose **Staff accounts**, enter the new staff member details, select **Employee** or **Admin**, and choose **Create account**. Both roles sign in through **Employee login**. Admins retain all kitchen and phone-order features. `POST /api/employee/accounts` requires an active admin session, validates the requested role, and returns only public account details. Migration 005 adds roles and preserves existing employees without granting admin access. Password reset, role changes, and disabling accounts through the browser are future work.

The restaurant address, phone number, owner's biography, and restaurant history require approved content. The displayed 10 AM–11 PM schedule comes from the existing project page and needs confirmation. No invented contact details, map pin, or owner story are included.

GitHub Pages can preview public pages but cannot run the Node server, authentication, SQL menu API, or order submission. Those features require running this app on a Node host with persistent disk storage. API failures are shown on the relevant form.

## GitHub Pages publishing

For public logins, saved orders, and kitchen access, host the full Node app and set the repository Actions variable `FULL_APP_URL` to its public HTTPS origin. The Pages build then generates entry pages that send visitors to that same route on the full app, with a normal link as a fallback. See [public site setup](deploy/PUBLIC-SITE.md). No public backend URL is configured by source changes alone; without that variable, the limited preview below remains in use.

The live preview is [Luigi's Pizzeria](https://shingenn5.github.io/Luigi-s-Capstone/). GitHub Pages must use **GitHub Actions** as its publishing source. `.github/workflows/deploy-pages.yml` builds and publishes the public frontend on every push to `main`, preserving the existing site address. The repository root contains the backend; publishing it directly displays the wrong content after the `Frontend/` move.

`npm run build:pages` copies `Frontend/` into the ignored `.pages/` artifact and generates public menu/topping JSON from a fresh in-memory seed database. It never copies local customer data, orders, credentials, or server files. The employee workspace is excluded. The build sets a preview flag only in the published artifact; the Node app retains its real API behavior.

On Pages, visitors can browse the current menu and build/review a draft cart. Sign-in and sending orders are explicitly unavailable, and their submit buttons are disabled. Running `npm start` continues to support the full local application. Browser tests exercise both modes and the `/Luigi-s-Capstone/` project path. If the default test port is busy, set `TEST_PORT` to an unused port before `npm run test:a11y`.

## Graphics

`Frontend/assets/logo.svg`, `banner.svg`, and `pizza-small.svg`, `pizza-medium.svg`, and `pizza-large.svg` are editable, code-drawn SVG graphics. The size illustrations use different diameters and label the existing 12-, 14-, and 18-inch sizes. They are draft capstone branding, not approved restaurant artwork. No image generation service was used.

`Frontend/assets/pizza.jpg` is the existing illustrative photograph from [Unsplash](https://images.unsplash.com/photo-1513104890138-7c749659a591); it does not depict the restaurant's food.

## Check changes

- `npm test`: HTTP integration tests for authentication, validation, account isolation, pricing, duplicate submission, rollback, and reopening SQLite.
- `npm run lint`: ESLint checks.
- `npm run format:check`: Prettier checks; `npm run format` applies the configured JavaScript style.
- `npm run test:a11y`: Playwright and axe-core browser checks, including keyboard ordering and accessible validation. Uses installed Microsoft Edge by default; set `PLAYWRIGHT_CHANNEL=chrome` to use installed Chrome. Tests run an isolated in-memory server on port 3100 and never modify your local customer database.

## Accessibility

The target is [WCAG 2.2 AA](https://www.w3.org/WAI/WCAG22/Understanding/). Pages use semantic headings, native controls, labelled form groups, focusable skip links, clear current-page navigation, status announcements, and persistent inline errors with a focused summary linking to each invalid field. Bootstrap classes provide darker control borders and readable error-summary links. Password managers and paste remain available. No custom stylesheet, inline CSS, or edits to Bootstrap were added.

Automated scans cover all six pages on desktop and at 320px, plus registration errors, checkout errors, and saved history. Keyboard tests cover topping selection, double options, account creation, checkout, skip links, and mobile navigation. Reduced-motion and forced-colors checks are included. Passing automated checks is not a guarantee of complete accessibility: NVDA/JAWS/VoiceOver testing, browser zoom/text-resizing checks, and testing with disabled users still need a manual release review.

Browser checks are documented in `verification.md`. There is no bundling/build command because the frontend is served directly.

The backend uses Node's built-in [SQLite](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html) and [scrypt](https://nodejs.org/download/release/latest-v24.x/docs/api/crypto.html) APIs.

## Kitchen operation

Use the employee workspace after sign-in. Each stage has a labelled next-step button; Ready remains visible until staff completes handoff. Recall returns a ticket one stage (or restores a cancelled ticket to its previous active stage). Cancellation requires a reason. Migration 004 preserves old orders and records revisions, timestamps, and employee-attributed changes in SQLite. Existing pending-order API responses remain compatible.

The board uses a light POS layout. Warning/overdue ages default to 10/20 minutes, with editable per-device demo settings. Sound is off until enabled by the employee. Stage and age cues include text rather than relying on color. Keyboard users can Tab to ticket selectors and actions; arrows navigate selectors, and Enter/Space selects. Polling preserves focus and does not announce ticking timers.

**Timed out** holds unfinished orders placed at least 120 minutes ago by default. Change this under **Kitchen settings and keyboard help → Save timeout** (1–1440 minutes). The age is measured from order placement across all active stages. Tickets retain their stage and can still be advanced, recalled, or cancelled; customer progress and saved order history are preserved. Raising the timeout can return younger tickets to the main board. The **Order within each stage** control switches between **Newest on top** and **Newest on bottom (oldest first)** on both queue tabs. Timeout and sort preferences are saved per browser/device. Server-side age filtering and sorting happen before the 50-ticket page limit. Completed/cancelled orders remain in history.

**New order** supports Phone/Counter, Pickup/Dine-in, name, pickup phone, optional dine-in table (40 characters), and kitchen notes (500 characters). It uses the same SQL prices and modifiers as customer ordering. Staff drafts are stored per employee on the device, separately from customer carts; shared devices may retain contact details until drafts are cleared. If a submission response is lost, its draft is locked until a saved-order lookup or an idempotent retry resolves it. No default administrative privileges were added.

Employee APIs: `GET /api/employee/kitchen?status=Pending&page=1&search=`, `POST /api/employee/orders`, `GET /api/employee/orders/submissions/:requestId`, and `POST /api/employee/orders/:orderId/status`. Status requests contain `action` (`advance`, `recall`, or `cancel`), `expectedRevision`, and a cancellation `reason`. Kitchen responses include tickets, stage counts, paging, and server time. Staff creation accepts the existing item contract plus customer/service/source/table/notes and a stable request ID. Unknown, stale, invalid, and unauthenticated operations return appropriate errors.

## Customer order tracking

After placing an order, customers follow it under **Your order → Your recent orders**. The page checks the signed-in customer's orders every two seconds while visible. Each order shows received, preparing, in the oven, cut and boxed, and handed-off milestones, with recorded local times, total elapsed time, and time in the current stage. Drink-only orders skip the oven and use Ready instead of Cut and boxed. Completed/cancelled totals stop at the saved terminal timestamp.

Employees use **Employee login → Kitchen board**, then **Start preparing**, **Send to oven**, **Cut and boxed**, and **Complete handoff** on the ticket. Cut and boxed saves the existing Ready status. All steps remain manual. A button applies to the entire order; staff should mark it only once all its pizzas reach that stage. There is no automatic baking countdown or promised ready time.

The customer-scoped `GET /api/orders` response includes a `tracking` object containing `revision`, `createdAt`, `enteredAt`, `serverTime`, and `milestones` (`stage`, `occurredAt`, epoch milliseconds). It reuses migration 004's persisted SQL event history. Recalls remove later milestones, and later re-entry uses its new saved timestamp. Employee identities, staff-only notes, and cancellation reasons are not exposed. Imported historical orders do not receive invented intermediate timestamps.

Customer checkout accepts optional kitchen instructions (500 characters) and a dine-in table reference (40 characters). Migration 006 adds these fields without changing existing orders. They appear on the customer's saved receipt and the employee ticket. The confirmation links directly to the latest order, and each active stage explains the next kitchen step. **Contact and order details** on employee tickets loads recorded activity from `GET /api/employee/orders/:orderId/activity`, including staff names, timestamps, recalls, and cancellation reasons; this endpoint requires an employee session.

## Automated release checks

`.github/workflows/checks.yml` runs locked dependency installation, lint, formatting, backend/database tests, Playwright/axe browser tests, and clean-package restart verification. Branch pushes and pull requests run it directly. The Pages workflow calls the same checks before building or publishing on `main`; failed checks block publication. Windows browser tests default to installed Edge; Linux defaults to Playwright Chromium (`npx playwright install --with-deps chromium`). Set `PLAYWRIGHT_CHANNEL` to override the browser. GCP application deployment remains a separate step following [the release procedure](deploy/gcp/DEVELOPMENT.md).

Interrupted connections retain the last known progress with an explicit stale-data notice and retry automatically. Polling pauses in hidden tabs and resumes on return; expired sessions require login again. Timer ticks are not announced to screen readers, while saved stage changes receive one contextual announcement. Tracking requires the running Node app; the static Pages preview cannot supply live updates or send external notifications.
