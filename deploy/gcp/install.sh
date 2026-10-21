#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo 'Run this script with sudo on a dedicated Ubuntu/Debian VM.' >&2
  exit 1
fi
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
if [[ "$source_dir" == /opt/luigis ]]; then
  echo 'Extract the new package outside /opt/luigis before installing it.' >&2
  exit 1
fi
case "$(uname -m)" in
  x86_64) node_arch=x64 ;;
  aarch64) node_arch=arm64 ;;
  *) echo 'This installer supports x86_64 and arm64 VMs.' >&2; exit 1 ;;
esac

apt-get update
apt-get install -y ca-certificates curl xz-utils
stage_dir=$(mktemp -d)
trap 'rm -rf -- "$stage_dir"' EXIT
cd "$stage_dir"
node_url=https://nodejs.org/download/release/latest-v24.x
curl --fail --silent --show-error --location "$node_url/SHASUMS256.txt" -o SHASUMS256.txt
node_archive=$(awk -v arch="$node_arch" '$2 ~ ("-linux-" arch "\\.tar\\.xz$") { print $2 }' SHASUMS256.txt)
if [[ ! "$node_archive" =~ ^node-v24\.[0-9]+\.[0-9]+-linux-(x64|arm64)\.tar\.xz$ ]]; then
  echo 'Could not identify the official Node 24 archive.' >&2
  exit 1
fi
curl --fail --silent --show-error --location "$node_url/$node_archive" -o "$node_archive"
awk -v archive="$node_archive" '$2 == archive' SHASUMS256.txt > node.sha256
sha256sum --check node.sha256
tar -xJf "$node_archive" -C /usr/local --strip-components=1

if ! id luigis >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /var/lib/luigis --shell /usr/sbin/nologin luigis
fi
install -d -m 0755 /opt/luigis
install -d -o luigis -g luigis -m 0750 /var/lib/luigis
tar -C "$source_dir" --exclude='./node_modules' --exclude='./.git' --exclude='./.env' --exclude='./.env.*' --exclude='*.db*' --exclude='./demo-dist' --exclude='./.demo-smoke' --exclude='./test-results' --exclude='./playwright-report' --exclude='./.pages' -cf - . | tar -C /opt/luigis -xf -
cd /opt/luigis
/usr/local/bin/npm ci --omit=dev
if [[ ! -f /etc/luigis.env ]]; then
  install -m 0600 /dev/null /etc/luigis.env
  cat > /etc/luigis.env <<'ENV'
PORT=3000
HOST=127.0.0.1
DATABASE_PATH=/var/lib/luigis/luigis.db
SECURE_COOKIES=false
ENV
fi
install -m 0644 deploy/gcp/luigis.service /etc/systemd/system/luigis.service
systemctl daemon-reload
systemctl enable --now luigis
systemctl restart luigis
curl --fail --retry 20 --retry-connrefused --retry-delay 1 http://127.0.0.1:3000/healthz
echo
echo 'Installed. Use the SSH tunnel in deploy/gcp/README.md to open the demo.'
