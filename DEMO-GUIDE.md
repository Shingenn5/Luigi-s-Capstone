# Luigi's Pizzeria: project demo and study guide

Prepared October 25, 2026 from the current checkout at `ec23d57`, including the mobile-layout changes in `92e197a`. This guide explains the implementation inspected for this demo, rather than assuming older README descriptions are current. Read it once for understanding, then rehearse the demonstration in section 4.

## 1. The project in plain English

Luigi's Pizzeria is a full-stack capstone application connecting customer ordering to a staff kitchen workflow. Customers customize pizzas and drinks, build a cart, sign in, submit pickup or dine-in orders, and follow recorded progress. Staff receive those orders, advance preparation stages, enter phone/counter orders, and review order history. Administrators also create and list staff accounts.

The problem it addresses is the handoff between choosing food and managing its preparation. A restaurant website can display a menu without actually connecting an order to the kitchen. This application demonstrates that connection: the customer's selections, service choice, table reference, and kitchen instructions become a persistent ticket that staff can process, while the customer receives progress and account updates.

Suggested opening:

> Luigi's Pizzeria is a capstone ordering system that connects the customer experience to the kitchen. I'll build and submit a customized order, process that same ticket as an employee, and show the customer's progress updates. I'll also explain how the server validates prices, saves the order, and controls staff access.

Describe the problem and demonstrated behavior as the project's purpose. Do not claim measured improvements in restaurant revenue, order accuracy, or service speed; those outcomes have not been established by this demo.

This is a practice environment. It does not collect payment or fulfill actual restaurant orders.

## 2. What the current screens look like

The customer site has a black branding strip, a light navigation area, red primary actions, a large pizza illustration, and separate Pizza and Drinks category cards. It uses Bootstrap with the Bootswatch Simplex theme. The shared navigation includes Our menu, About us, Visit us, Your order, and customer account controls. Employee access appears in the footer.

The menu presents three illustrated size cards: Small, 12 inches; Medium, 14 inches; Large, 18 inches. Selecting one enables customization. Customers choose whole-pizza toppings, regular or double portions, sauce, cheese, and quantity. Drinks have separate type and size/price controls. On phones, pizza size cards use a compact horizontal layout.

Your order shows editable quantities, removal controls, a subtotal, checkout details, and recent saved orders. After submission it displays confirmation artwork, an order number, and a Track your latest order link. The recent-orders area contains recorded milestones and elapsed time.

Signed-in customers also have an Updates control with an unread count. Its panel contains saved status messages, timestamps, progress links, and read controls.

The employee workspace is currently a light staff interface with bordered ticket panels and stage accents. Its navigation contains Kitchen board, Timed out, New order, Order history, Employee logout, and Staff accounts for administrators. It is a separate work surface rather than the customer storefront with extra buttons pasted on.

About us and Visit us provide supporting presentation content. Visit us currently explains practice ordering and order progress; do not describe it as a verified address, contact, or business-hours directory. The branding's historical wording is not independent verification of restaurant history.

## 3. Roles and implemented capabilities

| Role | Implemented access |
| --- | --- |
| Visitor | Browse public pages, customize items, build and review a browser-local cart |
| Customer | Register/login, submit orders, see their latest 50 orders and progress, read their account updates |
| Employee | Use kitchen stages, recall/cancel tickets, inspect staff activity, enter phone/counter orders, search completed/cancelled history |
| Admin | All employee functions, plus create employee/admin accounts and list existing staff |

Customer and employee sessions are separate and can coexist in the same browser. A customer login does not grant kitchen access. An admin's authority comes from the stored role, not the spelling of their username.

The staff list shows display name, username, role, and active/inactive status. It does not expose passwords or password hashes. Displaying status is not an account-disable feature: changing roles, resetting passwords, and disabling accounts through this screen are future work.

## 4. A rehearsable 10–12 minute demonstration

Use this order throughout the presentation so the audience can follow one record from beginning to end. Prepare two tabs: a customer tab and an authenticated employee/admin tab, both using the same app origin. Separate browser profiles are optional; the application already uses separate session cookies.

### Minute 0–1: introduce the purpose

Start on Home. Give the opening from section 1, point out the two ordering categories, and explain that this is a practice ordering application with no payment collection.

Say:

> The main workflow has two sides: customers describe what they want, and staff control preparation. Both sides use the same saved order data.

### Minute 1–3: customize a pizza and drink

