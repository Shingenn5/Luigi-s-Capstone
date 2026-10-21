# Compute Engine demo within the free-tier allowances

Use one non-Spot `e2-micro` in `us-central1`, with a 20 GB `pd-standard` boot disk retained on deletion. The free allowance is shared across eligible usage on the billing account; check for other VMs and disks first. External IPv4, Cloud NAT, load balancers, snapshots, Cloud DNS zones, larger machines and disks, and traffic beyond allowances can incur charges. Billing must be enabled. This configuration is intended to stay within allowances, not impose a billing hard cap.

## Network and VM

The commands below create a dedicated dual-stack network. The VM has internal IPv4 for IAP administration and external IPv6 for outbound traffic, but no external IPv4. Firewall access to SSH is limited to Google's IAP range. Node remains on loopback; the public tunnel needs no inbound application ports.

Run these commands with the authenticated Google Cloud CLI, replacing `YOUR_PROJECT_ID`:

```sh
gcloud services enable iap.googleapis.com --project=YOUR_PROJECT_ID
gcloud compute networks create luigis-vpc --subnet-mode=custom --project=YOUR_PROJECT_ID
gcloud compute networks subnets create luigis-central \
  --network=luigis-vpc --region=us-central1 --range=10.42.0.0/24 \
  --stack-type=IPV4_IPV6 --ipv6-access-type=EXTERNAL --project=YOUR_PROJECT_ID
gcloud compute firewall-rules create luigis-iap-ssh \
  --network=luigis-vpc --allow=tcp:22 --source-ranges=35.235.240.0/20 \
  --target-tags=luigis-demo --project=YOUR_PROJECT_ID
gcloud compute instances create luigis-demo --zone=us-central1-a \
  --machine-type=e2-micro --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud --boot-disk-size=20GB \
  --boot-disk-type=pd-standard --no-boot-disk-auto-delete \
  --subnet=luigis-central --stack-type=IPV4_IPV6 --no-address \
  --ipv6-network-tier=PREMIUM --tags=luigis-demo \
  --no-service-account --no-scopes --project=YOUR_PROJECT_ID
```

Do not create a second VM if capacity is unavailable without checking the first operation's outcome. Reuse the dedicated network and existing VM on subsequent deployments. Do not overwrite unrelated project resources.

## Install and access

Use `gcloud compute ssh` and `gcloud compute scp` with `--tunnel-through-iap`, `--project`, and `--zone`. Upload a fresh `npm run package:demo` ZIP and run its existing installer. Keep SQLite at `/var/lib/luigis/luigis.db`. Package updates preserve that directory and `/etc/luigis.env`.

IPv4-only package mirrors cannot be reached without paid NAT in this setup. Use IPv6-capable Ubuntu mirrors and download/upload artifacts locally if an upstream host has no IPv6. Do not add paid networking to work around a package download failure.

Run Cloudflare Quick Tunnel on the VM with IPv6 edge connections and the app's loopback HTTP origin. It supplies an HTTPS `trycloudflare.com` hostname accessible to visitors without IPv6. Configure `APP_ORIGIN` to that exact HTTPS origin and `SECURE_COOKIES=true` before testing login. The source app keeps its real Node API mode; no static-preview login substitutes are used.

Quick Tunnel addresses change when the tunnel process restarts and are intended for demos, with no uptime guarantee. After a change, update the app origin and GitHub repository `FULL_APP_URL`, then republish Pages. The stable Pages entry address remains the same, but the backend address must be current. A stable named tunnel needs a separate domain setup.

Create individual employee accounts through the VM terminal. Public startup uses `npm start`/systemd and does not auto-create the local demo's shared employee account. Local accounts/orders stay in the laptop's database; the cloud starts fresh unless data migration is explicitly requested.

## Release checks

Verify there is no external IPv4 access configuration, the disk is `pd-standard`, and the machine is `e2-micro`. Test IPv6 outbound connectivity, tunnel reachability from an IPv4 client, customer registration/order persistence, employee processing, duplicate submission, and Node restart persistence before setting `FULL_APP_URL` or claiming deployment is complete. Check billing usage after provisioning; free-tier eligibility does not guarantee every resource or workload is free.

References: [Compute Engine allowance](https://docs.cloud.google.com/free/docs/free-cloud-features#compute), [IPv6 address pricing](https://cloud.google.com/vpc/network-pricing#ipaddress), [Cloudflare IPv6 edge connections](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/run-parameters/), [Quick Tunnel limitations](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
