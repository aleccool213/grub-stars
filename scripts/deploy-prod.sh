#!/bin/bash
# Deploy to production environment on Fly.io
# Uses 1Password CLI to fetch API keys automatically
#
# Prerequisites:
#   1. Install 1Password CLI: https://1password.com/downloads/command-line/
#   2. Sign in: eval $(op signin)
#   3. Create a "grub-stars" item in 1Password with these fields:
#      - YELP_API_KEY
#      - GOOGLE_API_KEY
#      - TRIPADVISOR_API_KEY
#
# The script uses stable 1Password references (op://vault/item/field)
# Configure your vault and item names in the variables below.

set -e

# === 1Password Configuration ===
# Adjust these to match your 1Password setup
OP_VAULT="Private"                    # Your vault name
OP_ITEM="grub-stars"                  # Item name containing API keys

# Field names in 1Password (should match env var names)
OP_FIELDS=("YELP_API_KEY" "GOOGLE_API_KEY" "TRIPADVISOR_API_KEY")

echo "=== Deploying grub-stars PRODUCTION environment ==="
echo ""

# Check if fly CLI is installed
if ! command -v fly &> /dev/null; then
  echo "ERROR: fly CLI not found. Install it:"
  echo "  curl -L https://fly.io/install.sh | sh"
  exit 1
fi

# Check if 1Password CLI is installed
if ! command -v op &> /dev/null; then
  echo "ERROR: 1Password CLI (op) not found. Install it:"
  echo "  https://1password.com/downloads/command-line/"
  echo ""
  echo "Or set secrets manually:"
  echo "  fly secrets set YELP_API_KEY=xxx GOOGLE_API_KEY=xxx TRIPADVISOR_API_KEY=xxx --config fly.prod.toml"
  exit 1
fi

# Check if logged into 1Password
if ! op account list &> /dev/null; then
  echo "Not signed into 1Password. Run:"
  echo "  eval \$(op signin)"
  exit 1
fi

# Check if logged into Fly.io
if ! fly auth whoami &> /dev/null; then
  echo "Not logged in to Fly.io. Running 'fly auth login'..."
  fly auth login
fi

# Create app if it doesn't exist
if ! fly apps list | grep -q "grub-stars-prod"; then
  echo "Creating grub-stars-prod app..."
  fly apps create grub-stars-prod
fi

# Create volume if it doesn't exist
if ! fly volumes list --config fly.prod.toml 2>/dev/null | grep -q "grub_stars_prod_data"; then
  echo "Creating persistent volume..."
  fly volumes create grub_stars_prod_data --size 1 --region ord --config fly.prod.toml
fi

# Fetch secrets from 1Password and set them in Fly.io
echo "Fetching API keys from 1Password (vault: $OP_VAULT, item: $OP_ITEM)..."
SECRETS_ARGS=""

for field in "${OP_FIELDS[@]}"; do
  echo "  Reading $field..."
  value=$(op read "op://$OP_VAULT/$OP_ITEM/$field" 2>/dev/null) || {
    echo "ERROR: Could not read $field from 1Password"
    echo "Make sure the item '$OP_ITEM' exists in vault '$OP_VAULT' with field '$field'"
    exit 1
  }
  SECRETS_ARGS="$SECRETS_ARGS $field=$value"
done

echo "Setting secrets in Fly.io..."
fly secrets set $SECRETS_ARGS --config fly.prod.toml

# Deploy
echo ""
echo "Deploying..."
fly deploy --config fly.prod.toml

echo ""
echo "=== Deployment complete ==="
echo "App URL: https://grub-stars-prod.fly.dev"
echo ""
echo "Useful commands:"
echo "  fly logs --config fly.prod.toml         # View logs"
echo "  fly ssh console --config fly.prod.toml  # SSH into container"
echo "  fly status --config fly.prod.toml       # Check status"
echo "  fly secrets list --config fly.prod.toml # List secrets"
