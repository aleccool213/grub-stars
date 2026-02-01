#!/bin/bash
# Deploy to test environment on Fly.io
# Uses mock API server - no real API keys needed

set -e

echo "=== Deploying grub-stars TEST environment ==="
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
if ! fly apps list | grep -q "grub-stars-test"; then
  echo "Creating grub-stars-test app..."
  fly apps create grub-stars-test
fi

# Create volume if it doesn't exist
if ! fly volumes list --config fly.test.toml 2>/dev/null | grep -q "grub_stars_test_data"; then
  echo "Creating persistent volume..."
  fly volumes create grub_stars_test_data --size 1 --region ord --config fly.test.toml
fi

# Deploy
echo "Deploying..."
fly deploy --config fly.test.toml

echo ""
echo "Creating Sentry release..."
if [ -n "$SENTRY_AUTH_TOKEN" ]; then
  SENTRY_ENVIRONMENT=test ./scripts/sentry-release.sh
else
  echo "  Skipping Sentry release (SENTRY_AUTH_TOKEN not set)"
  echo "  To create a Sentry release, set SENTRY_AUTH_TOKEN environment variable"
fi

echo ""
echo "=== Deployment complete ==="
echo "App URL: https://grub-stars-test.fly.dev"
echo ""
echo "Useful commands:"
echo "  fly logs --config fly.test.toml        # View logs"
echo "  fly ssh console --config fly.test.toml # SSH into container"
echo "  fly status --config fly.test.toml      # Check status"
