# GCP demo deployment

## Latest teammate changes — October 25, 2026

Runtime commit `27c1398806506a7fd68b6b4163ad3ece9cc34547` is deployed. It includes the four incoming GitHub commits through `07baa98` (admin staff-account list, favicon references, formatting and accessibility fixes), plus staff-list API verification for anonymous/employee rejection, admin access, and absence of password fields. GitHub main matched the runtime SHA before export. Archive SHA-256: `af96df44eba6c7c3f8abf63d09573ef95927068735d5f5e08101d705a91af9b3`.

Previous app, environment, and stopped SQLite-directory backups are retained at `/var/backups/luigis/27c1398806506a7fd68b6b4163ad3ece9cc34547-20261026T015445Z` (UTC timestamp). Every installed archive file matched. Lockfile and service configuration were unchanged. App health, both services, SQLite integrity, foreign keys, and migration 007 passed. The tunnel remained running with its existing public hostname.

Local verification passed lint, formatting, all 31 backend/database tests, and all 42 browser/accessibility scenarios. Initial sandbox network restrictions and a browser-test port conflict were resolved before successful reruns. Incoming formatting warnings were line-ending normalization; no application logic was changed during release preparation. Public Chrome checks at desktop/mobile widths passed health, unauthenticated staff-list rejection, deployed listing JavaScript, favicon retrieval, and login-page reflow. After explicit owner approval, authenticated public Chrome verification passed admin login with a Secure cookie, staff-list API response fields without password data, and listing/refresh at 1280px and 390px without viewport overflow. The mobile screenshot was visually inspected. Initial verification attempts clicked before the asynchronous staff module initialized; waiting for the form's actual disabled property resolved the test readiness issue. The final verification session was logged out and subsequent staff-list access returned 401. No live orders or accounts were created.

OS Login and narrowly scoped IAP access were configured for both existing project teammates; see [ACCESS.md](ACCESS.md). A fresh owner OS Login session and sudo succeeded. Teammates must verify their own connections. This deployment record is a documentation-only follow-up to the runtime SHA above.

Verified on October 21, 2026. This records deployment evidence, not a guarantee of permanent availability or zero billing.

