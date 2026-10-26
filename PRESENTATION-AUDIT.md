# Presentation audit — October 25, 2026

The main customer-to-kitchen presentation works locally and on the public GCP app. Five issues remain: two cart/recovery issues and three accessibility issues. These are recorded below rather than silently changing application behavior on the presentation deadline.

Tested source: `71fa1f28d9f87dda7baabe54ed80487e17487a03` on `main`. Verified deployed runtime: `92e197afca47e90fab3424f7a9d5e3b5eb3927d3`. There are no differences between those commits in `Frontend/`, `server/`, `Database/`, `package.json`, or `package-lock.json`. The audit adds documentation/evidence only; no runtime deployment is needed.

Public app: <https://pipeline-alberta-drawing-inner.trycloudflare.com/>. The GitHub Pages entry redirected to this app successfully. This is a temporary tunnel address.

Machine-readable, sanitized results: [audit/presentation-2026-10-25.json](audit/presentation-2026-10-25.json). Browser automation used real installed Edge and Chrome on Windows. The deployed VM runs Linux.

## Results

| Check                                                                              | Result                                                                                                                                     |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| ESLint and configured Prettier check                                               | Passed                                                                                                                                     |
| Backend, SQL, authentication, authorization, pricing, migration and workflow tests | 31/31 passed                                                                                                                               |
| Existing Edge browser suite                                                        | 49/49 passed                                                                                                                               |
| Existing Chrome browser suite                                                      | 49/49 passed                                                                                                                               |
| Additional Chrome edge-case probes                                                 | 7 passed, 5 failed; failures map to the five findings below                                                                                |
| Independent client/server pricing comparison                                       | 60,729 cases passed                                                                                                                        |
| Portable demo ZIP                                                                  | Clean dependency installation, startup, customer ordering, staff entry, kitchen transition and restart persistence passed                  |
| Public page scans                                                                  | 21 scans: seven pages at 320, 390 and 1280px; no detected axe violations or horizontal page overflow                                       |
| Approved live rehearsal and extra scans                                            | Two synthetic orders exercised; 19 scans, including staff views and populated updates; one axe rule violation on four notification buttons |
| Public asset consistency                                                           | Seven selected HTML/CSS/JS assets matched local source after line-ending normalization                                                     |
| VM health before and after rehearsal                                               | `/healthz` OK; app and tunnel active; runtime marker unchanged                                                                             |

The pricing matrix covers all 19,683 none/regular/double selections of nine toppings for each of three pizza sizes, alternating quantities 1 and 20. Separate cases cross all 12 sauce/cheese pairs with all quantities 1–20 on each size, with no toppings and all double toppings. All 12 drink variants were checked at every quantity 1–20. This is broad, explicit coverage, not a claim to have tested every possible sequence of user actions.

## Confirmed findings

### F1 — Duplicate order after an uncertain submission is edited

**Priority: high. Functional recovery issue; reproduced locally against the real backend.**

1. Sign in as a customer and put one pizza in the cart.
2. Submit checkout. Allow the server to save the order, but drop its response before the browser receives it. The probe uses Playwright `route.fetch()` followed by `route.abort()` on the first order POST.
3. After the connection error, change the pizza quantity to two and submit again.

**Actual:** two orders are saved, one with quantity one and another with quantity two. Editing creates a new request ID, so the second submission is accepted as a separate order. The interface does not require reconciliation of the uncertain first submission. Retrying the _unchanged_ draft correctly returns the original ticket and passes the existing regression tests.