Open Pizza, select Small, select Pepperoni, change its portion to Double, and choose Light sauce with Regular cheese. Keep quantity at one. Add the pizza. Add one Small Iced Tea, then choose Review your order.

With the seed menu, the expected subtotal is:

| Component | Amount |
| --- | ---: |
| Small pizza | $5.00 |
| Double pepperoni: two $1 topping charges | $2.00 |
| Light sauce / regular cheese | $0.00 extra |
| Small Iced Tea | $1.00 |
| Subtotal | **$8.00** |

Say:

> Topping prices apply to the whole pizza. Double adds a second topping charge, and sauce and cheese preferences have no surcharge. The browser previews the price, but the server calculates the accepted total from the SQL menu.

The values above are sample seed prices. Check the actual displayed menu before presenting; changing database prices can change the expected total.

### Minute 3–4: show the cart and sign-in handoff

If starting signed out, point out that the cart can be built before login. Use the checkout sign-in link, then sign in or register. Return to checkout with the existing items intact. Refresh once if you want to demonstrate draft persistence.

Say:

> The draft is stored in this browser, so navigation and login do not erase the selections. That draft is separate from an accepted order in the database. Submission requires an authenticated customer.

Have an existing practice account ready. Creating accounts live adds typing and is optional unless registration is part of your rubric.

### Minute 4–5: submit the order

Use a clearly labelled practice name such as `DEMO - no food`, fictional test contact details, Dine-in, table reference `Demo table`, and kitchen instructions `Presentation practice only - no food.` Select Place order.

Point out the order number and Track your latest order. Show that the saved receipt retains the modifiers, table reference, and notes.

Say:

> The server verifies the customer session, validates the input, recalculates prices, and saves the order and its related records in one transaction. It then becomes available to the kitchen.

For pickup, omit the table reference. The customer checkout requires a phone number for either service choice.

### Minute 5–7: process the matching kitchen ticket

Switch to the staff tab and locate the same order number. Show its items, Double Pepperoni, Light sauce, table, and instructions. Expand Contact and order details to show the staff-only activity area.

Advance with the actual buttons:

| Staff action | Resulting stage |
| --- | --- |
| Start preparing | Preparing |
| Send to oven | In oven |
| Cut and boxed | Ready |
| Complete handoff | Completed |

The initial New label corresponds to `Pending` in storage. The full pizza path is New → Preparing → In oven → Ready → Completed. Drink-only orders go New → Preparing → Ready → Completed.

Switch back to the customer tab after a stage change and allow a couple of seconds for polling. Do not race through every stage if you want the audience to see individual updates arriving.

Say:

> Staff explicitly confirm each stage. The timers report elapsed time; they do not automatically cook, finish, or cancel a ticket. A drinks-only ticket skips the oven because its workflow is different.

### Minute 7–8: show customer progress and updates

Open Updates, show the unread count and saved messages, follow View order progress, and mark an update read. Reload to show that read state persists. You can navigate to Home or Menu and still receive account updates while signed in.

Say:

> These are persistent in-site account messages. Progress and notifications refresh through periodic requests. They are not SMS, email, or push notifications delivered after the browser closes.

The standard pizza path produces updates for Preparing, In oven, Ready, and Completed. Recall and cancellation also generate appropriate messages. Notification links lead to the recent-orders area; the latest 50 orders are available there.

### Minute 8–9: show staff operations

Open Order history and find the completed ticket by order number or customer name. Show recorded activity, timestamps, and employee attribution.

Briefly open New order. Explain that staff can enter Phone or Counter orders using the same menu and pricing logic. These orders do not require a customer account. Staff pickup orders require a phone number; staff dine-in orders can omit it.

If demonstrating recall or cancellation, use a separate labelled ticket or explain that you are correcting the practice ticket. Cancellation requires a reason; staff can see that reason in activity, while customer messages omit it. Recall normally moves a ticket back one workflow step, and recall of a cancelled ticket restores its recorded pre-cancellation stage. Submitted item contents cannot be edited; cancel and replace an incorrect order.

### Minute 9–10: show queue controls and admin access

Show the stage filters, newest-on-top/bottom control, and Timed out tab. Open Kitchen settings and keyboard help.

Explain the distinction between two age features:

- Warning/overdue cues default to 10 and 20 minutes and help staff notice aging tickets.
- The separate queue timeout defaults to 120 minutes from order placement. It moves unfinished tickets into Timed out while preserving their stage and actions.

