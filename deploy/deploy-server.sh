#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing deploy/.env — copy deploy/env.example and fill in values"
  exit 1
fi
source "$ENV_FILE"

EC2_HOST="${EC2_HOST:-ec2-3-92-164-103.compute-1.amazonaws.com}"
EC2_USER="${EC2_USER:-ec2-user}"
SSH_KEY="${SSH_KEY:-~/.ssh/amos-keypair.pem}"
TARGET="${SERVER_TARGET_DIR:-/home/ec2-user/asif-server}"

echo "▶ Building asif-server..."
cd "$SCRIPT_DIR/../asif-server"
npm run build

echo "▶ Syncing to EC2 $EC2_HOST:$TARGET ..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.env' \
  -e "ssh -i $SSH_KEY" \
  ./ "$EC2_USER@$EC2_HOST:$TARGET/"

# Prod loads WC_*, Firebase, PORT from this file (see asif-server/src/index.ts dotenv).
# Kept separate from rsync --delete so a deploy without a local .env does not wipe the server file.
ASIF_SERVER_ENV="$SCRIPT_DIR/../asif-server/.env"
if [ -f "$ASIF_SERVER_ENV" ]; then
  echo "▶ Copying asif-server/.env to EC2 (matches your dev machine)…"
  scp -i "$SSH_KEY" "$ASIF_SERVER_ENV" "$EC2_USER@$EC2_HOST:$TARGET/.env"
else
  echo "  (skip — no local asif-server/.env; server keeps existing .env)"
fi

echo "▶ Installing dependencies and restarting PM2..."
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "
  cd $TARGET
  npm install --production
  pm2 stop asif-server 2>/dev/null || true
  pm2 delete asif-server 2>/dev/null || true
  pm2 start ecosystem.config.cjs
  pm2 save
"

echo "✅ Server deployed"