**Source:** [cart.js](Frontend/js/cart.js#L35) creates a new request ID on every write; [order.js](Frontend/js/order.js#L311) re-enables editing after a failed submission. Compare the staff-entry pending/reconciliation behavior in [employee-entry.js](Frontend/js/employee-entry.js).

**Presentation workaround:** after an uncertain checkout, inspect recent orders/kitchen before editing or starting another submission. If retrying, keep the draft unchanged. Do not demonstrate this failure against the live app.

**Suggested fix:** persist the pending customer submission and reconcile its original request ID before allowing edits/new submission, following the existing staff-entry approach.

### F2 — Open checkout tabs do not synchronize their shared cart

**Priority: medium. Functional issue; reproduced locally.**

1. Add a pizza and open Your order in two tabs in the same browser profile.
2. Change its quantity to two in tab A.
3. Remove it in tab B.

**Actual:** tab A continues to show two pizzas even though the shared stored cart is empty. Each checkout holds an in-memory snapshot. A subsequent edit can overwrite newer changes, and a stale tab can submit items that were removed elsewhere.

**Source:** [order.js](Frontend/js/order.js#L31) reads the cart once and has no storage-event synchronization; quantity/removal handlers write from that snapshot.

**Presentation workaround:** use one customer cart tab. A separate employee tab is fine. Reload customer checkout after editing the cart elsewhere.

**Suggested fix:** listen for cart storage changes, refresh the local snapshot/rendering when safe, and detect a changed cart before submission.

### F3 — Notification buttons' accessible names omit the visible label

**Priority: medium. Accessibility; axe reports serious `label-content-name-mismatch`. Confirmed on the live app and in an isolated local fixture.**

1. Sign in as a customer with an unread kitchen notification.
2. Open Updates.
3. Inspect an individual read button or run axe with `wcag21a` included.

**Actual:** the visible button says **Mark as read**, but its accessible name is **Mark update for order #16 as read** (with the applicable order number). The visible phrase is absent from the accessible name. Voice users trying to activate the button by its displayed wording may have difficulty. Four buttons were flagged in the live rehearsal.

**Source:** [notifications.js](Frontend/js/notifications.js#L96), especially the `aria-label` at line 103. Existing notification scans include `wcag21aa` but omit `wcag21a`, which explains why the existing suite passes while the broader scan detects this issue; see [notifications.spec.js](browser-tests/notifications.spec.js#L112).

**Suggested fix:** use an accessible name such as `Mark as read: update for order #16`, preserving the complete visible phrase, and include `wcag21a` in populated-notification tests. Button clicks and saved read state work in the live rehearsal; this finding concerns accessible naming.

### F4 — Keyboard focus is lost at the notification pagination boundary

**Priority: medium. Accessibility; reproduced with a local two-page notification fixture.**

1. Open Updates with more than one page of messages.
2. Focus **Older updates** using the keyboard and press Enter to reach the last page.

**Actual:** the current button becomes disabled, and focus falls to the page body instead of a visible usable control. The probe checks the active element after the page indicator reaches `Page 2 of 2`. The message list changes correctly; the focus transition fails.

**Source:** [notifications.js](Frontend/js/notifications.js#L49) disables boundary controls; focus restoration covers controls inside the message list and mark-read operations, but not pagination controls.

**Presentation workaround:** the main demonstration needs only one page of updates. When demonstrating older messages, explicitly focus/click Previous updates afterward.

**Suggested fix:** after pagination, restore focus to the activating button if enabled, otherwise the opposite enabled pagination button or the Updates toggle.

### F5 — Home/About overflow with enlarged text on a narrow phone

**Priority: low for the desktop demonstration; accessibility/layout issue. Reproduced locally and visually inspected.**

1. Set the viewport to 320 CSS pixels wide.
2. Set the document root font size to 200% to exercise enlarged-text layout.
3. Open Home and About us.

**Actual:** Home is 342px wide, producing 22px of horizontal overflow. About is 334px wide, producing 14px of overflow. Long words in `#heroTitle`, `#aboutTitle`, and `#pizzaNightTitle` exceed their content widths. The overflow is outside the card-scoped wrapping rules. Menu, checkout, customer login, Visit and employee login fit under the same enlarged-text condition. No axe violations were reported for these pages; layout inspection found the problem.

**Source:** [index.html](Frontend/index.html#L43), [about.html](Frontend/about.html#L23), [about.html](Frontend/about.html#L71), and [responsive.css](Frontend/assets/responsive.css).

**Suggested fix:** allow these long heading words to wrap at narrow widths, then verify both text enlargement and normal heading appearance. Standard text sizes at all six tested widths pass. This combined stress case is documented as observed behavior, without asserting a complete WCAG conformance determination.

## What was exercised

| Area                          | Exercised behavior                                                                                                                                                                                                                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation and assets         | Public pages, category links, pizza sizes, shared header/footer, mobile navigation, images, local links/assets (35 unique URLs), Pages redirect and static-preview behavior                                                                                                                                    |
| Customer authentication       | Registration, login, case-insensitive identity, invalid/duplicate accounts, session rotation/expiry/logout, account isolation and throttling                                                                                                                                                                   |
| Menu and cart                 | Three sizes, nine toppings, regular/double portions, all sauce/cheese options, quantities, all drink types/sizes, mixed and drinks-only drafts, remove/clear, navigation/reload persistence, 20-line limit, invalid quantities, corrupt drafts and blocked storage                                             |
| Checkout                      | Guest-to-login handoff, pickup/dine-in, table clearing on service change, contact validation, instructions as plain text, authoritative prices, confirmation, unchanged lost-response retry, session expiry and modified uncertain retry                                                                       |
| Kitchen                       | Website and phone/counter orders, separate drafts, two staff sessions, revision conflicts, all pizza stages, drinks skipping oven, cancellation/reason, recall, searchable history, queue filtering, sorting, timeouts, connection interruption/recovery, settings, sound toggle and expanded contact/activity |
| Customer progress and updates | Recorded milestones/timers, poll interruption/recovery, account separation, unread delivery across pages, individual/all read, saved read state, recalls/cancellations, notification pagination API and keyboard-boundary UI                                                                                   |
| Staff administration          | Employee/admin separation, staff listing without password fields, new employee/admin accounts locally, duplicate username, confirmation mismatch, login with newly created accounts, non-admin rejection                                                                                                       |
| Persistence and packaging     | SQL migrations/transactions/rollback, account/order/history reopening, extracted portable app installation and actual process restart                                                                                                                                                                          |
| Accessibility and layout      | Axe tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`; skip links, forms/error focus, keyboard ordering, modal Escape/focus return, forced colors, reduced motion, six widths from 320–1280px, landscape/enlarged text and populated staff/customer states                          |

## Approved public rehearsal

One clearly labelled synthetic customer and two labelled **Presentation QA — NO FOOD** orders were created with explicit approval. No existing customer orders were advanced or changed, and no staff accounts were created remotely.

- **Order #16:** large pizza with double pepperoni/light sauce plus a small drink; **$16.00** accepted total matched the browser preview. Pickup, customer registration, kitchen notes, New → Preparing → In oven → Ready → handoff, customer progress and four unread notifications passed. Individual read, mark-all, and read-state persistence after reload passed. The completed ticket was recalled and then cancelled with a QA reason. Final state: **Cancelled**.
- **Order #17:** small drink, **$1.00**, dine-in with `QA no food` table reference. Preparing → Ready → handoff passed without an oven stage. Final state: **Completed**.
- All five staff views were scanned at 320 and 1280px. The cancellation dialog was also scanned. No axe violations or horizontal page overflow were detected in those live states.
- The staff session cookie was Secure. Both rehearsal sessions were logged out; a subsequent staff-account request returned 401. The synthetic customer, tickets and messages remain labelled audit records. Neither ticket remains on the active board.
- Post-rehearsal VM checks returned app/tunnel active and health OK. No app or tunnel restart/deployment was performed.

## Presentation preparation

1. Follow [DEMO-GUIDE.md](DEMO-GUIDE.md) using one customer tab and one staff tab on the same full-app origin. Confirm the intended account roles before starting.
2. Keep **Timed out** in mind: unfinished tickets older than the saved threshold leave the main board without being completed/cancelled. Device preferences persist.
3. Wait for the menu fields, account forms and kitchen Live indicator to finish initializing before acting. An initial live automation attempt clicked registration before its module initialized; it created no account/order. Waiting for initialization allowed the complete rehearsal to pass.
4. If a checkout response is uncertain, inspect recent orders before editing the draft. The unchanged retry path is verified; the edited retry path has finding F1.
5. Keep the portable demo available as the rehearsed local fallback. The public hostname depends on the existing tunnel remaining up.

## Limits and execution notes

This audit does not certify that every possible input, action sequence, browser, assistive technology or outage works. Firefox, Safari, physical-device touch, actual screen-reader speech output, speech-control software and sustained load/concurrent-audience capacity were not tested. Axe reported some incomplete checks (particularly contrast on complex content), so zero detected violations is not full accessibility certification. Enlarged-text screenshots and the public mobile checkout were visually inspected.

Backend and browser suites must run sequentially: both build `.pages/`, and a concurrent start collided. Port 3100 was already occupied, so browser suites used ports 3197/3198. Sandboxed localhost networking initially returned EACCES; authorized reruns with networking passed. These were test-environment problems, not application defects. Two initial probe errors (fieldset semantics and a collapsed settings panel) were corrected before the final results. The normal repository checks stayed green.

Commands run successfully: `npm run lint`, `npm run format:check`, `npm test`, `npm run test:a11y` (Edge), `npm run test:a11y` with `PLAYWRIGHT_CHANNEL=chrome`, and `npm run verify:demo`. Additional one-off Chrome probes, pricing checks and sanitized raw results remain under ignored `demo-dist/presentation-*` on this workstation; the durable sanitized evidence is linked above. No credentials, real customer data, databases or live screenshots are included in the committed audit.