The timeout accepts 1–1440 minutes. Timeout and sort preferences persist in this browser/device. They are not global restaurant settings. Sorting and queue filtering occur on the server before pagination, with 50 tickets per stage page. Do not wait two hours during the presentation; the audience has suffered enough. If a timed-out example is required, rehearse it with a labelled ticket and a temporary one-minute timeout, then restore the original setting.

If signed in as an admin, open Staff accounts. Show both account creation and the existing staff list. Creating another account is optional. An ordinary employee must not see or use admin account operations.

### Minute 10–12: explain the architecture and close

Use section 5 for the architecture explanation. End with:

> The application demonstrates an order moving from customer customization through server validation and SQL persistence into staff-controlled preparation, then back to the customer as progress and saved updates. The next work would be production integrations and operational readiness, including approved pricing, tax, payments, and external messaging.

If limited to five minutes, keep the opening, one customized order, its matching kitchen ticket, customer progress/Updates, and a short architecture explanation. Skip account creation, timeout demonstrations, and source-code tours.

## 5. Architecture you should be able to explain

```text
Customer browser                    Employee/admin browser
HTML + Bootstrap + JavaScript       Staff HTML + Bootstrap + JavaScript
Local cart                          Separate local staff draft/preferences
         |                                      |
         +---------- HTTP / JSON API ------------+
                             |
                       Express / Node.js
              sessions, permissions, validation
              pricing, order workflow, API responses
                             |
                          SQLite
          accounts, hashed sessions, menu, orders/items,
          preferences, kitchen events, account notifications
```

The application is a single Node/Express server with multiple HTML pages and browser-side ES modules. It is not a React application or a microservice system. There is no frontend bundling step required for the full app. The GitHub Pages packaging script is a separate publishing step.

| Technology | Actual responsibility | Defensible design rationale |
| --- | --- | --- |
| HTML | Page structure, forms, semantic controls | Straightforward page-based UI |
| Bootstrap 5.3.8 | Layout, responsive utilities, controls | Consistent components without a second UI framework |
| Bootswatch Simplex | Customer theme | Shared visual styling for the storefront |
| Plain JavaScript ES modules | Cart, API requests, rendering, polling, interaction | Sufficient for the current interface scope |
| Node.js 24 LTS | Server runtime, crypto, SQLite access | JavaScript backend with useful built-in APIs |
| Express 5 | Routing, middleware, JSON and static-file serving | A compact HTTP application layer |
| SQLite via `node:sqlite` | Persistent relational records | Fits the current single-server deployment and demo packaging |
| Playwright / axe-core | Browser flows and automated accessibility checks | Exercises actual pages and interactions |
| ESLint / Prettier | Static checks and formatting | Consistent source conventions |

These rationales explain how the choices fit the implementation; do not present them as documented historical decisions by every team member. The repo requires Node, SQL, and Bootstrap.

Custom CSS does exist: `Frontend/assets/employee.css` handles staff presentation, and `Frontend/assets/responsive.css` handles narrow-screen exceptions such as 44px controls and long-text wrapping. Say Bootstrap-first with scoped custom CSS. Older claims of zero custom CSS are outdated.

The server opens SQLite with foreign keys enabled and WAL journaling. Database initialization applies the schema, seed statements, and seven tracked migrations. A migration records an incremental database change so existing installations can evolve without replacing all their records.

SQLite is suitable for this capstone's current scope; it is not evidence of unlimited throughput. The database interface is synchronous and SQLite serializes writes. Larger deployments would require workload measurement and potentially a separate database service and different access layer.

## 6. What happens when Place order is clicked

1. Browser code reads the current cart and checkout fields.
2. It sends JSON to `POST /api/orders`, including menu IDs, quantities, topping IDs/portions, preferences, service details, and a submission ID.
3. Express checks the write request's Origin and JSON content type.
4. Authentication resolves the customer from the session cookie and its database record.
5. The server validates the checkout details and checks for an existing order using this customer's submission ID.
6. `priceOrder()` loads the actual menu/topping prices from SQL and calculates the accepted total in integer cents.
7. A transaction inserts the order header, service details, items, topping selections, and pizza preferences. A database trigger initializes workflow and the initial event.
8. The transaction commits, and the response contains the order number and total. A failed insert rolls the transaction back.
9. Staff polling retrieves the new ticket. Later staff actions update workflow and create activity events.
10. A notification trigger creates customer notifications for eligible status events in that same transaction. Customer polling retrieves progress and saved updates.

