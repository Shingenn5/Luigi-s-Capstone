# DuckDNS and Certbot HTTPS

The selected hostname is `luigis-pizza.duckdns.org`. The owner selected direct IPv6 hosting without a paid public IPv4 address. Visitors need working IPv6 connectivity; IPv4-only networks cannot reach this deployment.

## DNS and networking

Point only the hostname's AAAA record to the VM's public IPv6 address. Clear any automatically detected A record: it can point to the laptop's network instead of the VM. The inspected VM address is `2600:1900:4001:1255::`. Recheck it after replacing the VM or changing its network interface. Keep the DuckDNS account token out of Git, logs, and application packages.

Allow inbound TCP 80 and 443 from `::/0` on `luigis-vpc`, targeted only at `luigis-demo`. Keep SSH restricted to the existing IAP rule and Node on `127.0.0.1:3000`. Port 80 is needed for certificate issuance and automatic HTTP-01 renewal; normal traffic should redirect to HTTPS.

## Configure the VM

Back up `/etc/luigis.env`, existing proxy configuration, application source, and the stopped database directory following [DEVELOPMENT.md](DEVELOPMENT.md). Keep the current tunnel running until the new hostname passes verification.

Install Ubuntu's `nginx`, `certbot`, and `python3-certbot-nginx` packages. Export the pushed Git commit, replace `demo.example.com` in its `nginx.conf` template with `luigis-pizza.duckdns.org`, and install the result as `/etc/nginx/sites-available/luigis`. Enable that site, disable the default site, and run `sudo nginx -t` before reloading Nginx. Both IPv4 and IPv6 listeners are included in the template, but the VM has no public IPv4 address or IPv4 web firewall rule.

Request a Let's Encrypt certificate with Certbot's Nginx plugin for the exact hostname and enable HTTP-to-HTTPS redirection. Enable `certbot.timer` and verify renewal using `sudo certbot renew --dry-run`. Certbot manages the installed TLS configuration and certificate files; never commit private keys or `/etc/letsencrypt`.

After certificate validation succeeds, set these values in `/etc/luigis.env`:

```text
APP_ORIGIN=https://luigis-pizza.duckdns.org
SECURE_COOKIES=true
TRUST_PROXY=loopback
```

Restart only `luigis`. Change the GitHub repository variable `FULL_APP_URL` to the same origin and publish the Pages workflow. Check the live Pages redirect after publication. Once direct HTTPS and authenticated access pass, disable and stop `luigis-tunnel`; the old temporary hostname then ceases to serve the app.

## Verify and recover

Check public HTTPS certificate validation without bypass flags, the HTTP redirect, `/healthz`, customer/staff login, Secure cookies, logout, and the Certbot renewal timer. Confirm the database remains intact and Node port 3000 has no public listener. Record the certificate expiry, backup location, deployed commit, Pages publication, and any unverified behavior in [LIVE-DEMO.md](LIVE-DEMO.md).

If cutover fails while the original tunnel is still running, restore the backed-up environment and previous `FULL_APP_URL`, restart only `luigis`, and republish Pages. Restarting a stopped Quick Tunnel can generate a different hostname, requiring the origin and Pages variable to be updated again. Do not delete TLS keys, database backups, or the tunnel configuration as part of cutover.

Sources: [DuckDNS API](https://www.duckdns.org/spec.jsp), [Certbot Nginx instructions](https://certbot.eff.org/instructions?ws=nginx&os=ubuntunoble), [Certbot renewal](https://eff-certbot.readthedocs.io/en/stable/using.html#renewing-certificates).
