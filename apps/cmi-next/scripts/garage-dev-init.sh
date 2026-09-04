#!/usr/bin/env bash
# One-time local Garage setup for the Cloud file manager dev environment.
# Writes a minimal garage.toml, brings the node up, assigns a layout, then
# creates the cmi-app-files bucket + an access key with CORS for localhost:3000.
set -euo pipefail
cd "$(dirname "$0")/.."
DIR=".garage-dev"
mkdir -p "$DIR/meta" "$DIR/data"

if [ ! -f "$DIR/garage.toml" ]; then
  RPC_SECRET=$(openssl rand -hex 32)
  ADMIN_TOKEN=$(openssl rand -hex 32)
  cat > "$DIR/garage.toml" <<EOF
metadata_dir = "/var/lib/garage/meta"
data_dir = "/var/lib/garage/data"
db_engine = "sqlite"
replication_factor = 1
rpc_bind_addr = "[::]:3901"
rpc_secret = "$RPC_SECRET"
[s3_api]
s3_region = "garage"
api_bind_addr = "[::]:3900"
root_domain = ".s3.garage.localhost"
[admin]
api_bind_addr = "[::]:3903"
admin_token = "$ADMIN_TOKEN"
EOF
  echo "Wrote $DIR/garage.toml"
fi

docker compose -f docker-compose.dev.yml up -d
echo "Waiting for Garage…"; sleep 5

g() { docker exec cmi-garage-dev /garage "$@"; }

NODE_ID=$(g node id -q | cut -d@ -f1)
g layout assign -z dev -c 1G "$NODE_ID" || true
g layout apply --version 1 || true

g bucket create cmi-app-files || true
KEYINFO=$(g key create cmi-dev-key || g key info cmi-dev-key)
g bucket allow --read --write --owner cmi-app-files --key cmi-dev-key || true

echo "-------------------------------------------------------------"
echo "Garage is up at http://localhost:3900 (region 'garage')."
echo "$KEYINFO"
echo "Put these in .env.local:"
echo "  S3_ENDPOINT=http://localhost:3900"
echo "  S3_REGION=garage"
echo "  S3_BUCKET=cmi-app-files"
echo "  S3_ACCESS_KEY_ID=<Key ID above>"
echo "  S3_SECRET_ACCESS_KEY=<Secret key above>"
echo "Then apply CORS (see docs/files-module.md) so the browser can PUT directly."
echo "-------------------------------------------------------------"
