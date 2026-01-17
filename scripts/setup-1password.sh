#!/bin/bash
# One-time setup script to configure 1Password with Fly.io credentials
#
# This script:
#   1. Logs you into Fly.io (interactive, one-time)
#   2. Creates the grub-stars-prod app if needed
#   3. Generates a deploy token
#   4. Creates/updates the 1Password item with the token
#
# After running this, you can use deploy-prod.sh non-interactively.

set -e

# === Configuration (must match deploy-prod.sh) ===
OP_VAULT="Private"
OP_ITEM="grub-stars"
FLY_APP="grub-stars-prod"

echo "=== grub-stars 1Password Setup ==="
echo ""
echo "This will configure 1Password for seamless Fly.io deployments."
echo ""

# Check prerequisites
if ! command -v fly &> /dev/null; then
  echo "ERROR: fly CLI not found. Install it:"
  echo "  curl -L https://fly.io/install.sh | sh"
  exit 1
fi

if ! command -v op &> /dev/null; then
  echo "ERROR: 1Password CLI (op) not found. Install it:"
  echo "  https://1password.com/downloads/command-line/"
  exit 1
fi

# Check 1Password auth
if ! op account list &> /dev/null; then
  echo "Not signed into 1Password. Run:"
  echo "  eval \$(op signin)"
  exit 1
fi
echo "✓ 1Password CLI authenticated"

# Login to Fly.io interactively
echo ""
echo "Logging into Fly.io (this will open a browser)..."
fly auth login

if ! fly auth whoami &> /dev/null; then
  echo "ERROR: Fly.io login failed"
  exit 1
fi
echo "✓ Fly.io authenticated"

# Create app if needed
echo ""
if fly apps list 2>/dev/null | grep -q "$FLY_APP"; then
  echo "✓ App '$FLY_APP' already exists"
else
  echo "Creating app '$FLY_APP'..."
  fly apps create "$FLY_APP"
  echo "✓ App created"
fi

# Generate deploy token
echo ""
echo "Generating deploy token..."
FLY_TOKEN=$(fly tokens create deploy -a "$FLY_APP" 2>/dev/null | grep -E "^Fly" | head -1 || fly tokens create deploy -a "$FLY_APP")

if [ -z "$FLY_TOKEN" ]; then
  echo "ERROR: Failed to generate token"
  exit 1
fi
echo "✓ Deploy token generated"

# Check if 1Password item exists
echo ""
echo "Configuring 1Password item '$OP_ITEM' in vault '$OP_VAULT'..."

if op item get "$OP_ITEM" --vault "$OP_VAULT" &> /dev/null; then
  # Item exists - update it
  echo "  Updating existing item..."
  op item edit "$OP_ITEM" --vault "$OP_VAULT" "FLY_ACCESS_TOKEN=$FLY_TOKEN" > /dev/null
else
  # Item doesn't exist - create it
  echo "  Creating new item..."
  op item create \
    --category "API Credential" \
    --title "$OP_ITEM" \
    --vault "$OP_VAULT" \
    "FLY_ACCESS_TOKEN=$FLY_TOKEN" \
    "YELP_API_KEY=" \
    "GOOGLE_API_KEY=" \
    "TRIPADVISOR_API_KEY=" > /dev/null

  echo ""
  echo "NOTE: Empty fields created for API keys. Add your keys to 1Password:"
  echo "  - YELP_API_KEY"
  echo "  - GOOGLE_API_KEY"
  echo "  - TRIPADVISOR_API_KEY"
fi

echo "✓ 1Password configured"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "You can now deploy with:"
echo "  ./scripts/deploy-prod.sh"
echo ""
echo "1Password item: $OP_ITEM (vault: $OP_VAULT)"
echo "  - FLY_ACCESS_TOKEN: ✓ configured"
echo "  - YELP_API_KEY: add manually if not set"
echo "  - GOOGLE_API_KEY: add manually if not set"
echo "  - TRIPADVISOR_API_KEY: add manually if not set"
