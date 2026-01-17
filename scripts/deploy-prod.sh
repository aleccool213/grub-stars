#!/bin/bash
# Deploy to production environment on Fly.io
# Requires real API keys to be set as secrets

set -e

echo "=== Deploying grub-stars PRODUCTION environment ==="
echo ""

# Check if fly CLI is installed
if ! command -v fly &> /dev/null; then
  echo "ERROR: fly CLI not found. Install it:"
  echo "  curl -L https://fly.io/install.sh | sh"
  exit 1
fi

# Check if logged in
if ! fly auth whoami &> /dev/null; then
  echo "Not logged in to Fly.io. Running 'fly auth login'..."
  fly auth login
fi

# Create app if it doesn't exist
if ! fly apps list | grep -q "grub-stars-prod"; then
  echo "Creating grub-stars-prod app..."
  fly apps create grub-stars-prod

  echo ""
  echo "IMPORTANT: Set your API secrets before deploying:"
  echo "  fly secrets set YELP_API_KEY=your_key --config fly.prod.toml"
  echo "  fly secrets set GOOGLE_API_KEY=your_key --config fly.prod.toml"
  echo "  fly secrets set TRIPADVISOR_API_KEY=your_key --config fly.prod.toml"
  echo ""
  read -p "Have you set the secrets? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborting. Set secrets first, then run this script again."
    exit 1
  fi
fi

# Create volume if it doesn't exist
if ! fly volumes list --config fly.prod.toml 2>/dev/null | grep -q "grub_stars_prod_data"; then
  echo "Creating persistent volume..."
  fly volumes create grub_stars_prod_data --size 1 --region ord --config fly.prod.toml
fi

# Deploy
echo "Deploying..."
fly deploy --config fly.prod.toml

echo ""
echo "=== Deployment complete ==="
echo "App URL: https://grub-stars-prod.fly.dev"
echo ""
echo "Useful commands:"
echo "  fly logs --config fly.prod.toml        # View logs"
echo "  fly ssh console --config fly.prod.toml # SSH into container"
echo "  fly status --config fly.prod.toml      # Check status"
echo "  fly secrets list --config fly.prod.toml # List secrets"