Useful one-sentence explanation:

> The browser sends the customer's choices; the server decides whether those choices are valid and what they cost; the database stores the accepted order and workflow.

## 7. Pricing, persistence, and reliability

The seed pizza base prices are Small $5, Medium $7, Large $9. Each regular topping costs $1/$2/$3 respectively; double costs twice that size's topping charge. Drinks cost $1/$2/$3 by size. The menu includes Iced Tea, Dr. Pepper, Cola, and UnCola.

```text
pizza unit price = base price + sum(topping price for size × portion)
line total = unit price × item quantity
order subtotal = sum(line totals)
portion = 1 for regular, 2 for double
```

Prices are stored as integer cents. This avoids ordinary binary floating-point surprises in money calculations. Historical charged unit prices are saved with order items and toppings instead of relying only on future menu prices.

Orders accept 1–20 item lines and quantities of 1–20 per line. Sauce choices are Regular, Light, Extra, None. Cheese choices are Regular, Light, None. No tax is calculated, despite the checkout label saying Subtotal before tax.

A transaction means related changes succeed together or are rolled back together. This prevents an order header from being accepted while its item insert fails.

Duplicate-submission protection uses a request identifier. Retrying the unchanged customer draft with the same customer and ID returns the existing order. Changing cart contents generates a new ID. Staff submissions additionally store a content hash and reject conflicting reuse of the same identifier. This handles particular retry scenarios; it is not a promise that no intentional duplicate order can ever be created.

Kitchen concurrency uses an expected revision. If two employees act on the same ticket revision, the first valid action changes the revision. The stale second request receives HTTP 409 and must refresh. This is optimistic concurrency control: detect a conflict rather than silently applying stale instructions.

The kitchen, customer progress, and Updates refresh with approximately two-second polling. They do not use WebSockets. Timing depends on request completion, browser visibility, and connectivity. Staff connection failures retain the displayed tickets and pause mutation controls until the board reconnects.

The customer cart is browser-local. Staff drafts are stored separately, keyed by employee ID, and can include contact details. Neither draft is a cross-device account-synchronized cart. Accepted orders, accounts, workflow events, notifications, and notification read state live in SQL. Clear staff drafts on shared devices.

## 8. The database relationships

| Tables | Purpose |
| --- | --- |
| `Customer`, `customer_sessions` | Customer identity, password hash, expiring hashed session tokens |
| `employees`, `employee_sessions` | Staff identity, role, active status, separate sessions |
| `MenuItems`, `Toppings` | Available products and size-dependent prices |
| `Orders` | Order header, customer/contact fields, timestamp, total, stage |
| `OrderItems` | Menu item, quantity, accepted unit price for each line |
| `OrderItemToppings` | Topping selections, portions, saved topping prices |
| `order_item_preferences` | Sauce and cheese selections |
| `order_details` | Website submission ID, customer association, service, table, notes |
| `staff_order_details` | Staff creator, source, retry hash, service, table, notes |
| `order_workflow` | Current revision and stage-entry timestamp |
| `order_events` | Recorded workflow activity, employee, reason, time, revision |
| `customer_notifications` | Account-owned status messages and read state |
| `schema_migrations` | Applied migration versions |

Explain the main relationship: one customer can have many orders; one order can have many items; one pizza item can have many topping selections. `OrderItemToppings` joins ordered items to toppings. Foreign keys connect valid records, constraints restrict allowed values, and indexes support common lookups. The schema mixes original capitalized table names with newer snake_case names to preserve existing compatibility.

## 9. Security: accurate answers without claiming perfection

Authentication asks who is signed in; authorization asks what that identity may do. The server enforces both. Hiding the Staff accounts tab is presentation; rejecting an unauthorized API request is the actual access control.

