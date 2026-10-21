# Run the full Luigi's demo

This package includes the website, Node backend, SQL schema, seed menu, and employee login. It runs the full app, including accounts and saved orders. It is separate from the limited GitHub Pages preview.

## Laptop setup

1. Install **Node.js 24 LTS**, version 24.19 or newer within the 24 release line, from [nodejs.org](https://nodejs.org/en/download). Keep the npm option enabled.
2. Extract the ZIP into an ordinary folder. Open its `luigis-demo` folder; do not run files from inside the ZIP.
3. On Windows, double-click `start-demo.cmd`. On macOS/Linux, open a terminal in the folder and run `sh start-demo.sh`.
4. Open the URL printed in the terminal, normally **http://127.0.0.1:3000**. Keep that terminal open. Stop the demo with **Ctrl+C**.

The first start downloads the required server packages using npm, so it needs an internet connection. Node.js and dependencies are not bundled. Later starts reuse installed dependencies. The same launcher also works from this repository with `npm run demo`.

If port 3000 is busy, use `npm run demo -- --port 3001` and open the URL it prints. If you created a `.env`, keep its `APP_ORIGIN` equal to your chosen site address, or leave it unset for a local demo.

## Add an employee

The demo launcher creates **username `admin`, password `adminadmin`** if that username does not exist. Use it on **Employee login**. It has the existing employee access to pending orders; there is no separate administrator role. Restarting never resets an existing account's password or active status.

These are shared demo credentials. `npm start` and the GCP service do not create this account; use individually provisioned accounts for public hosting.

To add another employee, open this same folder in a second terminal and run:

```text
npm run employee:create
```

Choose a username, display name, and password. Password entry is hidden. Open **Employee login** on the website and use those credentials.

Customers can create accounts through **Login → New customer**. For a demo, save a customer order, sign in as an employee, and watch it appear automatically in New. Move it through Preparing, In oven, Ready, then Complete handoff. Try recall, cancellation with a reason, and searchable history. Use **New order** for phone/counter entry without a customer account. Drinks skip the oven. No payment, tax, delivery, or external notification is connected.

The kitchen starts in dark mode. Display settings include a light toggle, per-device aging thresholds (10/20 minutes by default), and optional sound that starts only after Enable sound. Time never advances an order automatically. Staff drafts are stored separately from customer carts; clear drafts on shared devices because they can contain contact details.

## Saved data

By default, data stays in `Database/luigis_pizzeria.db` inside this folder. Restarting does not erase accounts or orders. Keep this folder in a normal local location you can write to. Start only one instance against a database.

For a simple backup, stop the app, then copy the entire `Database` folder somewhere safe. Do not overwrite that folder when upgrading. An optional `.env` can set `DATABASE_PATH` to a separate absolute location; the server and employee-creation command use the same setting.

The distributed ZIP contains **no existing customer data, employee database, `.env`, or installed dependencies**. The demo launcher provisions the documented demo login on first use. Do not forward your used demo folder to someone else; generate a fresh ZIP from the source repo with `npm run package:demo` instead.

## Show it to another device

Run `npm run demo:lan`. Open one of the printed same-network addresses on the other device. Allow the demo port through the laptop firewall for the private network if needed. The laptop must stay awake and both devices must share the network. The default launcher stays limited to your laptop.

LAN demos use HTTP, so use test accounts. If `.env` sets `APP_ORIGIN`, it must match the exact address used on the second device; otherwise leave it unset for the demo. For a public address, use the HTTPS setup in `deploy/gcp/README.md`.

## Google Cloud

The `deploy/gcp` folder contains a Compute Engine setup script, a systemd service, an optional reverse-proxy configuration, and a step-by-step guide. This uses persistent VM storage for SQLite and no Docker. Cloud Run would need an external database integration; its local filesystem is not suitable for this database.

Cloud resources and billing are not created by this package. The GCP scripts must be run on your chosen VM. See `deploy/gcp/README.md` for deployment and verification boundaries.

## Troubleshooting

- **Node not found:** install Node.js 24 LTS and reopen the terminal.
- **Package install failed:** check internet access, then rerun the launcher. From a source checkout, `npm ci` installs development tools too.
- **Port already in use:** choose another port rather than stopping an unrelated app.
- **Request rejected:** the `.env` `APP_ORIGIN` must match the browser address exactly, with no trailing slash. Local HTTP demos use `SECURE_COOKIES=false`.
- **Readiness:** `/healthz` returns `status: ok` only when the server can query SQLite.
