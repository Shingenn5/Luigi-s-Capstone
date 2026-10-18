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

- `index.html`: home, banner, size graphics, and menu category filters.
- `menu.html` and `js/menu.js`: pizza size, topping portions, quantities, drinks, and price preview from the SQL menu.
- `order.html` and `js/order.js`: editable cart, pickup or dine-in details, pending order submission, and the signed-in customer's latest 50 orders.
- `login.html` and `js/login.js`: customer registration and login.
- `about.html`: restaurant introduction with an explicit gap for approved owner/history content.
- `visit.html`: service information, project hours, and explicit gaps for verified contact details.
- `js/site.js`: shared navigation, account link, and logout. Login stays outside the mobile menu.
- `js/cart.js`: browser draft storage and price display helpers. Changing the cart creates a fresh submission identifier.
- `server/auth.js`: salted scrypt password hashes, SQL-backed 12-hour sessions, logout, and throttling at 20 authentication attempts per IP per 15 minutes.
- `server/orders.js`: server validation, authoritative prices, transactions, duplicate-submit protection, and customer-scoped order history.

New JavaScript uses ES modules, camelCase, two spaces, single quotes, and semicolons. Bootstrap provides all layout and styling. The original SQL table and column names remain intact so existing data stays compatible; new migration tables use snake_case.

## Ordering behavior

The menu uses the existing seed prices: small/medium/large pizzas are $5/$7/$9, each topping portion is $1/$2/$3 per pizza, and drinks are $1/$2/$3. Each draft supports 20 item lines, 1–20 items per line, and 0–10 portions of each topping. These are sample prices and application limits awaiting client approval.

Customers can build a cart before login. The cart stays in browser storage across page changes and reloads; passwords and session tokens are never stored there. Browser storage must be enabled. Login or registration returns to checkout with the draft intact. Logout invalidates the server session and keeps the local draft.

The server recalculates totals from SQL and ignores browser-supplied prices. Orders, their items, topping portions, and service details save together in one transaction. Retrying the same draft uses its submission identifier to return the existing order instead of creating another one. Saved orders are associated with the signed-in customer.

## Current boundaries

Orders are saved as **Pending**. Restaurant acceptance, employee/CSR access, kitchen workflow, preparation times, tax calculation, and payment processing are not connected. Saving an order does not notify a restaurant or charge a card. Password reset, email verification, and account administration are future work.

The restaurant address, phone number, owner's biography, and restaurant history require approved content. The displayed 10 AM–11 PM schedule comes from the existing project page and needs confirmation. No invented contact details, map pin, or owner story are included.

GitHub Pages can preview public pages but cannot run the Node server, authentication, SQL menu API, or order submission. Those features require running this app on a Node host with persistent disk storage. API failures are shown on the relevant form.

## Graphics

`assets/logo.svg`, `banner.svg`, and `pizza-small.svg`, `pizza-medium.svg`, and `pizza-large.svg` are editable, code-drawn SVG graphics. The size illustrations use different diameters and label the existing 12-, 14-, and 18-inch sizes. They are draft capstone branding, not approved restaurant artwork. No image generation service was used.

`assets/pizza.jpg` is the existing illustrative photograph from [Unsplash](https://images.unsplash.com/photo-1513104890138-7c749659a591); it does not depict the restaurant's food.

## Check changes

- `npm test`: HTTP integration tests for authentication, validation, account isolation, pricing, duplicate submission, rollback, and reopening SQLite.
- `npm run lint`: ESLint checks.
- `npm run format:check`: Prettier checks; `npm run format` applies the configured JavaScript style.

Browser checks are documented in `verification.md`. There is no bundling/build command because the frontend is served directly.

The backend uses Node's built-in [SQLite](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html) and [scrypt](https://nodejs.org/download/release/latest-v24.x/docs/api/crypto.html) APIs.