- Project: `luigis-pizzeria-512320`.
- VM: `luigis-demo`, `us-central1-a`, one non-Spot `e2-micro`.
- Boot disk: 20 GB `pd-standard`, retained on VM deletion.
- Network: `luigis-vpc`, dual-stack subnet `luigis-central`; internal IPv4 and external IPv6, no external IPv4, Cloud NAT or load balancer.
- Administration: IAP SSH, ingress TCP 22 restricted to `35.235.240.0/20`.
- Application source deployed: `39c0ceb`. Concurrent uncommitted website work was not included.
- App: `/opt/luigis`, Node 24.22.1, systemd `luigis`, loopback port 3000.
- Persistent SQLite: `/var/lib/luigis/luigis.db`. The cloud started fresh; laptop accounts and orders were not copied.
- Configuration: `/etc/luigis.env`, root-only, HTTPS `APP_ORIGIN`, secure cookies and loopback proxy trust enabled.
- Tunnel: systemd `luigis-tunnel`, official cloudflared 2026.10.3, IPv6 edge connections with HTTP/2.
- Binary SHA256: `053b80b0a23031a038fdbf3c073f59f82b8f1f152aa67971d7383ffafc0dbab0`.
- Current HTTPS origin: <https://pipeline-alberta-drawing-inner.trycloudflare.com>.
- Public entry: <https://shingenn5.github.io/Luigi-s-Capstone/>. Repository variable `FULL_APP_URL` points to the HTTPS origin.
- Pages publication: [successful run 39672944250](https://github.com/Shingenn5/Luigi-s-Capstone/actions/runs/39672944250).

The cloud employee username is `admin`, with a unique generated password rather than the laptop demo password. The private local handover is `demo-dist/cloud-login.txt`, excluded from Git and application packages. No credentials are recorded here. Public systemd startup does not seed the shared local demo account.

## Order-testing update — October 21, 2026

Application commit `ed4b38f` is deployed at the same HTTPS origin. This includes customer milestone tracking, the Place order checkout action, and expired-session recovery that preserves the draft. No schema, dependency, tunnel, or infrastructure change was required.

The previous app source, stopped SQLite data directory, and environment configuration were backed up under `/var/backups/luigis/ed4b38f-20261022T004014Z` (UTC directory timestamp). The first start encountered a staging-directory permission problem; restoring `/opt/luigis` to mode 0755 resolved it. Both app and tunnel services are active. Deployed JavaScript matches the committed archive, with CRLF line endings from Windows Git export.

Validation: 25 backend tests passed. All 27 browser scenarios passed across the main run and a focused rerun after correcting two assertions to inspect the disabled submit button. Lint and formatting checks passed. A public browser created an account, built a pizza with double pepperoni/light sauce plus a drink, and placed synthetic $8 order #2. Employee API checks confirmed its ticket contents and advanced it through the kitchen; the customer browser received live progress through handoff. The customer session, completed order, and kitchen history survived an app-service restart. The synthetic session was logged out afterward. Desktop/mobile screenshots were visually reviewed; no payments were collected.

Use [the acceptance-testing walkthrough](../../TESTING.md) for customer and staff order steps.

## Staff account creation — October 21, 2026

Runtime commit `e5db8cdb85ff38da04104d0607ed6acd82978ed5` is deployed at the same HTTPS origin. Migration 005 adds employee/admin roles; existing accounts retain employee access. The existing private cloud `admin` account was explicitly granted the admin role during this release, with its password preserved. Sign in through **Employee login → Staff accounts** to create either role. New servers can bootstrap an admin with `npm run admin:create` against their configured database.

The previous source, stopped SQLite data directory, and environment configuration are backed up under `/var/backups/luigis/e5db8cd-20261022T015338Z`. The release archive SHA-256 was verified before installation, and deployed account code/migration matched that archive. Both app and tunnel services remained active after the release and an app-only persistence restart; the tunnel hostname was preserved.

Validation: lint and formatting passed, all 27 backend tests and all 29 browser scenarios passed, and the desktop/mobile renders were visually inspected. On the public HTTPS site, Chrome created labelled temporary employee and admin accounts through the form at 1280px and 390px. Both roles logged in before and after an app restart, and ordinary employees were rejected when attempting account creation. Verification sessions were logged out; both temporary accounts and their associated sessions were deleted, and cleanup metadata was removed. Test passwords remained in memory. Edge automation could not navigate to the public employee page in this environment; Chrome completed the live checks.

This entry is deployment evidence added after the runtime release; its documentation commit is separate from the deployed runtime SHA.

## Verified behavior

### Customer-to-kitchen handoff release — October 22, 2026

Runtime commit `741bba09dfdfd04e2a9b86380f341c9468902352` is deployed at the same public HTTPS origin. The owner explicitly approved this GCP deployment after the source changes were pushed and tested. The uploaded Git archive SHA-256 was `3f96438a0ef306a8e57d39487099cad9f5aec399f6247de9c614eebd0f96b2b8`; the VM verified it before installation. Changed deployed frontend/backend files and migration 006 match the committed archive.

The previous source, stopped SQLite data directory, and environment configuration are backed up under `/var/backups/luigis/741bba0-20261022T190544Z`. That backup directory is root-only. The existing database and environment configuration were preserved; migration 006 applied successfully, `PRAGMA integrity_check` returned `ok`, and the foreign-key check returned no violations. Both `luigis` and `luigis-tunnel` are active. Only the app was restarted, preserving the tunnel hostname.

The [release pipeline](https://github.com/Shingenn5/Luigi-s-Capstone/actions/runs/39835541021) passed all application checks, Pages build, and Pages publication for this runtime commit. Local checks also passed: locked install, lint, formatting, 29 backend/database tests, 31 browser/accessibility scenarios, and clean-package restart verification.

Public Chrome verification followed the Pages entry to the full app, checked the square logo, registered a labelled synthetic customer, and submitted $8 dine-in order #6 with double pepperoni, light sauce, a drink, table `QA-12`, and kitchen instructions. The employee ticket retained the modifiers/table/instructions and showed employee-attributed activity. Native employee controls advanced the order through Preparing, In oven, Ready, and Completed; customer progress followed every stage. Desktop/mobile renders were visually inspected without horizontal overflow or uncaught page errors. Customer access to the staff activity endpoint returned 401.

An app-only restart retained the customer account, completed order, table/instructions, and all five recorded activity events. Verification sessions were logged out; temporary local verification credentials were removed. The synthetic completed order remains labelled as a test. Earlier automated live-check attempts needed corrected route/readiness assertions; the completed public journey and post-restart checks passed. No payments, real food fulfillment, or external notifications were involved.

This deployment evidence is a documentation-only follow-up to the runtime commit above; the documentation commit does not represent a newer deployed application build.

All 24 existing Node tests passed before publishing. Public HTTPS probes verified health, unauthorized kitchen rejection, customer registration/login/logout, Secure session cookies, server-calculated prices, duplicate-submit protection, all four kitchen advances and HTTP 409 for stale revisions. A synthetic $22 order labelled `Deployment test - no food` reached Completed. Employee/customer login, the order and completed history survived a Node service restart. Browser verification confirmed signed-in customer history and the live Pages redirect. The synthetic browser session was logged out afterward.

## Operating the demo

Use the authenticated Google Cloud CLI with `--project=luigis-pizzeria-512320`, `--zone=us-central1-a` and `--tunnel-through-iap` for SSH/SCP. The repository's local CLI is under the ignored `demo-dist/tools/google-cloud-sdk` directory; credentials use the normal user gcloud configuration.

For initial installation, upload a committed source ZIP and the checksum-verified official Linux cloudflared binary, extract the source, then run:

```sh
sudo bash deploy/gcp/install-free-tier.sh /path/to/cloudflared-linux-amd64 SHA256
```

For application updates, deploy a reviewed committed source archive and run `deploy/gcp/install.sh`; preserve `/var/lib/luigis` and `/etc/luigis.env`. Restarting only `luigis` preserves the running tunnel hostname. Do not restart the tunnel during routine application updates.

Quick Tunnel has no uptime guarantee. A tunnel process/VM restart generates a different hostname. Read it from `sudo journalctl -u luigis-tunnel --no-pager`, update `APP_ORIGIN` in `/etc/luigis.env`, restart only `luigis`, update GitHub's `FULL_APP_URL`, and dispatch `deploy-pages.yml` on `main`. Verify public login and ordering again. A stable named hostname requires separate domain configuration.

This configuration targets the ongoing free-tier allowances; it does not enforce a spending cap. Monitor billing and outbound traffic. Do not add paid IPv4, NAT, snapshots, larger resources or other paid services without the owner's approval. See [FREE-TIER.md](FREE-TIER.md) for eligibility and limits.

## Pizza artwork update — October 23, 2026

Runtime release `0787960427f85ecd5fc48089497af44dc812c141` was pushed to main, exported with Git archive, and deployed to `luigis-demo`. The uploaded archive SHA-256 was verified before extraction. Before installation, the previous app, environment, and stopped SQLite directory were backed up under `/var/backups/luigis/0787960427f85ecd5fc48089497af44dc812c141-20261023T224431Z`. The tunnel was left running.

The three pizza illustrations now show the cheese base in consistent close-up frames. Menu and homepage references use a new asset version to refresh cached images. Card copy explains that the illustrations are not a shared-scale size comparison. No custom CSS was required.

Local checks passed: lint, formatting, 29 backend/database tests, and 17 targeted browser/accessibility tests, with desktop and mobile screenshots inspected. VM verification confirmed the installed frontend matches the archive, the app health endpoint succeeds, and both services are active. Public HTTPS checks in Chrome passed at 1280px and 390px: all three images load at 480 by 360 intrinsic dimensions, large-pizza selection updates the total to $9, and the homepage medium-pizza image selects medium on the menu. Public SVG contents match the committed files after normalizing Git archive CRLF/LF conversion. Edge aborted public navigation; Chrome completed verification.

This deployment-evidence entry is a documentation-only follow-up; the runtime deployment marker remains `0787960427f85ecd5fc48089497af44dc812c141`.

## Supplied SVG graphics integration — October 23, 2026

Runtime commit `87a60dfb635d14c356ae555dec4854c9eecaa02c` was pushed and deployed from its verified Git archive. Existing app, environment, and stopped database directory backups are retained at `/var/backups/luigis/87a60dfb635d14c356ae555dec4854c9eecaa02c-20261024T013740Z`. The app health endpoint passed and both app and tunnel remained active after deployment; installed frontend files match the archive.

The supplied Pizza and Drinks tiles navigate to real menu sections on the homepage and menu. The supplied confirmation graphic is revealed only after a successful order submission. Current logo, banner, and slice-count pizza illustrations are unchanged. Unsupported menu categories and replacement branding were excluded.

Validation passed: lint, formatting, 29 backend tests, and 21 browser/accessibility checks including mobile pickup/dine-in confirmations and desktop/mobile category navigation. Desktop/mobile screenshots were inspected. Public HTTPS Chrome checks at 1280px and 390px verified category links, no horizontal overflow, all three SVG contents against the commit after line-ending normalization, and a hidden confirmation image before order submission. Public order submission was not repeated for this presentation-only integration; successful confirmation rendering was verified in the local checkout regression tests.

This entry is a documentation-only follow-up to the deployed runtime commit above.

## Unified customer ordering flow — October 24, 2026

Runtime commit `b4162ce91b89943e0c1c1c9e8c749b26dbdb9ba3` was pushed and deployed from its checksum-verified Git archive. App, environment, and stopped SQLite-directory backups are retained at `/var/backups/luigis/b4162ce91b89943e0c1c1c9e8c749b26dbdb9ba3-20261024T145553Z`. The installed frontend matches the archive. The obsolete homepage filter script was removed from the VM as well as the source. Both services and app health passed after deployment; the public tunnel was preserved.

The homepage now provides fully clickable Pizza and Drinks category cards, with all size selection and customization on the menu. Duplicate homepage size cards, price lists, filters, and Choose options links were removed. The hero uses the same pizza illustration as the menu and links to ordering. Menu category links use the supplied graphics alongside descriptions. Existing branding and 6/8/10-slice size illustrations remain unchanged. Bootstrap utilities and cards handle the layout without new custom CSS.

Validation: lint, formatting, and 29 backend tests passed. The initial 35-test browser run exposed accessible-name mismatches in the new category cards; those were fixed and all 15 accessibility tests passed on rerun. After updating test selectors for descriptive category labels, all four desktop/mobile category and size-selection tests passed. The remaining checkout, kitchen, tracking, and Pages tests passed in the full run. Desktop and mobile screenshots were inspected. Public HTTPS Chrome checks at 1280px and 390px confirmed all homepage images are links, no Choose options duplicates, category navigation, large-size selection and $9 base pricing, no horizontal overflow, and supplied SVG contents matching the commit after line-ending normalization. Checkout confirmation remains hidden before submission; no live synthetic order was created for this presentation/navigation change.

This deployment record is a documentation-only follow-up; the deployed runtime marker remains the commit above.

## Drinks selection and feedback — October 24, 2026

Runtime commit `b96594b8c5c5dd88ac601091cb5b7e3ba5cc35aa` was pushed and deployed from its checksum-verified archive. Backups of the app, environment, and stopped SQLite directory are retained at `/var/backups/luigis/b96594b8c5c5dd88ac601091cb5b7e3ba5cc35aa-20261024T172221Z`. Installed frontend files match the archive; app health and both services passed. The public tunnel was preserved.

Drinks now use separate type and size/price selects with a live quantity total. Switching types preserves the chosen size when that size is available. Drink and pizza additions show feedback next to their respective buttons. An Add drinks link provides a direct next step after pizza configuration, and the stale initial get-started message is cleared after loading. The drink section is focusable for category navigation. Existing cart/API contracts are preserved; no custom CSS was added.

Lint, formatting, and 29 backend tests passed. The full 38-test browser suite passed 37 scenarios initially; the new mixed-order test had an overly exact link selector that omitted the visible arrow. After correcting that selector, all three drinks-flow tests passed, including mobile/desktop drinks-only carts, invalid quantities, type/size changes, persistence after reload, pizza draft preservation across category navigation, and combined order review. Screenshots were inspected. Public HTTPS Chrome checks passed at 1280px and 390px for two large UnColas, $6 preview and saved subtotal, size preservation, immediate local feedback, no unintended pizza, and reload persistence. The live check waits for asynchronous checkout loading. These checks used browser-local carts only; no live order was submitted.

This is a documentation-only follow-up to the runtime commit above.

## Persistent testing admin — October 25, 2026

Runtime commit `d235f85e2aac4e923a0f64335e5911c9221ffa70` was verified against origin/main and deployed from its Git archive (SHA-256 `1657ff1c237711c6de4f13c85ffb9ede73912759791234f03ff2a7307fd017ab`). All installed archive files matched after deployment. Existing runtime dependencies and service configuration were unchanged. The app, environment, and stopped SQLite directory were backed up under `/var/backups/luigis/d235f85e2aac4e923a0f64335e5911c9221ffa70-20261025T171335Z` before installation.

A persistent `testadmin` account with the admin role was provisioned in the local database and the GCP database for shared testing. Its password was supplied privately to the owner and is not recorded in source control. The cloud provisioning operation transferred only the local password hash over authenticated IAP SSH. Existing accounts were preserved, and the temporary cloud provisioning file was removed.

Validation: lint, formatting, all 29 backend tests, and all 38 browser tests passed during this task. Initial sandbox network restrictions and a browser-test port conflict were resolved before successful reruns. Cloud SQLite integrity returned `ok`, with no foreign-key violations. Public HTTPS verification confirmed the testing login, secure session cookie, protected staff orders, and the admin Staff accounts screen. Login and the admin role remained valid after an app-only restart. Verification sessions were logged out; both app and tunnel are active, and the public hostname was preserved. No synthetic orders were submitted.

This record is a documentation-only follow-up; the deployed runtime marker remains `d235f85e2aac4e923a0f64335e5911c9221ffa70`.

## Kitchen timeout and ticket sorting — October 25, 2026

Runtime commit `5beffd3d0865c1630281d5c9cfc66e6e50b438a6` was pushed to main and deployed from its checksum-verified Git archive (SHA-256 `5ffac0f3263f9dff6366189f24c3d075980a8b1cc794ce97ebfd79a649da5cc8`). Every installed archive file matched the staged release. The previous app, environment, and stopped SQLite directory are backed up under `/var/backups/luigis/5beffd3d0865c1630281d5c9cfc66e6e50b438a6-20261025T180351Z`. Dependencies and service configuration were verified unchanged. App health and both services passed, and the tunnel hostname was preserved.

Unfinished tickets move from the main board to **Timed out** after 120 minutes from placement by default. Staff can adjust this from 1 to 1440 minutes in kitchen settings. Orders retain their stages and actions. Both queue tabs support newest on top or newest on bottom within each stage. Timeout and sort choices persist per browser/device. Server filtering and sorting happen before pagination; no automatic completion or cancellation is performed.

Lint, formatting, all 30 backend/database tests, and all 40 browser/accessibility scenarios passed. Coverage includes a stale backlog larger than one page, timeout boundary crossing without status changes, reverse ordering, adjustable thresholds, saved preferences, desktop/mobile layouts, and visible keyboard focus after a ticket leaves the board. Desktop and mobile screenshots were visually inspected.

Public HTTPS Chrome verification at 1280px and 390px confirmed 2 current active tickets and 7 timed-out tickets, partition totals, age cutoffs, both sort directions against the API, saved timeout/sort after reload, no horizontal overflow, and successful testing-admin access. The existing old tickets are accessible in Timed out with their original details. Verification changed only browser preferences, logged out its sessions, and submitted no live orders.

This entry is a documentation-only follow-up; the runtime deployment marker remains `5beffd3d0865c1630281d5c9cfc66e6e50b438a6`.

## Customer account notifications — October 25, 2026

Runtime commit `1312974fbad23664b7990ba9fe05b80fddf13fb2` is deployed from its verified Git archive (SHA-256 `976806c5b13f44de5bbe686794118a1ceba380e5acb78decb3a2fb155d0ff057`). Every staged archive file matched the installation. The final release backup is `/var/backups/luigis/1312974fbad23664b7990ba9fe05b80fddf13fb2-20261025T182522Z`; the pre-notification app/environment/stopped-database backup is `/var/backups/luigis/2d211cb3558fd6309a7dba2408cdb2b12363f35c-20261025T182033Z`. The first notification runtime was `2d211cb3558fd6309a7dba2408cdb2b12363f35c`; the final follow-up improves notification-control contrast. Both deployments verified health, app/tunnel services, SQLite integrity, foreign keys, and migration 007. The tunnel hostname and existing account/order data were preserved.

Customers now have an Updates button across restaurant pages. Preparing, oven, ready, completed, cancelled, and recalled stages generate persistent account messages with unread counts, dates, order-progress links, individual read controls, and paginated older updates. Notifications and stage events commit atomically; existing history is not replayed as new alerts. Phone/counter orders without an associated account produce no account messages. Ownership protects all reads/acknowledgements, and staff names and cancellation notes remain private. Read state is stored on the account; Updates polls while the page is visible. These are in-site notifications; email, SMS, and closed-browser push are not configured.

Validation passed: lint, formatting, 31 backend/database tests, and the full 42-scenario browser suite for the notification implementation. After the contrast-only follow-up, both notification browser scenarios passed again, including unread/read accessibility at 1280px and 390px. Tests cover isolation, duplicate/stale mutations, transaction rollback, read-all races with newer updates, pagination, persistence, mobile layout, cross-page delivery, session expiry, and keyboard focus. Initial browser tests exposed focus loss after disabling a read button; the implementation now restores visible focus. Contrast checks wait for the button transition to settle. Screenshots were visually inspected.

Public Chrome verification used labelled synthetic order #15 (`Notification QA - no food`) and native kitchen buttons. Preparing, oven, made/cut/boxed, and handoff notifications reached the ordering account; the order reached Completed. Desktop/mobile displays, cross-page delivery, unread/read controls, reload, and persistence after an app-only restart passed. Customer/admin verification sessions were logged out. The synthetic customer/order/messages remain as labelled test records; no food, payment, or external messaging was involved. The final contrast release was additionally checked through its public assets, health, and unauthorized notification rejection.

This is a documentation-only follow-up; the runtime marker remains `1312974fbad23664b7990ba9fe05b80fddf13fb2`.

## Mobile formatting and touch controls — October 25, 2026

Runtime commit `92e197afca47e90fab3424f7a9d5e3b5eb3927d3` was pushed to main, verified against origin/main, and deployed from its checksum-verified Git archive (SHA-256 `88f401dcade802f86a6644ca9a5b91d92602fbd0747d3ef1ce71848da86deae6`). Every installed archive file matched the staged release. The previous app, environment, and stopped SQLite directory are backed up under `/var/backups/luigis/92e197afca47e90fab3424f7a9d5e3b5eb3927d3-20261026T023145Z`. Dependencies and service configuration were unchanged. App health, app/tunnel services, and the deployment marker passed after installation; the existing public tunnel was preserved.

Customer account actions now occupy a predictable mobile row, pizza size cards use compact horizontal layouts on phones, card padding adapts to the available width, and staff tabs use consistent columns. Bootstrap utilities handle the layouts. The small shared `responsive.css` exceptions provide 44px phone controls, readable input text, long-content wrapping within cards, and equal staff-tab sizing. Topping options omit redundant per-pizza text already explained by the topping help so prices fit narrow selects.

Local validation passed: lint, formatting, all 31 backend/database tests, and all 49 browser/accessibility scenarios. New layout coverage includes 320, 375, 390, 768, 1024, and 1280px widths, open mobile navigation, pizza customization and saved carts, keyboard focus, landscape/enlarged text, staff views, long ticket details, and cancellation-dialog reflow. Initial suite runs exposed shared authentication quotas in the added fixtures; layout customer sessions were mocked and the staff layout case received its own in-memory app/database before the complete successful rerun. Phone, tablet, and desktop screenshots were inspected.

Public HTTPS Chrome verification passed for all seven customer-facing/sign-in pages, pizza selection, and browser-local cart review at all six widths. Staff kitchen, entry, history, and timed-out views passed at 320, 390, and 1280px. No horizontal page overflow was detected. Public responsive stylesheet, shared navigation script, and menu HTML matched local source after line-ending normalization. Public phone and desktop screenshots were inspected. Verification logged out its staff session and submitted no live orders.

This is a documentation-only follow-up; the deployed runtime marker remains `92e197afca47e90fab3424f7a9d5e3b5eb3927d3`.