- Passwords use randomly salted scrypt hashes, with timing-safe verification. They are not stored as plaintext and are not recoverable through the app.
- Customer sessions last 12 hours; employee sessions last 8 hours. Random raw tokens travel in cookies, while SHA-256 token hashes are stored in SQL. These token hashes serve a different purpose from password scrypt hashes.
- Cookies are HttpOnly and SameSite Strict. Secure cookies depend on the HTTPS deployment setting. HttpOnly prevents ordinary browser JavaScript from reading that cookie; it does not make the whole application immune to attack.
- Login/register throttles limit attempts per IP to 20 in 15 minutes. The counters are in process memory, not a distributed service.
- Write requests require the expected Origin and JSON content type. Server validation remains necessary even with client-side checks.
- SQL statements bind user values through prepared statements. Prices, ownership, roles, IDs, quantities, and workflow changes are checked on the server.
- Customers receive only their own orders and notifications. Staff names and cancellation reasons are omitted from customer progress/messages.
- Only approved frontend routes and assets are served publicly. Backend source, `.env`, SQL scripts, and SQLite files are outside those public routes.
- Response headers include a Content Security Policy, `nosniff`, and same-origin referrer policy. API responses use `Cache-Control: no-store`.

Say: "The application includes specific access controls, validation, session protections, and tests." Do not say "completely secure" or claim an independent security certification. Password reset, email verification, and broader production account-management features are not implemented.

## 10. Hosting, local setup, and the backup plan

Run from the repository folder using Node 24.19 or newer within the Node 24 release line:

```powershell
npm ci
npm run demo
```

Open the URL printed by the launcher, normally `http://127.0.0.1:3000`, and keep its terminal open. A busy port can be handled with:

```powershell
npm run demo -- --port 3001
```

The local demo launcher provisions the documented shared demo employee account if missing; it does not make that account an admin just because its username is `admin`. Existing credentials and active status are preserved. `npm start` and the cloud service do not create shared demo credentials. Use `npm run admin:create` interactively against the intended database to bootstrap an administrator, or use `npm run employee:create` for staff provisioning. Keep passwords out of the presentation and source control.

Normal local data goes in `Database/luigis_pizzeria.db`. Local and cloud databases/accounts are separate. `APP_ORIGIN`, when configured, must exactly match the browser origin, without a path or trailing slash. `localhost` and `127.0.0.1` are different origins. Secure cookies require HTTPS; ordinary local HTTP demos use the corresponding non-secure local configuration.

`npm run demo:lan` enables same-network testing from a phone. The laptop must stay awake and reachable. Install dependencies beforehand; the first setup needs a download. Do not promise fully offline operation for every resource or device without rehearsing it.

The documented cloud deployment uses a Google Compute Engine VM, Node managed by systemd, and persistent SQLite storage at `/var/lib/luigis/luigis.db`. Its application service is `luigis`; the temporary Cloudflare HTTPS tunnel is `luigis-tunnel`. The included tunnel service forwards directly to loopback port 3000. Nginx configuration is available as an optional deployment configuration; do not claim it is the active tunnel path merely because a config file exists.

GitHub Pages cannot execute the Node API or persist SQL orders. Its configured publishing flow provides entry pages to the full app. Without a full-app target, the static preview supports browsing/draft review but not real login or submission. Pushing code to GitHub does not automatically deploy the Node app to the VM.

The documented release process is local changes → local checks → commit/push → archive that exact commit → back up the VM app, environment, and stopped SQLite directory → install → verify cloud behavior. Preserve the tunnel during ordinary application updates because restarting a temporary tunnel can change its hostname.

This guide did not revalidate the public VM or current tunnel availability. Consult `deploy/gcp/LIVE-DEMO.md` and verify the public app before presenting. Its latest mobile-release entry records runtime `92e197afca47e90fab3424f7a9d5e3b5eb3927d3`; documentation commits can be newer than the deployed runtime marker. The first historical block in that file is not necessarily the newest release.

If the public site fails, use the rehearsed local full app. If both are unavailable, use prepared screenshots and explain the workflow honestly. Browser-local drafts survive some connectivity problems; the app is not an offline order-submission system.

## 11. Testing and evidence you can discuss

During preparation of this guide, all 31 backend/database tests and all 49 browser/accessibility scenarios passed. The initial restricted backend run could not connect to its own temporary localhost servers; the successful rerun was outside that restriction. The browser suite passed on an alternate test port because its default port was already occupied.

The backend suite covers registration/sessions, access controls, authoritative prices, transaction rollback, persistence and migrations, customer/staff separation, revision conflicts, queue partitioning, customer handoff, notifications, and publishing behavior. The browser suite covers actual customer/staff flows, keyboard interaction, automated accessibility checks, retry/session recovery, responsive layouts, and static-preview boundaries.

