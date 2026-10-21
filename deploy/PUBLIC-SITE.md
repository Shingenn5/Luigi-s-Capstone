# Enable public login and ordering

The full app needs a running Node.js 24 server with persistent SQLite storage. GitHub Pages serves static files; it cannot execute this backend. Do not remove the preview restrictions without a working host.

## Host the full application

Use the Compute Engine instructions in `gcp/README.md`, an existing Node host with persistent disk, or a laptop HTTPS tunnel for a temporary demonstration. A laptop tunnel stops working when the laptop, Node process, or tunnel stops. Temporary tunnel addresses must be updated whenever they change.

For persistent public hosting, start the application with `npm start`, set `APP_ORIGIN` to its exact public HTTPS origin and `SECURE_COOKIES=true`, and use the reverse-proxy settings documented for your host. Keep the database on persistent disk. Provision employee accounts with `npm run employee:create`. The demo launcher's shared admin credential is intended for local demonstrations.

Verify the host directly before connecting Pages:

- `/healthz` returns `status: ok` and `service: luigis-pizzeria`.
- Customer registration/login, saving an order, and employee access work through the HTTPS address.
- `/js/runtime-config.js` has `STATIC_PREVIEW = false`.
- Accounts, orders, and kitchen stages survive restarting Node.

## Connect the existing GitHub Pages address

Set the repository variable `FULL_APP_URL` to the Node app's HTTPS origin, for example `https://orders.example.com` (replace this example with the actual working host). The value must be an origin with no credentials, path, query, or fragment. GitHub Pages and localhost URLs are rejected.

After the connection changes are on `main`, these commands configure and republish the Pages entry points:

```text
gh variable set FULL_APP_URL --repo Shingenn5/Luigi-s-Capstone --body https://YOUR-ACTUAL-HOST
gh workflow run deploy-pages.yml --repo Shingenn5/Luigi-s-Capstone --ref main
```

The Pages build produces accessible entry pages that open the same route on the full app, including customer login, checkout, employee login, and the protected kitchen. Each entry also has a normal link if automatic navigation is unavailable. Queries and fragments are preserved. Sessions and orders are handled at the full app's origin, avoiding cross-site authentication cookies and disconnected browser-only accounts.

Without `FULL_APP_URL`, Pages continues to publish the explicitly limited static preview. Existing local Node operation stays unchanged. Accounts and draft carts created on different origins are not migrated automatically.

## Verify the public release

Open the GitHub Pages address in a fresh browser session, follow it to the HTTPS app, create a test customer, save an order, and sign in as an employee to process that same order. Verify persistence after restarting the host. A passing local test does not prove the public host is deployed or configured.

Reference: [GitHub Pages is a static hosting service](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).
