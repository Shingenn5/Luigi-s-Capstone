# GCP demo deployment

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