Manual inspection used the current app with an isolated in-memory database and test-only staff accounts. A small double-pepperoni/light-sauce pizza plus a small iced tea produced an $8 dine-in order. Its table and notes appeared in the matching kitchen ticket. Every pizza stage completed through the rendered buttons. The customer received four saved updates, marking them all read survived reload, and the inspected phone page had no horizontal overflow. The admin staff list rendered its public fields. No existing local or cloud customer/order database was used for that rehearsal.

These results support the tested behavior. They do not establish unlimited load capacity, full accessibility conformance, or permanent public availability. Automated accessibility checks were complemented by rendered inspection; they are not a certification.

Useful commands for future verification:

```powershell
npm run lint
npm run format:check
npm test
npm run test:a11y
```

If the browser test server's default port 3100 is occupied, set `TEST_PORT` to an unused port first. Do not stop an unrelated process just to make a test happy.

## 12. Likely questions and strong answers

**Is this just a frontend prototype?** No. Express handles authentication, protected API routes, authoritative order pricing, SQL persistence, and kitchen workflow. The customer storefront is only one part of it.

**Why must a website customer sign in?** Submission associates the order with a customer so history and notifications can be scoped to that account. Visitors can still build a draft. Staff-entered orders follow a separate authenticated staff path without requiring a customer account.

**Why SQLite instead of MySQL or PostgreSQL?** The current app needs persistent relational data on a single server and a portable local demo. SQLite fits that scope with minimal infrastructure. A larger workload may justify a separate database service; the current design is not a horizontal-scaling claim.

**Could a customer change the price in developer tools?** They can change their browser display or request payload, which is why the server loads SQL prices and recalculates the total. The accepted price does not come from the submitted browser total.

**What prevents half an order from saving?** A transaction groups the order, details, items, toppings, and preferences. Failures roll those changes back.

**What if someone clicks twice or loses the response?** The draft's submission ID identifies a retry. Reusing it in the supported scope returns the existing order. A modified cart gets a new identifier. Staff submissions also compare a stored content hash.

**What if two employees click at once?** The request includes the expected ticket revision. A stale action receives 409 rather than silently applying a second transition.

**Are updates real time?** They refresh through roughly two-second polling while the relevant page is active. Say live-updating or near-real-time; the implementation does not use WebSockets.

**Do timers estimate when the food will be ready?** No. They show recorded elapsed time and staff-selected stages. Warning/overdue cues and queue timeout do not promise a preparation time.

**Does Timed out mean cancelled?** No. It is a different queue view for unfinished old orders. Tickets keep their stage and remain actionable.

**Does the admin username grant admin rights?** No. A stored role controls authorization. The local demo account named admin is ordinarily an employee account unless explicitly provisioned otherwise.

**Do customers get text messages?** No. They get persistent in-site account updates. Email, SMS, and closed-browser push are not configured.

**Can staff edit a submitted pizza?** No. Cancel the incorrect order and create a replacement. Recall changes workflow progress rather than item contents.

**Does it work after restart?** Accepted records and sessions persist in SQLite subject to their validity/expiry. Drafts remain in that browser's storage. The tests cover reopening/persistence; a particular deployment must still preserve its database directory.

**Is it ready for a real restaurant?** It demonstrates an integrated ordering/kitchen workflow. Production operation still needs approved business information/prices, tax/payment integration, operational controls, and further validation.

**What was the hardest engineering work?** A defensible technical answer is keeping customer, kitchen, and database state consistent under retries, concurrent staff actions, and connection failures. Tie that answer to transactions, submission IDs, revisions, polling, and private projections. Only call it your personal hardest task if that accurately reflects your contribution.

**What did you personally build?** Answer with your actual work and your teammates' contributions. This guide does not establish authorship. If AI tools assisted, describe the assistance and your review/testing accurately rather than claiming every line was hand-written.

## 13. Implemented features versus future work

| Implemented | Not connected / not implemented |
| --- | --- |
| Customer accounts and separate staff accounts | Password reset and email verification |
| Cart, pizza/drink customization, SQL pricing | Restaurant-approved production pricing and tax |
| Pickup and dine-in practice order submission | Delivery workflow and actual food fulfillment |
| Kitchen stages, recall, cancellation, activity | Automatic cooking, readiness, or promised ETA |
| Phone/counter entry | Payment gateway, card handling, refunds |
| Recent customer orders and staff history | Full reporting/analytics and inventory management |
| Persistent in-site customer notifications | Email, SMS, closed-browser push |
| Admin account creation and staff list | Browser role editing, password resets, disabling accounts |
| Responsive layouts and accessibility checks | Independent accessibility/security certification |
| Persistent VM deployment and portable demo | Proven high-load/distributed scaling |

