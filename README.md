# Luigi's Pizzeria

A capstone ordering app using HTML, Bootstrap 5.3.8 (Bootswatch Simplex), plain JavaScript, Node.js 24 LTS, Express, and SQLite. No frontend build step or custom CSS.

## Run locally

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
- `Frontend/order.html` and `Frontend/js/order.js`: editable cart, pickup or dine-in details, pending order submission, and the signed-in customer's latest 50 orders.
- `Frontend/login.html` and `Frontend/js/login.js`: customer registration and login.
- `Frontend/employee-login.html` and `Frontend/js/employee-login.js`: employee username/password sign-in.
- `Frontend/employee.html` and `Frontend/js/employee.js`: protected, read-only pending orders, refresh, and employee logout.
- `Frontend/about.html`: restaurant introduction with an explicit gap for approved owner/history content.
- `Frontend/visit.html`: service information, project hours, and explicit gaps for verified contact details.
- `Frontend/js/site.js`: shared navigation, account link, and logout. Login stays outside the mobile menu.
- `Frontend/js/cart.js`: browser draft storage and price display helpers. Changing the cart creates a fresh submission identifier.
- `server/auth.js`: salted scrypt password hashes, SQL-backed 12-hour sessions, logout, and throttling at 20 authentication attempts per IP per 15 minutes.
- `server/orders.js`: server validation, authoritative prices, transactions, duplicate-submit protection, and customer-scoped order history.

New JavaScript uses ES modules, camelCase, two spaces, single quotes, and semicolons. Bootstrap provides all layout and styling. The original SQL table and column names remain intact so existing data stays compatible; new migration tables use snake_case.

## Ordering behavior

The menu uses the existing seed prices: small/medium/large pizzas are $5/$7/$9, each selected topping is $1/$2/$3 for the whole pizza, and drinks are $1/$2/$3. There are no per-slice charges. Customers select a topping and choose regular or double; double costs one additional topping charge, as confirmed by the client. A small pizza with pepperoni is $6; with double pepperoni it is $7. Each draft supports 20 item lines and 1–20 pizzas or drinks per line. Menu prices remain sample values awaiting restaurant approval.

Sauce offers Regular, Light, Extra, or None. Cheese offers Regular, Light, or None. These preferences add no surcharge. Choices appear in the cart and saved order history.

Customers can build a cart before login. The cart stays in browser storage across page changes and reloads; passwords and session tokens are never stored there. Browser storage must be enabled. Login or registration returns to checkout with the draft intact. Logout invalidates the server session and keeps the local draft.

The server recalculates totals from SQL and ignores browser-supplied prices. Orders, their items, toppings, sauce/cheese preferences, and service details save together in one transaction. Retrying the same draft uses its submission identifier to return the existing order instead of creating another one. Saved orders are associated with the signed-in customer.

The existing `POST /api/orders` contract uses each line's `menuItemId`, pizza/drink `quantity`, `toppings: [{ toppingId, quantity }]`, and optional pizza `sauce`/`cheese` fields. Topping `quantity` is an internal value of 1 (regular) or 2 (double), not a slice count or a free-form quantity box. The server validates these values. Migration 002 stores preferences without replacing existing orders; older pizzas default to regular sauce and cheese. Restaurant/kitchen integration remains separate future work.

## Current boundaries

Orders are saved as **Pending**. Employees can sign in and view pending orders. Restaurant acceptance, CSR/phone order entry, kitchen workflow, preparation times, tax calculation, and payment processing are not connected. Saving an order does not notify a restaurant or charge a card. Password reset, email verification, and browser-based account administration are future work.

## Employee setup

From this repository folder, run `npm run employee:create` in a normal interactive terminal. Enter a username, display name, password, and password confirmation. Password input is hidden, and the command does not print or save the plaintext password. There is no default employee account, shared password, or public employee registration.

Open `/employee-login.html` and sign in using the account you created. Employee usernames use 3–32 letters, numbers, periods, underscores, or hyphens; passwords use 8–128 characters and may contain spaces. Usernames are case-insensitive. Password managers and paste are supported.

Migration 003 adds separate employee and employee-session tables. Employees use eight-hour, HTTP-only, SameSite cookies and hashed passwords. The same HTTPS/secure-cookie configuration applies as for customers. The employee login throttles at 20 attempts per IP per 15 minutes. An inactive account cannot log in or use an existing session.

The server checks access on both the employee page and `/api/employee/orders`. Customer accounts cannot grant themselves employee access. The workspace shows up to 50 oldest pending orders with customer contact details, pickup/dine-in selection, items, modifiers, and totals. Refresh is manual. It cannot accept, edit, or complete orders yet.

Customer and employee sessions are separate and can coexist. **Employee logout** ends employee access; **Customer logout** ends the customer session. Account creation is a local setup operation; employee account management and password reset screens are future work.

The restaurant address, phone number, owner's biography, and restaurant history require approved content. The displayed 10 AM–11 PM schedule comes from the existing project page and needs confirmation. No invented contact details, map pin, or owner story are included.

GitHub Pages can preview public pages but cannot run the Node server, authentication, SQL menu API, or order submission. Those features require running this app on a Node host with persistent disk storage. API failures are shown on the relevant form.

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
