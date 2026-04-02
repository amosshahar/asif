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
  --exclude 'data/*.json' \
  -e "ssh -i $SSH_KEY" \
  ./ "$EC2_USER@$EC2_HOST:$TARGET/"

echo "▶ Uploading data files (first deploy only — skip if already exist)..."
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "mkdir -p $TARGET/data"
scp -i "$SSH_KEY" data/users.json "$EC2_USER@$EC2_HOST:$TARGET/data/users.json" 2>/dev/null || echo "  (skipped — data already exists)"

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
