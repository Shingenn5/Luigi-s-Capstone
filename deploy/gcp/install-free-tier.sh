#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 || $# -ne 2 || ! $2 =~ ^[a-f0-9]{64}$ ]]; then
  echo 'Usage: sudo bash install-free-tier.sh /path/to/cloudflared SHA256' >&2
  exit 1
fi
binary=$(realpath -- "$1")
printf '%s  %s\n' "$2" "$binary" | sha256sum --check -
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)

# The regional GCE mirror may have no IPv6 route. No paid NAT is needed.
sed -i 's|http://[a-z0-9-]*\.gce\.archive\.ubuntu\.com/ubuntu/|http://archive.ubuntu.com/ubuntu/|g' /etc/apt/sources.list.d/ubuntu.sources
printf 'Acquire::ForceIPv6 "true";\n' > /etc/apt/apt.conf.d/99luigis-ipv6
bash "$source_dir/deploy/gcp/install.sh"
install -m 0755 "$binary" /usr/local/bin/cloudflared
install -m 0644 "$source_dir/deploy/gcp/luigis-tunnel.service" /etc/systemd/system/luigis-tunnel.service
systemctl daemon-reload
systemctl enable --now luigis-tunnel
echo 'Read the HTTPS hostname with: sudo journalctl -u luigis-tunnel --no-pager'
echo 'Set APP_ORIGIN and SECURE_COOKIES=true in /etc/luigis.env before public use.'
