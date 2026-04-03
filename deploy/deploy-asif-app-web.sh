#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing deploy/.env — copy deploy/env.example and fill in values"
  exit 1
fi
source "$ENV_FILE"

BUCKET="${ASIF_APP_WEB_BUCKET:-asif-app-web}"
CF_ID="${ASIF_APP_WEB_CF_ID}"
API_URL="${VITE_API_URL:-https://asif-api.tulidu.com}"

echo "▶ Building asif-app with API_URL=$API_URL ..."
cd "$SCRIPT_DIR/../asif-app"
export VITE_API_URL="$API_URL"
export VITE_API_URL_PRODUCTION="$API_URL"
npm run build

echo "▶ Syncing to s3://$BUCKET ..."
aws s3 sync dist/ "s3://$BUCKET/" --delete

if [ -n "$CF_ID" ]; then
  echo "▶ Invalidating CloudFront $CF_ID ..."
  aws cloudfront create-invalidation --distribution-id "$CF_ID" --paths "/*" --query 'Invalidation.Id' --output text
else
  echo "  (skipping CF invalidation — ASIF_APP_WEB_CF_ID not set)"
fi

echo "✅ https://asif-app.tulidu.com"
