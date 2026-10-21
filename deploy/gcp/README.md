# Host the Node demo on Google Cloud

This setup uses **one Compute Engine VM** and its persistent disk for SQLite. Node runs as a dedicated `luigis` user under systemd, and restarts after a reboot or process failure. No Docker is required. Cloud Run's local filesystem is ephemeral; using it would require a different database integration.

These files prepare deployment but do not create a Google Cloud project, enable billing, or deploy anything by themselves. GCP compute, disk, and network resources may incur charges. The installer has been syntax-checked; this repository's delivery does not claim an executed GCP deployment.

## 1. Create a VM

Use a dedicated Ubuntu 24.04 LTS VM with at least 2 GB of memory and a persistent disk. Keep the disk when deleting the VM, and arrange backups separately. The following is a template to run from a machine with the Google Cloud CLI installed and authenticated. Replace `YOUR_PROJECT_ID` with your project:

```sh
gcloud compute instances create luigis-demo \
  --project=YOUR_PROJECT_ID \
  --zone=us-central1-a \
  --machine-type=e2-small \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=20GB \
  --no-boot-disk-auto-delete
```

The initial demo uses an authenticated SSH tunnel, so port 3000 does not need public ingress. SSH access depends on your project's IAM and network rules.

## 2. Upload and install

Generate a clean package locally with `npm run package:demo`, then upload it:

```sh
gcloud compute scp demo-dist/luigis-demo.zip luigis-demo:~/luigis-demo.zip \
  --project=YOUR_PROJECT_ID --zone=us-central1-a
gcloud compute ssh luigis-demo --project=YOUR_PROJECT_ID --zone=us-central1-a
```

Inside the VM:

```sh
sudo apt-get update
sudo apt-get install -y unzip
unzip -q ~/luigis-demo.zip -d ~/demo-release
sudo bash ~/demo-release/luigis-demo/deploy/gcp/install.sh
```

The installer downloads the official latest Node 24 Linux archive and verifies its SHA-256 against the official release manifest. It installs the app in `/opt/luigis`, creates `/etc/luigis.env` only if it does not already exist, and stores the database in `/var/lib/luigis/luigis.db`. Application updates do not overwrite that database or existing environment settings.

Create an employee account from the VM terminal:

```sh
sudo -u luigis env DATABASE_PATH=/var/lib/luigis/luigis.db \
  /usr/local/bin/node /opt/luigis/scripts/create-employee.js
```

## 3. Open the hosted demo

Back on your laptop, keep this tunnel running:

```sh
gcloud compute ssh luigis-demo --project=YOUR_PROJECT_ID --zone=us-central1-a \
  -- -N -L 3000:127.0.0.1:3000
```

Open **http://127.0.0.1:3000** on the laptop. The app and database run on the VM, with the connection carried through SSH. If local port 3000 is occupied, change the first port in `-L` to `3001` and open `http://127.0.0.1:3001`.

## Public HTTPS address

For public access, reserve an address, point a real domain at it, and allow ports 80/443 in your GCP firewall. Keep Node listening on `127.0.0.1:3000`; do not expose that port directly.

Install Nginx and copy `nginx.conf` into its site configuration. Replace `demo.example.com` with the real domain. Use the current [Certbot Nginx instructions](https://certbot.eff.org/instructions?ws=nginx&os=snap) to obtain and renew HTTPS certificates. Test Nginx before reloading it.

Then edit `/etc/luigis.env` to include:

```text
APP_ORIGIN=https://your-actual-domain.example
SECURE_COOKIES=true
TRUST_PROXY=loopback
```

Use the actual HTTPS domain, with no trailing slash, and restart the service with `sudo systemctl restart luigis`. The supplied proxy overwrites forwarding headers, and Node trusts only loopback proxy connections. Use the public domain for sign-in after setting `APP_ORIGIN`; local/tunnel origins will no longer match it.

## Verify and maintain

```sh
curl --fail http://127.0.0.1:3000/healthz
sudo systemctl status luigis
sudo journalctl -u luigis -n 100 --no-pager
```

Verify customer registration, saving an order, employee access to that order, and persistence after a restart. To back up simply, stop the service, copy the entire `/var/lib/luigis` directory to protected backup storage, and restart it. Do not copy just the live database file while SQLite WAL writes may be active.

For updates, extract a new ZIP into a fresh release folder and run its installer. Keep the existing environment file and data directory. One app instance owns this database; horizontal autoscaling and multiple writers are not configured.

## Sources

- [Compute Engine startup scripts](https://docs.cloud.google.com/compute/docs/instances/startup-scripts)
- [Compute Engine operating systems](https://docs.cloud.google.com/compute/docs/images/os-details)
- [Cloud Run filesystem contract](https://docs.cloud.google.com/run/docs/container-contract#filesystem)
- [Official Node 24 release checksums](https://nodejs.org/download/release/latest-v24.x/SHASUMS256.txt)
