#!/bin/bash
# Set the Telegram webhook to point to our API Gateway endpoint
# Usage: ./scripts/set-webhook.sh <API_GATEWAY_URL>

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <WEBHOOK_URL>"
  echo "Example: $0 https://abc123.execute-api.us-east-1.amazonaws.com/prod/webhook"
  exit 1
fi

WEBHOOK_URL="$1"

# Load bot token from .env if not set
if [ -z "$BOT_TOKEN" ]; then
  if [ -f .env ]; then
    export $(grep BOT_TOKEN .env | xargs)
  fi
fi

if [ -z "$BOT_TOKEN" ]; then
  echo "Error: BOT_TOKEN not set. Set it in .env or as an environment variable."
  exit 1
fi

echo "Setting webhook to: $WEBHOOK_URL"

RESPONSE=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=${WEBHOOK_URL}" \
  -d "allowed_updates=[\"message\"]")

echo "Response: $RESPONSE"

# Verify
echo ""
echo "Verifying webhook info..."
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