Prioritize production business approval and operating requirements before adding speculative features. A payment integration, for example, would require decisions about payment/order states, callbacks, failure handling, and deployment configuration, not merely a Pay button.

## 14. Source map for technical questions

All paths below are relative to the repository root.

| Source | Read it for |
| --- | --- |
| `server.js`, `server/config.js` | Startup, environment configuration, graceful shutdown |
| `server/app.js` | Middleware, security headers, route mounting, public-file boundaries |
| `server/database.js` | SQLite setup, seed loading, migration tracking, menu queries |
| `server/auth.js`, `server/passwords.js` | Customer sessions, password hashing, authentication throttle |
| `server/employees.js` | Staff sessions, admin account authorization/listing |
| `server/orders.js` | Price validation, customer submission, transaction, order ownership |
| `server/kitchen.js` | Staff entry, revision checks, transitions, queue filtering and activity |
| `server/order-tracking.js` | Customer-facing workflow milestones without staff-only details |
| `server/notifications.js` | Notification ownership, pagination, read state |
| `Database/schema.sql`, `Database/seed.sql` | Original relational structure and sample menu |
| `Database/migrations/` | Seven incremental changes, including notification trigger in 007 |
| `Frontend/js/site.js` | Shared branding/nav/footer, account controls, Updates setup |
| `Frontend/js/menu.js`, `cart.js`, `order.js` | Menu interaction, local draft, checkout/progress |
| `Frontend/js/employee.js`, `employee-entry.js` | Staff board and separate staff draft/order entry |
| `Frontend/js/employee-accounts.js` | Staff creation and existing-account table |
| `Frontend/js/notifications.js` | Updates panel, polling, announcements and read controls |
| `Frontend/assets/responsive.css`, `employee.css` | Current responsive exceptions and staff styling |
| `test/`, `browser-tests/` | Backend/database evidence and browser scenarios |
| `deploy/gcp/DEVELOPMENT.md`, `LIVE-DEMO.md` | Required release procedure and recorded cloud verification |

Some older prose in README/DEMO describes superseded behavior: zero custom CSS, dark-mode staff defaults, no admin role, and older Visit content. Use the current source and rendered screens for those details.

## 15. Rehearsal checklist and vocabulary

- Start the exact local or public app you intend to demonstrate; verify `/healthz`.
- Confirm the customer and employee tabs use the same origin and database environment.
- Verify both logins privately; confirm the staff account's actual role.
- Rehearse the $8 sample order and check current menu prices.
- Label practice orders clearly. Do not use existing unrelated tickets as demonstration props.
- Keep one completed example available in history as a fallback.
- Check browser zoom, projector readability, mobile layout, and the selected queue sort/timeout.
- Use the current light staff workspace; do not promise controls removed from older versions.
- Explain every click's purpose instead of reading every field label aloud.
- Keep credentials, real contact details, environment files, and session cookies off the projector.
- Finish or cancel your own practice tickets, restore any changed queue preferences, and log out afterward.

| Term | Meaning in this project |
| --- | --- |
| Frontend | The pages and JavaScript running in the browser |
| Backend | The Node/Express application handling requests and business rules |
| API | HTTP endpoints the browser calls to read or change server data |
| Session | A temporary authenticated identity linked to a cookie |
| Authorization | The server's decision about what an identity may access |
| Transaction | Related SQL changes that commit or roll back together |
| Migration | A tracked incremental database-schema change |
| Idempotency | Recognizing a retried submission so it can return the existing result |
| Optimistic concurrency | Rejecting stale ticket actions using an expected revision |
| Polling | Requesting updated data at intervals |
| Persistence | Retaining saved data beyond a page reload or app process restart |
| Source of truth | SQL records and server decisions governing accepted orders |

**TL;DR:** Rehearse one complete story: customize → sign in → submit → find the matching kitchen ticket → advance stages → show customer progress and Updates → show history/admin access → explain Node, Express, SQLite, transactions, retry IDs, and revisions. Be precise about the limits: practice orders, sample prices, manual stages, no payments/tax/delivery/external messaging.
